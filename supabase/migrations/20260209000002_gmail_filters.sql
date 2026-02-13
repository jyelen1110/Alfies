-- Add filter columns to gmail_connections
ALTER TABLE gmail_connections
ADD COLUMN IF NOT EXISTS filter_sender VARCHAR(255),
ADD COLUMN IF NOT EXISTS filter_subject VARCHAR(255),
ADD COLUMN IF NOT EXISTS filter_label VARCHAR(255) DEFAULT 'INBOX';
