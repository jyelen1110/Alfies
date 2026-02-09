-- Customer-Supplier relationships table
-- Allows customers to connect with multiple suppliers/owners
CREATE TABLE IF NOT EXISTS customer_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending', 'inactive'
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, supplier_tenant_id)
);

-- Enable RLS
ALTER TABLE customer_suppliers ENABLE ROW LEVEL SECURITY;

-- Customers can see their own supplier relationships
CREATE POLICY "Customers can view own supplier relationships" ON customer_suppliers
FOR SELECT USING (customer_id = auth.uid());

-- Owners can see customers connected to their tenant
CREATE POLICY "Owners can view their customers" ON customer_suppliers
FOR SELECT USING (
  supplier_tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Owners can insert customer relationships for their tenant
CREATE POLICY "Owners can add customers" ON customer_suppliers
FOR INSERT WITH CHECK (
  supplier_tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Owners can update customer relationships for their tenant
CREATE POLICY "Owners can update their customers" ON customer_suppliers
FOR UPDATE USING (
  supplier_tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Customers can update their own relationships (e.g., accept invitation)
CREATE POLICY "Customers can update own relationships" ON customer_suppliers
FOR UPDATE USING (customer_id = auth.uid());

-- Update items RLS to allow customers to see items from connected suppliers
DROP POLICY IF EXISTS "Users can view tenant items" ON items;
CREATE POLICY "Users can view items from connected suppliers" ON items
FOR SELECT USING (
  -- Owner sees their own tenant's items
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR
  -- Customer sees items from connected suppliers
  tenant_id IN (
    SELECT supplier_tenant_id FROM customer_suppliers
    WHERE customer_id = auth.uid() AND status = 'active'
  )
  OR
  -- Master user sees all
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Update suppliers RLS to allow customers to see connected suppliers
DROP POLICY IF EXISTS "Users can view tenant suppliers" ON suppliers;
CREATE POLICY "Users can view suppliers from connected tenants" ON suppliers
FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR
  tenant_id IN (
    SELECT supplier_tenant_id FROM customer_suppliers
    WHERE customer_id = auth.uid() AND status = 'active'
  )
  OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Migrate existing customers to customer_suppliers table
-- This creates relationships for existing customers with their current tenant
INSERT INTO customer_suppliers (customer_id, supplier_tenant_id, status, accepted_at)
SELECT id, tenant_id, 'active', NOW()
FROM users
WHERE role = 'user'
ON CONFLICT (customer_id, supplier_tenant_id) DO NOTHING;
