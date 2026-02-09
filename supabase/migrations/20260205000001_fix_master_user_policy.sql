-- Fix infinite recursion in users table policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Master users can view all users" ON users;

-- Create a function to check if current user is master (avoids recursion)
CREATE OR REPLACE FUNCTION is_master_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND is_master = true
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the policy using the function with SECURITY DEFINER
-- This avoids recursion because the function runs with elevated privileges
CREATE POLICY "Master users can view all users" ON users
FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  OR is_master_user()
);
