-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to sync Xero items for all connected users
CREATE OR REPLACE FUNCTION sync_xero_items_for_all_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  result json;
BEGIN
  -- Loop through all users with active Xero connections
  FOR user_record IN
    SELECT DISTINCT it.user_id, u.tenant_id
    FROM integration_tokens it
    JOIN users u ON u.id = it.user_id
    WHERE it.provider = 'xero'
      AND it.access_token IS NOT NULL
      AND u.role = 'owner'
  LOOP
    BEGIN
      -- Call the Supabase edge function for each user
      -- Note: This uses the pg_net extension to make HTTP requests
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-xero-items',
        headers := json_build_object(
          'Content-Type', 'application/json',
          'apikey', current_setting('app.settings.supabase_anon_key'),
          'Authorization', 'Bearer ' || (
            SELECT access_token FROM integration_tokens
            WHERE user_id = user_record.user_id AND provider = 'xero'
          )
        )::jsonb
      ) INTO result;

      RAISE NOTICE 'Synced items for user %: %', user_record.user_id, result;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to sync for user %: %', user_record.user_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Schedule the sync to run every hour
SELECT cron.schedule(
  'xero-items-hourly-sync',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT sync_xero_items_for_all_users()$$
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_xero_items_for_all_users() TO postgres;

COMMENT ON FUNCTION sync_xero_items_for_all_users() IS
'Syncs items from Xero to the app for all users with connected Xero accounts. Runs hourly via pg_cron.';
