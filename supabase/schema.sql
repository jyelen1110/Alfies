-- Alfie's Food Co. Ordering App - Full Database Schema
-- Run this against a fresh Supabase project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TENANTS
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{
    "currency": "AUD",
    "timezone": "Australia/Sydney",
    "date_format": "DD/MM/YYYY",
    "tax_rate": 10
  }'::jsonb,
  xero_tenant_id VARCHAR(100),
  xero_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'user')),
  -- Customer profile fields
  customer_id VARCHAR(50), -- Owner-assigned customer ID
  business_name VARCHAR(255),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  accounts_email VARCHAR(255),
  delivery_address TEXT,
  delivery_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER INVITATIONS
-- ============================================
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'user')),
  token VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- ============================================
-- SUPPLIERS
-- ============================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  orders_email VARCHAR(255),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  product_count INTEGER DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  free_delivery_min NUMERIC(10,2),
  min_order NUMERIC(10,2) DEFAULT 0,
  cutoff_time VARCHAR(5),
  delivery_days JSONB DEFAULT '[]'::jsonb,
  next_delivery DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ITEMS (Products)
-- ============================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  country_of_origin VARCHAR(100),
  size VARCHAR(50),
  carton_size INTEGER,
  purchase_price NUMERIC(10,2),
  wholesale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  carton_price NUMERIC(10,2),
  rrp NUMERIC(10,2),
  barcode VARCHAR(50),
  tax_rate INTEGER DEFAULT 10,
  xero_account_code VARCHAR(50),
  xero_item_code VARCHAR(50),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold_out')),
  image_url TEXT,
  is_favourite BOOLEAN DEFAULT false,
  import_batch_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CART ITEMS
-- ============================================
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  location_id UUID,
  order_number VARCHAR(100),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_delivery_date DATE,
  actual_delivery_date DATE,
  subtotal NUMERIC(10,2),
  tax NUMERIC(10,2) DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending_approval' CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'sent', 'delivered', 'cancelled')
  ),
  notes TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  procurement_item_id UUID REFERENCES items(id),
  code VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'each',
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2),
  received_quantity NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  order_id UUID REFERENCES orders(id),
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'exported', 'cancelled')
  ),
  match_status VARCHAR(30) DEFAULT 'unmatched' CHECK (
    match_status IN ('matched', 'matched_with_variance', 'unmatched')
  ),
  variance_amount NUMERIC(10,2),
  file_url TEXT,
  xero_invoice_id TEXT,
  exported_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICE ITEMS
-- ============================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  procurement_item_id UUID REFERENCES items(id),
  order_item_id UUID REFERENCES order_items(id),
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- XERO INTEGRATION TOKENS
-- ============================================
CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  xero_tenant_id VARCHAR(100),
  scopes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(255) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider VARCHAR(50) NOT NULL,
  code_verifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_user_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX idx_items_tenant ON items(tenant_id);
CREATE INDEX idx_items_supplier ON items(supplier_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_favourite ON items(tenant_id) WHERE is_favourite = true;
CREATE INDEX idx_cart_user ON cart_items(user_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_supplier ON orders(supplier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_pending ON orders(status) WHERE status = 'pending_approval';
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================
-- HELPER FUNCTIONS FOR RLS (must be created before policies)
-- ============================================

-- Get current user's tenant_id without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is an owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'owner' FROM public.users WHERE id = auth.uid()), false)
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Tenants: users can view their own tenant
CREATE POLICY "Users can view own tenant" ON tenants
  FOR SELECT USING (id = public.get_current_tenant_id());

CREATE POLICY "Owners can update own tenant" ON tenants
  FOR UPDATE USING (id = public.get_current_tenant_id() AND public.is_owner());

-- Users: can view users in their tenant
-- Note: Users can always read their own row, plus all users in their tenant
CREATE POLICY "Users can view tenant users" ON users
  FOR SELECT USING (id = auth.uid() OR tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Owners can insert tenant users" ON users
  FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id() AND public.is_owner());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Owners can update tenant users" ON users
  FOR UPDATE USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

CREATE POLICY "Owners can delete tenant users" ON users
  FOR DELETE USING (
    tenant_id = public.get_current_tenant_id() AND public.is_owner() AND id != auth.uid()
  );

-- Suppliers: tenant-scoped CRUD
CREATE POLICY "Users can view tenant suppliers" ON suppliers
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Owners can manage suppliers" ON suppliers
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- Items: tenant-scoped
CREATE POLICY "Users can view tenant items" ON items
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update item favourites" ON items
  FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Owners can manage items" ON items
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- Cart: user's own cart
CREATE POLICY "Users can view own cart" ON cart_items
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own cart" ON cart_items
  FOR ALL USING (user_id = auth.uid());

-- Orders: tenant-scoped with role-based updates
CREATE POLICY "Users can view tenant orders" ON orders
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Owners can update any tenant order" ON orders
  FOR UPDATE USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

CREATE POLICY "Users can update own pending orders" ON orders
  FOR UPDATE USING (created_by = auth.uid() AND status IN ('draft', 'pending_approval'));

CREATE POLICY "Owners can delete tenant orders" ON orders
  FOR DELETE USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- Order items: follow order access
CREATE POLICY "Users can view tenant order items" ON order_items
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can create order items" ON order_items
  FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Owners can manage order items" ON order_items
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- Invoices: tenant-scoped
CREATE POLICY "Users can view tenant invoices" ON invoices
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Owners can manage invoices" ON invoices
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- Invoice items: follow invoice access
CREATE POLICY "Users can view tenant invoice items" ON invoice_items
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Owners can manage invoice items" ON invoice_items
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- Integration tokens: owner only
CREATE POLICY "Owners can manage integration tokens" ON integration_tokens
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

-- User invitations: owner only for management, anyone can check by token
CREATE POLICY "Owners can manage invitations" ON user_invitations
  FOR ALL USING (tenant_id = public.get_current_tenant_id() AND public.is_owner());

CREATE POLICY "Anyone can check pending invitations by token" ON user_invitations
  FOR SELECT USING (status = 'pending' AND expires_at > NOW());

CREATE POLICY "Anyone can update invitation on acceptance" ON user_invitations
  FOR UPDATE USING (status = 'pending' AND expires_at > NOW())
  WITH CHECK (status = 'accepted');

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
