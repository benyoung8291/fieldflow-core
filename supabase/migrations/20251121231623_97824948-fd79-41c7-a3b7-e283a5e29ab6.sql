-- Fix search_path for functions missing it

-- Fix auto_link_ticket_contact
CREATE OR REPLACE FUNCTION public.auto_link_ticket_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
  v_customer_id uuid;
BEGIN
  -- Try to find matching contact by email
  IF NEW.sender_email IS NOT NULL THEN
    SELECT id, customer_id INTO v_contact_id, v_customer_id
    FROM contacts
    WHERE tenant_id = NEW.tenant_id
      AND LOWER(email) = LOWER(NEW.sender_email)
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      NEW.contact_id := v_contact_id;
      NEW.customer_id := v_customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix calculate_time_log_cost (change empty string to 'public')
CREATE OR REPLACE FUNCTION public.calculate_time_log_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Calculate total hours if clock_out is set
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600;
    
    -- Calculate total cost including overhead
    NEW.total_cost := NEW.total_hours * NEW.hourly_rate * (1 + (NEW.overhead_percentage / 100));
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix calculate_task_dates
CREATE OR REPLACE FUNCTION public.calculate_task_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  max_dependency_end_date date;
  calculated_start_date date;
BEGIN
  -- If start_date is explicitly set, use it
  IF NEW.start_date IS NOT NULL THEN
    -- Calculate end_date if estimated_hours is set and end_date is not
    IF NEW.estimated_hours IS NOT NULL AND NEW.end_date IS NULL THEN
      -- Assume 8 hour work days
      NEW.end_date := NEW.start_date + CEIL(NEW.estimated_hours / 8.0)::integer;
    END IF;
    RETURN NEW;
  END IF;

  -- Check for dependencies
  SELECT MAX(
    CASE td.dependency_type
      WHEN 'finish_to_start' THEN t.end_date + td.lag_days
      WHEN 'start_to_start' THEN t.start_date + td.lag_days
      WHEN 'finish_to_finish' THEN t.end_date + td.lag_days - CEIL(NEW.estimated_hours / 8.0)::integer
      WHEN 'start_to_finish' THEN t.start_date + td.lag_days - CEIL(NEW.estimated_hours / 8.0)::integer
      ELSE t.end_date + td.lag_days
    END
  )
  INTO max_dependency_end_date
  FROM task_dependencies td
  JOIN tasks t ON t.id = td.depends_on_task_id
  WHERE td.task_id = NEW.id AND t.end_date IS NOT NULL;

  -- Set calculated start date based on dependencies
  IF max_dependency_end_date IS NOT NULL THEN
    NEW.start_date := max_dependency_end_date;
  END IF;

  -- Calculate end_date if estimated_hours is set
  IF NEW.estimated_hours IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date IS NULL THEN
    NEW.end_date := NEW.start_date + CEIL(NEW.estimated_hours / 8.0)::integer;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix create_purchase_order_with_linkage
CREATE OR REPLACE FUNCTION public.create_purchase_order_with_linkage(p_tenant_id uuid, p_supplier_id uuid, p_po_number text, p_po_date date, p_expected_delivery_date date, p_notes text, p_internal_notes text, p_tax_rate numeric, p_subtotal numeric, p_tax_amount numeric, p_total_amount numeric, p_created_by uuid, p_status text, p_service_order_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_po_id UUID;
BEGIN
  INSERT INTO purchase_orders (
    tenant_id,
    supplier_id,
    po_number,
    po_date,
    expected_delivery_date,
    notes,
    internal_notes,
    tax_rate,
    subtotal,
    tax_amount,
    total_amount,
    created_by,
    status,
    service_order_id,
    project_id
  ) VALUES (
    p_tenant_id,
    p_supplier_id,
    p_po_number,
    p_po_date,
    p_expected_delivery_date,
    p_notes,
    p_internal_notes,
    p_tax_rate,
    p_subtotal,
    p_tax_amount,
    p_total_amount,
    p_created_by,
    p_status,
    p_service_order_id,
    p_project_id
  )
  RETURNING id INTO v_po_id;
  
  RETURN v_po_id;
END;
$function$;

-- Fix update_purchase_order_linkage
CREATE OR REPLACE FUNCTION public.update_purchase_order_linkage(p_po_id uuid, p_service_order_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the purchase order
  UPDATE purchase_orders
  SET 
    service_order_id = p_service_order_id,
    project_id = p_project_id,
    updated_at = now()
  WHERE id = p_po_id;
END;
$function$;