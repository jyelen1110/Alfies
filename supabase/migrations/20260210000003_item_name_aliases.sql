-- Create item_name_aliases table for mapping incoming order item names to inventory items
-- This allows automatic matching of items with different names (e.g., "ALFIE'S CRUNCHY PEANUT BUTTER 800G" -> "Alfie's - Crunchy Peanut Butter Tub (800g)")

CREATE TABLE IF NOT EXISTS item_name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  alias_name VARCHAR(500) NOT NULL, -- The incoming name to match (normalized/lowercase)
  original_name VARCHAR(500), -- The original name as received (for reference)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, alias_name)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_item_aliases_lookup ON item_name_aliases(tenant_id, alias_name);
CREATE INDEX IF NOT EXISTS idx_item_aliases_item ON item_name_aliases(item_id);

-- RLS policies
ALTER TABLE item_name_aliases ENABLE ROW LEVEL SECURITY;

-- Owners and masters can manage aliases for their tenant
CREATE POLICY "Users can manage item aliases" ON item_name_aliases
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
