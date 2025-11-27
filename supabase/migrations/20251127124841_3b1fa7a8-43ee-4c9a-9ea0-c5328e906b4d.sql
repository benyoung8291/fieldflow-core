-- Drop existing customer portal field reports policy
DROP POLICY IF EXISTS "Customer portal users can view their field reports" ON field_reports;

-- Create updated policy that only shows approved reports
CREATE POLICY "Customer portal users can view approved field reports"
ON field_reports
FOR SELECT
TO authenticated
USING (
  status = 'approved' 
  AND EXISTS (
    SELECT 1
    FROM customer_portal_users cpu
    JOIN appointments a ON field_reports.appointment_id = a.id
    JOIN service_orders so ON a.service_order_id = so.id
    WHERE cpu.user_id = auth.uid()
      AND so.customer_id = cpu.customer_id
      AND cpu.is_active = true
  )
);