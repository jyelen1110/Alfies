-- Add categories array column to items table (keeping category for backwards compatibility)
ALTER TABLE items ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- Migrate existing category data to categories array
UPDATE items
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND category != '' AND (categories IS NULL OR categories = '{}');

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_items_categories ON items USING GIN(categories);
