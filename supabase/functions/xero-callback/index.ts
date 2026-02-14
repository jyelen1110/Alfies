// Xero OAuth Callback - Exchange code for tokens
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { XERO_TOKEN_URL, XERO_CONNECTIONS_URL, corsHeaders } from '../_shared/xero.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(generateErrorHtml(`Xero authorization failed: ${error}`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code || !state) {
      return new Response(generateErrorHtml('Missing code or state parameter'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify state
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'xero')
      .single();

    if (stateError || !stateData) {
      return new Response(generateErrorHtml('Invalid state parameter'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Delete used state
    await supabaseAdmin.from('oauth_states').delete().eq('state', state);

    // Check if state is expired (15 minutes)
    const createdAt = new Date(stateData.created_at);
    const now = new Date();
    if (now.getTime() - createdAt.getTime() > 15 * 60 * 1000) {
      return new Response(generateErrorHtml('Authorization expired. Please try again.'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');
    const redirectUri = Deno.env.get('XERO_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(generateErrorHtml('Xero not configured'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(generateErrorHtml('Failed to exchange authorization code'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const tokens = await tokenResponse.json();

    // Get Xero tenant (organization) info
    const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!connectionsResponse.ok) {
      console.error('Failed to get Xero connections');
      return new Response(generateErrorHtml('Failed to get Xero organization'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const connections = await connectionsResponse.json();
    if (!connections || connections.length === 0) {
      return new Response(generateErrorHtml('No Xero organization found'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Use the first connected organization
    const xeroTenant = connections[0];

    // Store tokens in database
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert the integration token (keyed by user_id)
    const { error: upsertError } = await supabaseAdmin
      .from('integration_tokens')
      .upsert(
        {
          user_id: stateData.user_id,
          tenant_id: stateData.tenant_id,
          provider: 'xero',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          xero_tenant_id: xeroTenant.tenantId,
          scopes: tokens.scope,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,provider',
        }
      );

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      return new Response(generateErrorHtml('Failed to save connection'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Return success page that closes the window
    return new Response(generateSuccessHtml(xeroTenant.tenantName), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Xero callback error:', error);
    return new Response(generateErrorHtml('An unexpected error occurred'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

function generateSuccessHtml(orgName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Xero Connected</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #13B5EA;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      margin-bottom: 20px;
    }
    .org-name {
      font-weight: bold;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#10003;</div>
    <h1>Xero Connected!</h1>
    <p>Successfully connected to <span class="org-name">${orgName}</span></p>
    <p>You can close this window and return to the app.</p>
  </div>
  <script>
    // Notify the app if opened from WebBrowser
    if (window.opener) {
      window.opener.postMessage({ type: 'xero-connected', success: true }, '*');
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>
  `;
}

function generateErrorHtml(message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Xero Connection Failed</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
      color: #dc3545;
    }
    h1 {
      color: #dc3545;
      margin-bottom: 10px;
    }
    p {
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#10007;</div>
    <h1>Connection Failed</h1>
    <p>${message}</p>
    <p>Please close this window and try again.</p>
  </div>
</body>
</html>
  `;
}
