-- Migration: Add procurement_item_id to order_items
-- This column links order items to the master items catalog

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS procurement_item_id UUID REFERENCES items(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_procurement_item_id ON order_items(procurement_item_id);
