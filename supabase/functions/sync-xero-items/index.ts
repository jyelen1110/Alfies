// Sync items from Xero to Alfie's app
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use JWT_ANON_KEY for token verification
    const jwtKey = Deno.env.get('JWT_ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      jwtKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can sync items' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = userData.tenant_id;

    // Get Xero tokens for this user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('integration_tokens')
      .select('access_token, refresh_token, xero_tenant_id, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'xero')
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Xero not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expires_at);
    const now = new Date();

    if (now >= tokenExpiry) {
      // Token expired, refresh it
      const refreshResponse = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${Deno.env.get('XERO_CLIENT_ID')}:${Deno.env.get('XERO_CLIENT_SECRET')}`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to refresh Xero token' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newTokens = await refreshResponse.json();
      accessToken = newTokens.access_token;

      // Update tokens in database
      await supabaseAdmin
        .from('integration_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id)
        .eq('provider', 'xero');
    }

    // Fetch items from Xero
    console.log('Fetching items from Xero...');
    const itemsResponse = await fetch(`${XERO_API_BASE}/Items`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tokenData.xero_tenant_id,
        Accept: 'application/json',
      },
    });

    if (!itemsResponse.ok) {
      const error = await itemsResponse.text();
      console.error('Xero API error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch items from Xero' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xeroData = await itemsResponse.json();
    const xeroItems = xeroData.Items || [];
    console.log(`Fetched ${xeroItems.length} items from Xero`);

    // Get existing items from database
    const { data: dbItems } = await supabaseAdmin
      .from('items')
      .select('id, name, xero_item_code, wholesale_price, xero_account_code, tax_rate, status')
      .eq('tenant_id', tenantId);

    const itemsToUpdate = [];
    const stats = {
      total: xeroItems.length,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    // Match and update items
    for (const xeroItem of xeroItems) {
      const itemCode = xeroItem.Code;
      if (!itemCode) continue;

      // Find matching item in database by xero_item_code
      const dbItem = dbItems?.find(item => item.xero_item_code === itemCode);

      if (!dbItem) {
        stats.skipped++;
        continue;
      }

      // Map Xero tax type to tax rate
      let taxRate = 10; // Default GST 10%
      if (xeroItem.SalesDetails?.TaxType === 'BASEXCLUDED' ||
          xeroItem.SalesDetails?.TaxType === 'EXEMPTINCOME' ||
          xeroItem.SalesDetails?.TaxType === 'GSTONIMPORTS') {
        taxRate = 0;
      }

      // Map Xero status to our status
      let status = 'active';
      if (xeroItem.IsTrackedAsInventory && xeroItem.QuantityOnHand === 0) {
        status = 'sold_out';
      } else if (xeroItem.IsSold === false) {
        status = 'inactive';
      }

      // Prepare update
      const updates: any = {
        name: xeroItem.Name || dbItem.name,
        wholesale_price: xeroItem.SalesDetails?.UnitPrice || dbItem.wholesale_price,
        xero_account_code: xeroItem.SalesDetails?.AccountCode || dbItem.xero_account_code,
        tax_rate: taxRate,
        status,
        updated_at: new Date().toISOString(),
      };

      // Check if anything changed
      const changed =
        updates.name !== dbItem.name ||
        Math.abs(updates.wholesale_price - dbItem.wholesale_price) > 0.01 ||
        updates.xero_account_code !== dbItem.xero_account_code ||
        updates.tax_rate !== dbItem.tax_rate ||
        updates.status !== dbItem.status;

      if (changed) {
        const { error } = await supabaseAdmin
          .from('items')
          .update(updates)
          .eq('id', dbItem.id);

        if (error) {
          console.error(`Error updating item ${itemCode}:`, error);
          stats.errors++;
        } else {
          stats.updated++;
        }
      } else {
        stats.skipped++;
      }
    }

    console.log('Sync complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        message: `Synced ${stats.updated} items from Xero`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing items:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
