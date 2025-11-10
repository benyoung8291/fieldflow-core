-- Create audit trigger for invoices table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'invoices_audit_trigger' 
    AND tgrelid = 'public.invoices'::regclass
  ) THEN
    CREATE TRIGGER invoices_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.invoices
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;

-- Create audit trigger for invoice_line_items table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'invoice_line_items_audit_trigger' 
    AND tgrelid = 'public.invoice_line_items'::regclass
  ) THEN
    CREATE TRIGGER invoice_line_items_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;

-- Create audit trigger for customer_locations table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'customer_locations_audit_trigger' 
    AND tgrelid = 'public.customer_locations'::regclass
  ) THEN
    CREATE TRIGGER customer_locations_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.customer_locations
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;

-- Create audit trigger for project_tasks table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'project_tasks_audit_trigger' 
    AND tgrelid = 'public.project_tasks'::regclass
  ) THEN
    CREATE TRIGGER project_tasks_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;

-- Create audit trigger for project_attachments table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'project_attachments_audit_trigger' 
    AND tgrelid = 'public.project_attachments'::regclass
  ) THEN
    CREATE TRIGGER project_attachments_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.project_attachments
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;

-- Create audit trigger for project_contracts table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'project_contracts_audit_trigger' 
    AND tgrelid = 'public.project_contracts'::regclass
  ) THEN
    CREATE TRIGGER project_contracts_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.project_contracts
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;