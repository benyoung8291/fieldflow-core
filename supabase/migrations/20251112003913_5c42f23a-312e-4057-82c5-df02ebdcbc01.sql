-- Enable audit logging for appointment_workers table
CREATE TRIGGER audit_appointment_workers
  AFTER INSERT OR UPDATE OR DELETE ON public.appointment_workers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();