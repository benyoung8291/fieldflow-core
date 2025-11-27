-- Add RLS policies for customer portal users to access service orders and appointments

-- Allow customer portal users to view service orders for their customer
CREATE POLICY "Customer portal users can view their service orders"
ON service_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users
    WHERE customer_portal_users.user_id = auth.uid()
    AND customer_portal_users.customer_id = service_orders.customer_id
    AND customer_portal_users.is_active = true
  )
);

-- Allow customer portal users to view service order line items for their customer's orders
CREATE POLICY "Customer portal users can view their service order line items"
ON service_order_line_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM service_orders so
    JOIN customer_portal_users cpu ON cpu.customer_id = so.customer_id
    WHERE so.id = service_order_line_items.service_order_id
    AND cpu.user_id = auth.uid()
    AND cpu.is_active = true
  )
);

-- Allow customer portal users to view appointments for their customer
CREATE POLICY "Customer portal users can view their appointments"
ON appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM service_orders so
    JOIN customer_portal_users cpu ON cpu.customer_id = so.customer_id
    WHERE so.id = appointments.service_order_id
    AND cpu.user_id = auth.uid()
    AND cpu.is_active = true
  )
);

-- Allow customer portal users to view floor plans for their customer's locations
CREATE POLICY "Customer portal users can view their location floor plans"
ON floor_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_locations cl
    JOIN customer_portal_users cpu ON cpu.customer_id = cl.customer_id
    WHERE cl.id = floor_plans.customer_location_id
    AND cpu.user_id = auth.uid()
    AND cpu.is_active = true
  )
);