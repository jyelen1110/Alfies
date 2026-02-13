// Gmail OAuth Callback Handler
// Receives the OAuth code from Google and exchanges it for tokens

export const config = {
  runtime: 'edge',
};

const SUPABASE_URL = 'https://cijgmmckafmfmmlpvgyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamdtbWNrYWZtZm1tbHB2Z3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjQzNTgsImV4cCI6MjA4NTYwMDM1OH0.nwe0aDmwCKGbdFHwiWhEv6aeonwwOO1mmLQTQw2wuFU';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = 'https://easy-ordering.vercel.app';

  // Handle errors from Google
  if (error) {
    return Response.redirect(`${appUrl}?gmail_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}?gmail_error=missing_params`);
  }

  try {
    // Call the gmail-callback edge function to exchange the code
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ code, state }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      return Response.redirect(`${appUrl}?gmail_connected=true&email=${encodeURIComponent(result.email || '')}`);
    } else {
      return Response.redirect(`${appUrl}?gmail_error=${encodeURIComponent(result.error || 'unknown')}`);
    }
  } catch (err) {
    return Response.redirect(`${appUrl}?gmail_error=callback_failed`);
  }
}
