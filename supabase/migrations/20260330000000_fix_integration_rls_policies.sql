-- Fix RLS policies for integration_tokens and gmail_connections
-- These tables now use user_id instead of tenant_id (from migration 20260214000001)
-- But the RLS policies were never updated

-- Drop old policies that use tenant_id
DROP POLICY IF EXISTS "Owners can manage integration tokens" ON integration_tokens;
DROP POLICY IF EXISTS "Users can view integration_tokens" ON integration_tokens;

-- Create new policies using user_id
CREATE POLICY "Users can manage their own integration tokens" ON integration_tokens
  FOR ALL USING (user_id = auth.uid());

-- Add RLS for gmail_connections if not exists
DROP POLICY IF EXISTS "Owners can manage gmail connections" ON gmail_connections;
DROP POLICY IF EXISTS "Users can view gmail connections" ON gmail_connections;

CREATE POLICY "Users can manage their own gmail connections" ON gmail_connections
  FOR ALL USING (user_id = auth.uid());

-- Also check oauth_states
DROP POLICY IF EXISTS "Owners can manage oauth states" ON oauth_states;
DROP POLICY IF EXISTS "Users can view oauth states" ON oauth_states;

CREATE POLICY "Users can manage their own oauth states" ON oauth_states
  FOR ALL USING (user_id = auth.uid());
