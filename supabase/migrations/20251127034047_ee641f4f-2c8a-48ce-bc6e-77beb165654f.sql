-- RLS Policies for customers table (customer role can only see their own customer record)
CREATE POLICY "Customers can view their own customer record"
ON public.customers
FOR SELECT
TO authenticated
USING (
  id = public.get_user_customer_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer'
  )
);

-- RLS Policies for customer_locations (customers can see their locations)
CREATE POLICY "Customers can view their locations"
ON public.customer_locations
FOR SELECT
TO authenticated
USING (
  customer_id = public.get_user_customer_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer'
  )
);

-- RLS Policies for service_orders (customers can see their orders)
CREATE POLICY "Customers can view their service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (
  customer_id = public.get_user_customer_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer'
  )
);

-- RLS Policies for appointments (customers can see appointments for their locations)
CREATE POLICY "Customers can view their appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_orders so
    WHERE so.id = appointments.service_order_id
    AND so.customer_id = public.get_user_customer_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'customer'
    )
  )
);

-- RLS Policies for floor_plans
CREATE POLICY "Customers can view floor plans for their locations"
ON public.floor_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_locations cl
    WHERE cl.id = floor_plans.location_id
    AND cl.customer_id = public.get_user_customer_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'customer'
    )
  )
);

CREATE POLICY "Staff can manage all floor plans in their tenant"
ON public.floor_plans
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for tasks (customers can view and create tasks for their locations)
CREATE POLICY "Customers can view their tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  customer_id = public.get_user_customer_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer'
  )
);

CREATE POLICY "Customers can create tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = public.get_user_customer_id(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer'
  )
);

-- RLS Policies for task_markups
CREATE POLICY "Customers can view markups for their tasks"
ON public.task_markups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_markups.task_id
    AND t.customer_id = public.get_user_customer_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'customer'
    )
  )
);

CREATE POLICY "Customers can create markups for their tasks"
ON public.task_markups
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_markups.task_id
    AND t.customer_id = public.get_user_customer_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'customer'
    )
  )
);

CREATE POLICY "Staff can manage all markups in their tenant"
ON public.task_markups
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());