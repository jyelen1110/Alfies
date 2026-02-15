-- Add push token column for notifications
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token ON public.users(push_token) WHERE push_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.users.push_token IS 'Expo push notification token for the user';
