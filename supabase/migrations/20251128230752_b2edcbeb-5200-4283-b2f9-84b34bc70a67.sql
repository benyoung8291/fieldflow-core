-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_customer_portal_user_login ON auth.users;

-- Recreate the trigger to fire on last_sign_in_at updates
CREATE TRIGGER on_customer_portal_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.update_customer_portal_user_last_login();

-- Backfill existing last_login_at data from auth.users
UPDATE public.customer_portal_users cpu
SET last_login_at = au.last_sign_in_at
FROM auth.users au
WHERE cpu.user_id = au.id
  AND cpu.last_login_at IS NULL
  AND au.last_sign_in_at IS NOT NULL;