// Vercel Cron Job — runs daily to sync Xero items for every owner who has
// connected Xero. Mirrors the pattern in api/cron/process-emails.ts.

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Accept either a Vercel cron trigger or a manual call with CRON_SECRET.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cijgmmckafmfmmlpvgyi.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing service role key' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch every owner user that has an active Xero token. Join against
  // users to check role so we don't try to sync for non-owners.
  const ownersResponse = await fetch(
    `${supabaseUrl}/rest/v1/integration_tokens?provider=eq.xero&select=user_id,users(role)`,
    {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
    }
  );

  if (!ownersResponse.ok) {
    const body = await ownersResponse.text();
    return new Response(
      JSON.stringify({ error: 'Failed to list Xero-connected users', details: body }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rows = (await ownersResponse.json()) as Array<{
    user_id: string;
    users: { role: string } | null;
  }>;
  const owners = rows.filter((r) => r.users?.role === 'owner');

  const results: Array<{
    user_id: string;
    ok: boolean;
    status?: number;
    summary?: unknown;
    error?: string;
  }> = [];

  for (const { user_id } of owners) {
    try {
      const syncResponse = await fetch(
        `${supabaseUrl}/functions/v1/sync-xero-items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ user_id }),
        }
      );
      const summary = await syncResponse.json().catch(() => null);
      results.push({
        user_id,
        ok: syncResponse.ok,
        status: syncResponse.status,
        summary,
      });
    } catch (e) {
      results.push({ user_id, ok: false, error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      synced: results.length,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
