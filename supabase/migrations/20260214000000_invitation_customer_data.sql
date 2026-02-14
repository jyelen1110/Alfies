-- Add customer_data column to store pre-filled customer information
ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS customer_data JSONB;

-- Add comment for clarity
COMMENT ON COLUMN public.user_invitations.customer_data IS 'Pre-filled customer details (business_name, contact_name, phone, address, etc.)';
