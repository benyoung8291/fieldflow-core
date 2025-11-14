-- Recreate foreign key constraints that were dropped with customer_contacts table

-- Customer locations foreign key
ALTER TABLE customer_locations
ADD CONSTRAINT customer_locations_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Projects foreign key
ALTER TABLE projects
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Quotes foreign key
ALTER TABLE quotes
ADD CONSTRAINT quotes_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;