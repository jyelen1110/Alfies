-- Add customer_id to invoices for linking to customers
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id);

-- Add field to track when invoice is shared with customer
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS shared_with_customer_at TIMESTAMPTZ;

-- Add index for faster customer queries
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shared_with_customer
ON public.invoices(customer_id, shared_with_customer_at)
WHERE shared_with_customer_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.invoices.customer_id IS 'The customer (user) this invoice is for';
COMMENT ON COLUMN public.invoices.shared_with_customer_at IS 'Timestamp when invoice was shared with customer (after Xero export)';
