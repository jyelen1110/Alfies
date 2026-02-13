-- Add xero_item_code to items table for Xero integration
ALTER TABLE items
ADD COLUMN IF NOT EXISTS xero_item_code VARCHAR(50);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_xero_item_code ON items(xero_item_code);

NOTIFY pgrst, 'reload schema';
