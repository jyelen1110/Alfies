// Xero OAuth Callback Handler
// Receives the OAuth code from Xero and exchanges it for tokens

export const config = {
  runtime: 'edge',
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cijgmmckafmfmmlpvgyi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamdtbWNrYWZtZm1tbHB2Z3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjQzNTgsImV4cCI6MjA4NTYwMDM1OH0.nwe0aDmwCKGbdFHwiWhEv6aeonwwOO1mmLQTQw2wuFU';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = 'https://easy-ordering.vercel.app';

  // Handle errors from Xero
  if (error) {
    return Response.redirect(`${appUrl}?xero_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}?xero_error=missing_params`);
  }

  try {
    // Call the xero-callback edge function to exchange the code
    const callbackUrl = `${SUPABASE_URL}/functions/v1/xero-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    const response = await fetch(callbackUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
    });

    // Check if the response is HTML (success or error page)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      const html = await response.text();

      // Check if it's a success page (contains "Xero Connected!")
      if (html.includes('Xero Connected!')) {
        // Extract org name if possible
        const orgMatch = html.match(/<span class="org-name">([^<]+)<\/span>/);
        const orgName = orgMatch ? orgMatch[1] : '';
        return Response.redirect(`${appUrl}?xero_connected=true&org=${encodeURIComponent(orgName)}`);
      } else {
        // It's an error page
        const errorMatch = html.match(/<p>([^<]+)<\/p>/);
        const errorMsg = errorMatch ? errorMatch[1] : 'Connection failed';
        return Response.redirect(`${appUrl}?xero_error=${encodeURIComponent(errorMsg)}`);
      }
    }

    // If not HTML, try to parse as JSON
    const result = await response.json();
    if (response.ok && result.success) {
      return Response.redirect(`${appUrl}?xero_connected=true&org=${encodeURIComponent(result.org || '')}`);
    } else {
      return Response.redirect(`${appUrl}?xero_error=${encodeURIComponent(result.error || 'unknown')}`);
    }
  } catch (err) {
    return Response.redirect(`${appUrl}?xero_error=callback_failed`);
  }
}
