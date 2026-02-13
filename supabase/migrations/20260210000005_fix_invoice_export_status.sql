-- Fix invoice status constraint to allow 'export_failed'
-- Also ensure export_error column exists

-- Drop the old constraint and add a new one with 'export_failed'
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'paid', 'exported', 'cancelled', 'export_failed'));

-- Add export_error column if it doesn't exist
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS export_error TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
