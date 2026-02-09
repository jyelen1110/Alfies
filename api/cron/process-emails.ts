// Vercel Cron Job - runs every 5 minutes
// This endpoint triggers the Gmail order processing

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // Verify this is a cron request (Vercel adds this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow both Vercel cron and manual trigger with secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Check if it's from Vercel's cron
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    if (!isVercelCron) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cijgmmckafmfmmlpvgyi.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing service role key' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-gmail-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to process emails',
      details: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
