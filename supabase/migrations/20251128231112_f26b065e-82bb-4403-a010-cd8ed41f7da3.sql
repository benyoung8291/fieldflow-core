-- Fix security linter warning for check_customer_role_conflict function
CREATE OR REPLACE FUNCTION check_customer_role_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If adding a customer role, check if user has other roles
  IF NEW.role::text = 'customer' THEN
    IF EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = NEW.user_id
      AND role::text != 'customer'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Customer portal users cannot have additional roles';
    END IF;
  ELSE
    -- If adding a non-customer role, check if user has customer role
    IF EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = NEW.user_id
      AND role::text = 'customer'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Users with office roles cannot be customer portal users';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;