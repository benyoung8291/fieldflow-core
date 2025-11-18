-- Create function to get duplicate locations
CREATE OR REPLACE FUNCTION get_duplicate_locations(p_customer_id UUID)
RETURNS TABLE (
  name TEXT,
  customer_location_id TEXT,
  location_ids UUID[],
  archived_status BOOLEAN[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.name,
    cl.customer_location_id,
    array_agg(cl.id ORDER BY 
      CASE WHEN cl.archived THEN 1 ELSE 0 END,
      cl.created_at
    ) as location_ids,
    array_agg(cl.archived ORDER BY 
      CASE WHEN cl.archived THEN 1 ELSE 0 END,
      cl.created_at
    ) as archived_status
  FROM customer_locations cl
  WHERE cl.customer_id = p_customer_id
  GROUP BY cl.name, cl.customer_location_id
  HAVING COUNT(*) > 1
  ORDER BY cl.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;