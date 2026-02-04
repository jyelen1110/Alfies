-- Migration: Add customer profile fields and update user_invitations
-- Run this migration on existing databases

-- Add customer profile fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS accounts_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- Update user_invitations table
-- First, check if token column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_invitations' AND column_name = 'token') THEN
    ALTER TABLE user_invitations ADD COLUMN token VARCHAR(64) UNIQUE;
  END IF;
END $$;

-- Add role column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_invitations' AND column_name = 'role') THEN
    ALTER TABLE user_invitations ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('owner', 'user'));
  END IF;
END $$;

-- Remove full_name and invited_by columns if they exist (no longer needed)
ALTER TABLE user_invitations DROP COLUMN IF EXISTS full_name;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS invited_by;

-- Create index on token if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);

-- Add RLS policy for users to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'users') THEN
    CREATE POLICY "Users can update own profile" ON users
      FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

-- Add RLS policy for anyone to update invitation on acceptance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update invitation on acceptance' AND tablename = 'user_invitations') THEN
    CREATE POLICY "Anyone can update invitation on acceptance" ON user_invitations
      FOR UPDATE USING (status = 'pending' AND expires_at > NOW())
      WITH CHECK (status = 'accepted');
  END IF;
END $$;
