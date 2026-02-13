-- Create a trigger that automatically marks invitations as accepted when a user registers
-- This ensures invitations are always updated even if RLS blocks the client-side update

-- Function to mark invitation as accepted when user is created
CREATE OR REPLACE FUNCTION public.mark_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
  -- Update any pending invitation for this email to accepted
  UPDATE public.user_invitations
  SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE
    email = NEW.email
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists then recreate
DROP TRIGGER IF EXISTS on_user_created_mark_invitation ON public.users;

CREATE TRIGGER on_user_created_mark_invitation
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_invitation_accepted();

-- Also update any existing users who have pending invitations (one-time fix)
UPDATE public.user_invitations inv
SET
  status = 'accepted',
  accepted_at = NOW()
WHERE
  inv.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.email = inv.email
  );
