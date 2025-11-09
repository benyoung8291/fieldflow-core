-- Add trigger for appointments audit logging
DROP TRIGGER IF EXISTS appointments_audit_trigger ON public.appointments;
CREATE TRIGGER appointments_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();