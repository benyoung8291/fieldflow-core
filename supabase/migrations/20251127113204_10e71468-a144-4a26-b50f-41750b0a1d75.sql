-- Create storage bucket for floor plans (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'floor-plans',
  'floor-plans',
  true,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

-- Update existing floor_plans table structure
-- Rename location_id to customer_location_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE floor_plans RENAME COLUMN location_id TO customer_location_id;
  END IF;
END $$;

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add file_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN file_name TEXT;
  END IF;

  -- Add file_path if it doesn't exist (but keep file_url for backward compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN file_path TEXT;
  END IF;

  -- Add file_size if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN file_size INTEGER;
  END IF;

  -- Add file_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN file_type TEXT;
  END IF;

  -- Add floor_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'floor_number'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN floor_number INTEGER;
  END IF;

  -- Add description if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'description'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN description TEXT;
  END IF;

  -- Add uploaded_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'floor_plans' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE floor_plans ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Make customer_location_id NOT NULL and add FK if not already there
ALTER TABLE floor_plans 
  ALTER COLUMN customer_location_id SET NOT NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'floor_plans_customer_location_id_fkey'
  ) THEN
    ALTER TABLE floor_plans 
      ADD CONSTRAINT floor_plans_customer_location_id_fkey 
      FOREIGN KEY (customer_location_id) REFERENCES customer_locations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_floor_plans_location ON floor_plans(customer_location_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_tenant ON floor_plans(tenant_id);

-- Enable RLS
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Office users can view floor plans in their tenant" ON floor_plans;
DROP POLICY IF EXISTS "Office users can create floor plans in their tenant" ON floor_plans;
DROP POLICY IF EXISTS "Office users can update floor plans in their tenant" ON floor_plans;
DROP POLICY IF EXISTS "Office users can delete floor plans in their tenant" ON floor_plans;
DROP POLICY IF EXISTS "Customer portal users can view their customer's floor plans" ON floor_plans;

-- Office users can view floor plans for their tenant
CREATE POLICY "Office users can view floor plans in their tenant"
ON floor_plans
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Office users can create floor plans in their tenant
CREATE POLICY "Office users can create floor plans in their tenant"
ON floor_plans
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Office users can update floor plans in their tenant
CREATE POLICY "Office users can update floor plans in their tenant"
ON floor_plans
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Office users can delete floor plans in their tenant
CREATE POLICY "Office users can delete floor plans in their tenant"
ON floor_plans
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Customer portal users can view floor plans for their customer's locations
CREATE POLICY "Customer portal users can view their customer's floor plans"
ON floor_plans
FOR SELECT
TO authenticated
USING (
  customer_location_id IN (
    SELECT cl.id
    FROM customer_locations cl
    INNER JOIN customer_portal_users cpu ON cpu.customer_id = cl.customer_id
    WHERE cpu.user_id = auth.uid()
    AND cpu.is_active = true
  )
);

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Office users can upload floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Office users can update floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Office users can delete floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view floor plans" ON storage.objects;

-- Storage policies for floor-plans bucket
-- Office users can upload floor plans
CREATE POLICY "Office users can upload floor plans"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'floor-plans' 
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Office users can update their tenant's floor plans
CREATE POLICY "Office users can update floor plans"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Office users can delete their tenant's floor plans
CREATE POLICY "Office users can delete floor plans"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Anyone authenticated can view floor plans (public bucket)
CREATE POLICY "Authenticated users can view floor plans"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'floor-plans');

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_floor_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_floor_plans_updated_at ON floor_plans;
CREATE TRIGGER trigger_update_floor_plans_updated_at
BEFORE UPDATE ON floor_plans
FOR EACH ROW
EXECUTE FUNCTION update_floor_plans_updated_at();