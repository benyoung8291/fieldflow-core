-- Consolidate duplicate service orders by merging those with same contract, date, and location
DO $$
DECLARE
  v_duplicate_group RECORD;
  v_keeper_id UUID;
  v_duplicate_id UUID;
  v_moved_count INT := 0;
  v_deleted_count INT := 0;
BEGIN
  -- Find groups of duplicate service orders
  FOR v_duplicate_group IN
    SELECT 
      contract_id,
      generated_from_date,
      COALESCE(location_id::text, 'NULL') as location_key,
      location_id,
      tenant_id,
      array_agg(id ORDER BY created_at) as order_ids,
      COUNT(*) as duplicate_count
    FROM service_orders
    WHERE contract_id IS NOT NULL
      AND generated_from_date IS NOT NULL
    GROUP BY contract_id, generated_from_date, location_id, tenant_id
    HAVING COUNT(*) > 1
  LOOP
    -- First service order in the group becomes the keeper
    v_keeper_id := v_duplicate_group.order_ids[1];
    
    RAISE NOTICE 'Processing duplicate group: contract %, date %, location %, keeper %, duplicates %',
      v_duplicate_group.contract_id,
      v_duplicate_group.generated_from_date,
      v_duplicate_group.location_id,
      v_keeper_id,
      v_duplicate_group.duplicate_count - 1;
    
    -- Loop through duplicate service orders (skip the first one which is the keeper)
    FOR i IN 2..array_length(v_duplicate_group.order_ids, 1) LOOP
      v_duplicate_id := v_duplicate_group.order_ids[i];
      
      -- Move all line items from duplicate to keeper
      UPDATE service_order_line_items
      SET service_order_id = v_keeper_id
      WHERE service_order_id = v_duplicate_id;
      
      GET DIAGNOSTICS v_moved_count = ROW_COUNT;
      
      RAISE NOTICE '  Moved % line items from SO % to keeper %',
        v_moved_count, v_duplicate_id, v_keeper_id;
      
      -- Delete the now-empty duplicate service order
      DELETE FROM service_orders
      WHERE id = v_duplicate_id;
      
      v_deleted_count := v_deleted_count + 1;
    END LOOP;
    
    -- Recalculate totals for the keeper service order
    UPDATE service_orders
    SET 
      subtotal = (
        SELECT COALESCE(SUM(line_total), 0)
        FROM service_order_line_items
        WHERE service_order_id = v_keeper_id
      ),
      total_amount = (
        SELECT COALESCE(SUM(line_total), 0)
        FROM service_order_line_items
        WHERE service_order_id = v_keeper_id
      ),
      updated_at = NOW()
    WHERE id = v_keeper_id;
    
  END LOOP;
  
  RAISE NOTICE 'Consolidation complete: deleted % duplicate service orders', v_deleted_count;
END $$;