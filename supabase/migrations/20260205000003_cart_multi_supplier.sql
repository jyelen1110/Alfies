-- Update cart_items RLS to support multi-supplier customers

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

-- View: Users can see their own cart items
CREATE POLICY "Users can view own cart items" ON cart_items
FOR SELECT USING (user_id = auth.uid());

-- Insert: Users can add cart items
-- For customers: tenant_id must be from a connected supplier
-- For owners: tenant_id must be their own tenant
CREATE POLICY "Users can insert own cart items" ON cart_items
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (
    -- Owner can insert to their own tenant
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    OR
    -- Customer can insert to connected supplier tenants
    tenant_id IN (
      SELECT supplier_tenant_id FROM customer_suppliers
      WHERE customer_id = auth.uid() AND status = 'active'
    )
  )
);

-- Update: Users can update their own cart items
CREATE POLICY "Users can update own cart items" ON cart_items
FOR UPDATE USING (user_id = auth.uid());

-- Delete: Users can delete their own cart items
CREATE POLICY "Users can delete own cart items" ON cart_items
FOR DELETE USING (user_id = auth.uid());

-- Also need to update orders RLS for customers to create orders in supplier tenants
DROP POLICY IF EXISTS "Users can insert orders" ON orders;
CREATE POLICY "Users can insert orders" ON orders
FOR INSERT WITH CHECK (
  -- Owner can insert to their own tenant
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR
  -- Customer can insert orders to connected supplier tenants
  (
    tenant_id IN (
      SELECT supplier_tenant_id FROM customer_suppliers
      WHERE customer_id = auth.uid() AND status = 'active'
    )
    AND created_by = auth.uid()
  )
);

-- Update order_items RLS similarly
DROP POLICY IF EXISTS "Users can insert order items" ON order_items;
CREATE POLICY "Users can insert order items" ON order_items
FOR INSERT WITH CHECK (
  -- Owner can insert to their own tenant
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR
  -- Customer can insert to connected supplier tenants
  tenant_id IN (
    SELECT supplier_tenant_id FROM customer_suppliers
    WHERE customer_id = auth.uid() AND status = 'active'
  )
);

-- Update orders SELECT policy to let customers see their orders
DROP POLICY IF EXISTS "Users can view orders" ON orders;
CREATE POLICY "Users can view orders" ON orders
FOR SELECT USING (
  -- Owner sees all orders for their tenant
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR
  -- Customer sees orders they created
  created_by = auth.uid()
  OR
  -- Master sees all
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);
