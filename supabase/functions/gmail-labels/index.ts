import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tenantId } = await req.json()

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the Gmail connection for this tenant
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: connection, error: connError } = await supabase
      .from('gmail_connections')
      .select('access_token, refresh_token, token_expiry')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single()

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Gmail not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token needs refresh
    let accessToken = connection.access_token
    if (new Date(connection.token_expiry) < new Date()) {
      // Refresh the token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!refreshResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const tokens = await refreshResponse.json()
      accessToken = tokens.access_token

      // Update the stored token
      await supabase
        .from('gmail_connections')
        .update({
          access_token: tokens.access_token,
          token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq('tenant_id', tenantId)
    }

    // Fetch labels from Gmail API
    const labelsResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!labelsResponse.ok) {
      const error = await labelsResponse.text()
      console.error('Gmail API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch labels' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const labelsData = await labelsResponse.json()

    // Filter and format labels - include system labels and user labels
    const labels = labelsData.labels
      .filter((label: any) => {
        // Include INBOX, user labels, and category labels
        return label.type === 'user' ||
               ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD'].includes(label.id) ||
               label.id.startsWith('CATEGORY_')
      })
      .map((label: any) => ({
        id: label.id,
        name: label.name,
        type: label.type,
      }))
      .sort((a: any, b: any) => {
        // Sort: INBOX first, then system labels, then user labels alphabetically
        if (a.id === 'INBOX') return -1
        if (b.id === 'INBOX') return 1
        if (a.type === 'system' && b.type === 'user') return -1
        if (a.type === 'user' && b.type === 'system') return 1
        return a.name.localeCompare(b.name)
      })

    return new Response(
      JSON.stringify({ labels }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
