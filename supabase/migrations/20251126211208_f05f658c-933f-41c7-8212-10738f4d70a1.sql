-- Add facility manager and site contact links to customer_locations
ALTER TABLE public.customer_locations
ADD COLUMN facility_manager_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
ADD COLUMN site_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Remove the old text-based contact fields since they're being replaced
ALTER TABLE public.customer_locations
DROP COLUMN contact_name,
DROP COLUMN contact_phone,
DROP COLUMN contact_email;

-- Add index for better query performance
CREATE INDEX idx_customer_locations_facility_manager ON public.customer_locations(facility_manager_contact_id);
CREATE INDEX idx_customer_locations_site_contact ON public.customer_locations(site_contact_id);