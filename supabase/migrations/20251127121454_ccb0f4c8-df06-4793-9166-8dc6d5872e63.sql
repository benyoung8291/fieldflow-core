-- Enable RLS policy for customer portal access to field_reports

-- Field Reports: Customers can view field reports for their locations
CREATE POLICY "Customer portal users can view their field reports"
ON field_reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    JOIN appointments a ON field_reports.appointment_id = a.id
    JOIN service_orders so ON a.service_order_id = so.id
    WHERE cpu.user_id = auth.uid()
    AND so.customer_id = cpu.customer_id
  )
);