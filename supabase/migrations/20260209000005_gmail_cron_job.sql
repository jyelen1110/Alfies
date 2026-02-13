-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the Gmail processing edge function
CREATE OR REPLACE FUNCTION public.trigger_gmail_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the edge function using pg_net
  PERFORM net.http_post(
    url := 'https://cijgmmckafmfmmlpvgyi.supabase.co/functions/v1/process-gmail-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule the job to run every 5 minutes
SELECT cron.schedule(
  'gmail-order-sync',           -- Job name
  '*/5 * * * *',                -- Every 5 minutes
  $$SELECT public.trigger_gmail_sync()$$
);

-- Add comment for documentation
COMMENT ON FUNCTION public.trigger_gmail_sync() IS 'Triggers the Gmail order sync edge function. Called automatically every 5 minutes by pg_cron.';
