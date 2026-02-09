-- Add master user support
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;

-- Create tenant_access table for master user to access all tenants
CREATE TABLE IF NOT EXISTS tenant_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'full', -- 'full', 'read_only'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS on tenant_access
ALTER TABLE tenant_access ENABLE ROW LEVEL SECURITY;

-- Master users can see all tenant_access records
CREATE POLICY "Master users can manage tenant access" ON tenant_access
FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Update users RLS to allow master users to see all users
CREATE POLICY "Master users can view all users" ON users
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Update tenants RLS to allow master users to see all tenants
CREATE POLICY "Master users can view all tenants" ON tenants
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Update orders RLS to allow master users to see all orders
CREATE POLICY "Master users can view all orders" ON orders
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Update invoices RLS to allow master users to see all invoices
CREATE POLICY "Master users can view all invoices" ON invoices
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Update items RLS to allow master users to see all items
CREATE POLICY "Master users can view all items" ON items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Add image_path column to items for device-uploaded images
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload item images
CREATE POLICY "Authenticated users can upload item images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'item-images' AND auth.role() = 'authenticated'
);

-- Allow public read access to item images
CREATE POLICY "Public can view item images" ON storage.objects
FOR SELECT USING (bucket_id = 'item-images');

-- Allow users to update/delete their own uploads
CREATE POLICY "Users can manage their item images" ON storage.objects
FOR ALL USING (
  bucket_id = 'item-images' AND auth.role() = 'authenticated'
);
