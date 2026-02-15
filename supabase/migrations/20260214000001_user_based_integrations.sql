-- Add user_id to integration_tokens and gmail_connections for user-based integrations

-- Add user_id to integration_tokens
ALTER TABLE public.integration_tokens
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add user_id to gmail_connections
ALTER TABLE public.gmail_connections
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add user_id to oauth_states
ALTER TABLE public.oauth_states
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Drop old unique constraints if they exist
ALTER TABLE public.integration_tokens
DROP CONSTRAINT IF EXISTS integration_tokens_tenant_id_provider_key;

ALTER TABLE public.gmail_connections
DROP CONSTRAINT IF EXISTS gmail_connections_tenant_id_key;

-- Add new unique constraints based on user_id (drop first if exists)
ALTER TABLE public.integration_tokens
DROP CONSTRAINT IF EXISTS integration_tokens_user_id_provider_key;
ALTER TABLE public.integration_tokens
ADD CONSTRAINT integration_tokens_user_id_provider_key UNIQUE (user_id, provider);

ALTER TABLE public.gmail_connections
DROP CONSTRAINT IF EXISTS gmail_connections_user_id_key;
ALTER TABLE public.gmail_connections
ADD CONSTRAINT gmail_connections_user_id_key UNIQUE (user_id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_integration_tokens_user_id ON public.integration_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);
