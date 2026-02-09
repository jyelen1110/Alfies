-- Gmail Integration - Store OAuth tokens for each tenant
CREATE TABLE gmail_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_gmail_connections_tenant ON gmail_connections(tenant_id);
CREATE INDEX idx_gmail_connections_active ON gmail_connections(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

-- Owners can view their own connection
CREATE POLICY "Owners can view gmail connections" ON gmail_connections
FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Owners can manage their own connection
CREATE POLICY "Owners can manage gmail connections" ON gmail_connections
FOR ALL USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_master = true)
);

-- Service role can do everything (for background processing)
CREATE POLICY "Service role full access" ON gmail_connections
FOR ALL USING (auth.role() = 'service_role');
