-- Fix RLS policies for customer portal access to appointments, field reports, and service orders

-- Drop existing customer portal policies if they exist
DROP POLICY IF EXISTS "customer_portal_appointments_select" ON appointments;
DROP POLICY IF EXISTS "customer_portal_field_reports_select" ON field_reports;

-- Create policy for customer portal users to view their appointments
CREATE POLICY "customer_portal_appointments_select" ON appointments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    JOIN service_orders so ON so.id = appointments.service_order_id
    WHERE cpu.user_id = auth.uid()
    AND so.customer_id = cpu.customer_id
    AND cpu.is_active = true
  )
);

-- Create policy for customer portal users to view approved field reports
CREATE POLICY "customer_portal_field_reports_select" ON field_reports
FOR SELECT TO authenticated
USING (
  status = 'approved' AND
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    JOIN appointments apt ON apt.id = field_reports.appointment_id
    JOIN service_orders so ON so.id = apt.service_order_id
    WHERE cpu.user_id = auth.uid()
    AND so.customer_id = cpu.customer_id
    AND cpu.is_active = true
  )
);