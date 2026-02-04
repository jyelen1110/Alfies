-- Migration: Add Xero codes to order_items
-- This allows storing xero_item_code and xero_account_code with each order line

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS xero_item_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS xero_account_code VARCHAR(50);

NOTIFY pgrst, 'reload schema';
