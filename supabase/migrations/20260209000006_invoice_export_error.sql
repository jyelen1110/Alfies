-- Add export_error column to invoices table
-- This stores the error message when Xero export fails

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS export_error TEXT;

-- Add comment for documentation
COMMENT ON COLUMN invoices.export_error IS 'Error message from failed Xero export attempt';
