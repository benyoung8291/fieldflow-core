-- Create service contract generation history table
CREATE TABLE IF NOT EXISTS public.service_contract_generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  contract_line_item_id UUID NOT NULL REFERENCES public.service_contract_line_items(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  generation_date DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id),
  was_automated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_generation_history_tenant ON public.service_contract_generation_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_contract ON public.service_contract_generation_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_line_item ON public.service_contract_generation_history(contract_line_item_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_service_order ON public.service_contract_generation_history(service_order_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_date ON public.service_contract_generation_history(generation_date);

-- Enable RLS
ALTER TABLE public.service_contract_generation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view generation history for their tenant"
  ON public.service_contract_generation_history
  FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert generation history"
  ON public.service_contract_generation_history
  FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid() AND ur.role = 'tenant_admin'
  ));

-- Drop and recreate the generate_service_orders_from_contracts function with history tracking
DROP FUNCTION IF EXISTS public.generate_service_orders_from_contracts(DATE, DATE, UUID, UUID);

CREATE OR REPLACE FUNCTION public.generate_service_orders_from_contracts(
  p_start_date DATE,
  p_end_date DATE,
  p_tenant_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group RECORD;
  v_order_id UUID;
  v_order_number TEXT;
  v_orders_created INT := 0;
  v_total_items INT := 0;
  v_already_generated INT := 0;
  v_errors JSONB := '[]'::JSONB;
  v_estimated_hours NUMERIC;
  v_fixed_amount NUMERIC;
  v_title TEXT;
  v_description TEXT;
  v_settings RECORD;
  v_next_number BIGINT;
  v_history_ids UUID[];
BEGIN
  -- Count total items to process
  SELECT COUNT(*) INTO v_total_items
  FROM service_contract_line_items scli
  INNER JOIN service_contracts sc ON scli.contract_id = sc.id
  WHERE sc.tenant_id = p_tenant_id
    AND sc.status = 'active'
    AND sc.auto_generate = true
    AND scli.next_generation_date >= p_start_date
    AND scli.next_generation_date <= p_end_date;

  -- Count already generated (check history table)
  SELECT COUNT(DISTINCT scli.id) INTO v_already_generated
  FROM service_contract_line_items scli
  INNER JOIN service_contracts sc ON scli.contract_id = sc.id
  INNER JOIN service_contract_generation_history sgh ON sgh.contract_line_item_id = scli.id
  WHERE sc.tenant_id = p_tenant_id
    AND sc.status = 'active'
    AND sc.auto_generate = true
    AND scli.next_generation_date >= p_start_date
    AND scli.next_generation_date <= p_end_date
    AND sgh.generation_date = scli.next_generation_date;

  -- Ensure sequential number settings exist
  INSERT INTO public.sequential_number_settings (tenant_id, entity_type, next_number)
  VALUES (p_tenant_id, 'service_order', 1)
  ON CONFLICT (tenant_id, entity_type) DO NOTHING;

  -- Process groups: same location + same generation date = one service order
  FOR v_group IN
    SELECT 
      scli.location_id,
      scli.next_generation_date AS generation_date,
      scli.contract_id,
      sc.contract_number,
      sc.title AS contract_title,
      sc.customer_id,
      array_agg(scli.id) AS line_item_ids,
      array_agg(scli.description) AS descriptions,
      array_agg(scli.quantity) AS quantities,
      array_agg(scli.unit_price) AS unit_prices,
      array_agg(scli.cost_price) AS cost_prices,
      array_agg(scli.line_total) AS line_totals,
      array_agg(scli.estimated_hours) AS estimated_hours_array,
      array_agg(scli.key_number) AS key_numbers,
      array_agg(scli.recurrence_frequency::text) AS frequencies
    FROM service_contract_line_items scli
    INNER JOIN service_contracts sc ON scli.contract_id = sc.id
    WHERE sc.tenant_id = p_tenant_id
      AND sc.status = 'active'
      AND sc.auto_generate = true
      AND scli.next_generation_date >= p_start_date
      AND scli.next_generation_date <= p_end_date
      AND NOT EXISTS (
        SELECT 1 FROM service_contract_generation_history sgh
        WHERE sgh.contract_line_item_id = scli.id
          AND sgh.generation_date = scli.next_generation_date
      )
    GROUP BY scli.location_id, scli.next_generation_date, scli.contract_id, 
             sc.contract_number, sc.title, sc.customer_id
  LOOP
    BEGIN
      -- Get next service order number
      SELECT * INTO v_settings
      FROM public.sequential_number_settings
      WHERE tenant_id = p_tenant_id AND entity_type = 'service_order'
      FOR UPDATE;
      
      v_next_number := v_settings.next_number;
      v_order_number := v_settings.prefix || LPAD(v_next_number::TEXT, v_settings.number_length, '0');
      
      UPDATE public.sequential_number_settings
      SET next_number = next_number + 1, updated_at = now()
      WHERE tenant_id = p_tenant_id AND entity_type = 'service_order';

      -- Calculate totals
      SELECT SUM(val) INTO v_estimated_hours
      FROM unnest(v_group.estimated_hours_array) val;

      SELECT SUM(val) INTO v_fixed_amount
      FROM unnest(v_group.line_totals) val;

      -- Build title and description
      IF array_length(v_group.line_item_ids, 1) = 1 THEN
        v_title := v_group.descriptions[1];
        v_description := v_group.descriptions[1] || ' (Qty: ' || v_group.quantities[1]::TEXT || 
                        CASE WHEN v_group.estimated_hours_array[1] IS NOT NULL 
                             THEN ', Est. Hours: ' || v_group.estimated_hours_array[1]::TEXT 
                             ELSE '' END || ')';
      ELSE
        v_title := v_group.contract_title || ' - Multiple Services';
        v_description := array_to_string(
          ARRAY(
            SELECT unnest(v_group.descriptions) || ' (Qty: ' || unnest(v_group.quantities)::TEXT || 
                   CASE WHEN unnest(v_group.estimated_hours_array) IS NOT NULL 
                        THEN ', Est. Hours: ' || unnest(v_group.estimated_hours_array)::TEXT 
                        ELSE '' END || ')'
          ),
          E'\n'
        );
      END IF;

      -- Create service order with location and estimated hours
      INSERT INTO service_orders (
        tenant_id,
        customer_id,
        contract_id,
        order_number,
        title,
        description,
        status,
        billing_type,
        fixed_amount,
        estimated_hours,
        priority,
        location_id,
        key_number,
        generated_from_date,
        created_by
      ) VALUES (
        p_tenant_id,
        v_group.customer_id,
        v_group.contract_id,
        v_order_number,
        v_title,
        v_description,
        'draft',
        'fixed',
        v_fixed_amount,
        v_estimated_hours,
        'normal',
        v_group.location_id,
        CASE WHEN array_length(v_group.line_item_ids, 1) = 1 THEN v_group.key_numbers[1] ELSE NULL END,
        v_group.generation_date,
        p_user_id
      ) RETURNING id INTO v_order_id;

      v_history_ids := ARRAY[]::UUID[];

      -- Create line items and generation history
      FOR i IN 1..array_length(v_group.line_item_ids, 1) LOOP
        -- Insert service order line item
        INSERT INTO service_order_line_items (
          tenant_id,
          service_order_id,
          contract_line_item_id,
          description,
          quantity,
          unit_price,
          cost_price,
          line_total,
          item_order,
          estimated_hours
        ) VALUES (
          p_tenant_id,
          v_order_id,
          v_group.line_item_ids[i],
          v_group.descriptions[i],
          v_group.quantities[i],
          v_group.unit_prices[i],
          v_group.cost_prices[i],
          v_group.line_totals[i],
          i - 1,
          v_group.estimated_hours_array[i]
        );

        -- Record generation history
        INSERT INTO service_contract_generation_history (
          tenant_id,
          contract_id,
          contract_line_item_id,
          service_order_id,
          generation_date,
          generated_by,
          was_automated
        ) VALUES (
          p_tenant_id,
          v_group.contract_id,
          v_group.line_item_ids[i],
          v_order_id,
          v_group.generation_date,
          p_user_id,
          false
        );

        -- Update next generation date for the line item
        UPDATE service_contract_line_items
        SET next_generation_date = calculate_next_generation_date(
          v_group.generation_date,
          v_group.frequencies[i]
        )
        WHERE id = v_group.line_item_ids[i];
      END LOOP;

      v_orders_created := v_orders_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'location_id', v_group.location_id,
        'generation_date', v_group.generation_date,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'orders_created', v_orders_created,
      'total_line_items', v_total_items,
      'already_generated', v_already_generated,
      'errors', v_errors
    )
  );
END;
$$;