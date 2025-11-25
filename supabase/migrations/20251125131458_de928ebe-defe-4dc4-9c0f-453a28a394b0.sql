-- Create a secure function to get user access information
CREATE OR REPLACE FUNCTION public.get_user_access_info()
RETURNS TABLE (
  user_id uuid,
  has_role boolean,
  is_worker boolean,
  can_access_office boolean,
  can_access_worker boolean,
  show_toggle boolean,
  default_route text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
  v_is_worker boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user has any role
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id
  ) INTO v_has_role;
  
  -- Check if user is a worker
  SELECT EXISTS (
    SELECT 1 FROM workers
    WHERE id = v_user_id
  ) INTO v_is_worker;
  
  -- Return the results
  RETURN QUERY
  SELECT 
    v_user_id,
    v_has_role,
    v_is_worker,
    v_has_role as can_access_office,
    v_is_worker as can_access_worker,
    (v_has_role AND v_is_worker) as show_toggle,
    CASE 
      WHEN v_has_role THEN '/dashboard'::text
      WHEN v_is_worker THEN '/worker/dashboard'::text
      ELSE '/dashboard'::text
    END as default_route;
END;
$$;