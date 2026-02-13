-- Add is_archived column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_invoices_archived ON invoices(tenant_id, is_archived);

COMMENT ON COLUMN invoices.is_archived IS 'Whether the invoice is archived and hidden from the main list';
