-- Migration: Add xero_contact_id to users table
-- This links customers to their Xero contact record

ALTER TABLE users
ADD COLUMN IF NOT EXISTS xero_contact_id VARCHAR(100);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_xero_contact_id ON users(xero_contact_id);

NOTIFY pgrst, 'reload schema';
