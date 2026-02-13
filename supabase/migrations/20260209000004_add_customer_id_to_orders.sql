-- Add customer_id to orders table for linking orders to customers
-- This field is optional (nullable) but required for Xero export

ALTER TABLE orders
ADD COLUMN customer_id UUID REFERENCES users(id);

-- Create index for faster customer lookups
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- Add comment explaining the field
COMMENT ON COLUMN orders.customer_id IS 'The customer (user) this order is FOR. Required for Xero export. Can be different from created_by for email-imported orders.';
