// Shared Xero utilities for Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
export const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
export const XERO_API_URL = 'https://api.xero.com/api.xro/2.0';
export const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

export interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface XeroConnection {
  id: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
}

export function getSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
}

export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export async function refreshXeroToken(refreshToken: string): Promise<XeroTokens | null> {
  const clientId = Deno.env.get('XERO_CLIENT_ID');
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Xero credentials not configured');
    return null;
  }

  const response = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    console.error('Failed to refresh Xero token:', await response.text());
    return null;
  }

  return response.json();
}

export async function getValidXeroToken(userId: string): Promise<{ accessToken: string; xeroTenantId: string } | null> {
  const supabase = getSupabaseAdmin();

  // Get stored tokens by user_id (user-based integrations)
  const { data: tokenData, error } = await supabase
    .from('integration_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'xero')
    .single();

  if (error || !tokenData) {
    console.error('No Xero token found for user:', userId);
    return null;
  }

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - bufferMs < now.getTime()) {
    // Token expired, refresh it
    const newTokens = await refreshXeroToken(tokenData.refresh_token);
    if (!newTokens) {
      return null;
    }

    // Update stored tokens
    const { error: updateError } = await supabase
      .from('integration_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);

    if (updateError) {
      console.error('Failed to update Xero tokens:', updateError);
      return null;
    }

    return {
      accessToken: newTokens.access_token,
      xeroTenantId: tokenData.xero_tenant_id,
    };
  }

  return {
    accessToken: tokenData.access_token,
    xeroTenantId: tokenData.xero_tenant_id,
  };
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
