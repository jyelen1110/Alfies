-- Backfill customer_id on invoices from their linked orders

-- Step 1: Update orders that don't have customer_id but have created_by (customer who placed the order)
UPDATE orders o
SET customer_id = o.created_by
WHERE o.customer_id IS NULL
  AND o.created_by IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = o.created_by
    AND (u.role = 'user' OR u.tenant_id != o.tenant_id)
  );

-- Step 2: Update invoices with customer_id from their linked orders
UPDATE invoices i
SET customer_id = o.customer_id
FROM orders o
WHERE i.order_id = o.id
  AND i.customer_id IS NULL
  AND o.customer_id IS NOT NULL;

-- Log how many records were updated
DO $$
DECLARE
  orders_updated INT;
  invoices_updated INT;
BEGIN
  GET DIAGNOSTICS invoices_updated = ROW_COUNT;
  RAISE NOTICE 'Backfill complete: invoices updated with customer_id';
END $$;
