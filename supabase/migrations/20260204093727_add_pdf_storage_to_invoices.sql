-- Add pdf_storage_path column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read their tenant's invoice PDFs
CREATE POLICY "Users can read their tenant invoice PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-pdfs' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM users WHERE id = auth.uid()
  )
);

-- Allow service role to insert PDFs (for edge functions)
CREATE POLICY "Service role can insert invoice PDFs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'invoice-pdfs');
