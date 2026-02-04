-- Migration: Add Xero integration tables
-- Created: 2026-02-04

-- Table for storing OAuth tokens (Xero, etc.)
CREATE TABLE IF NOT EXISTS integration_tokens (
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

-- Table for storing OAuth state for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state VARCHAR(255) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider VARCHAR(50) NOT NULL,
  code_verifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster state lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_integration_tokens_tenant_provider ON integration_tokens(tenant_id, provider);

-- Add xero columns to tenants table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'xero_tenant_id') THEN
    ALTER TABLE tenants ADD COLUMN xero_tenant_id VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'xero_connected_at') THEN
    ALTER TABLE tenants ADD COLUMN xero_connected_at TIMESTAMPTZ;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS policies for integration_tokens
CREATE POLICY "Owners can view their tenant's tokens" ON integration_tokens
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Service role can manage tokens" ON integration_tokens
  FOR ALL USING (true);

-- RLS policies for oauth_states (service role only, Edge Functions use service role)
CREATE POLICY "Service role can manage oauth states" ON oauth_states
  FOR ALL USING (true);
