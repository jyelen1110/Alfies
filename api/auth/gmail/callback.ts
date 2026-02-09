// Gmail OAuth Callback Handler
// Receives the OAuth code from Google and exchanges it for tokens

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = 'https://easy-ordering.vercel.app';
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cijgmmckafmfmmlpvgyi.supabase.co';

  // Handle errors from Google
  if (error) {
    return Response.redirect(`${appUrl}?gmail_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}?gmail_error=missing_params`);
  }

  try {
    // Call the gmail-callback edge function to exchange the code
    const response = await fetch(`${supabaseUrl}/functions/v1/gmail-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
