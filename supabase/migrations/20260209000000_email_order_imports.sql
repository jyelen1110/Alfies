-- Email Order Imports - Track processed emails to prevent duplicates
CREATE TABLE email_order_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id VARCHAR(255) UNIQUE NOT NULL,  -- Apple Mail message ID
  sender VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'success',  -- 'success', 'failed', 'partial'
  error_message TEXT,
  raw_data JSONB,  -- Store original parsed data for debugging
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_imports_message ON email_order_imports(message_id);
CREATE INDEX idx_email_imports_tenant ON email_order_imports(tenant_id);
CREATE INDEX idx_email_imports_status ON email_order_imports(status);

-- Email Supplier Mappings - Map email addresses/patterns to suppliers
CREATE TABLE email_supplier_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email_pattern VARCHAR(255) NOT NULL,  -- e.g., "orders@supplier.com" or "@supplier.com"
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email_pattern)
);

CREATE INDEX idx_email_mappings_tenant ON email_supplier_mappings(tenant_id);
CREATE INDEX idx_email_mappings_supplier ON email_supplier_mappings(supplier_id);

-- RLS Policies for email_order_imports
ALTER TABLE email_order_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view email imports" ON email_order_imports
FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

CREATE POLICY "Service role can insert email imports" ON email_order_imports
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update email imports" ON email_order_imports
FOR UPDATE USING (true);

-- RLS Policies for email_supplier_mappings
ALTER TABLE email_supplier_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view email mappings" ON email_supplier_mappings
FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

CREATE POLICY "Owners can manage email mappings" ON email_supplier_mappings
FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);
