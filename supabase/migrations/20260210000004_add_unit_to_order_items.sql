-- Migration: Add unit column to order_items
-- This column stores the unit of measure for each order item (e.g., 'each', 'kg', 'pack')

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'each';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
