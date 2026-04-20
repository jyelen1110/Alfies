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

    // Existing DB items for this tenant (used to match by code OR name)
    const { data: dbItems } = await supabaseAdmin
      .from('items')
      .select('id, name, sku, xero_item_code, wholesale_price, xero_account_code, tax_rate, status, supplier_id')
      .eq('tenant_id', tenantId);

    // Pick a default supplier for newly-created items. Prefer one whose name
    // matches the tenant (e.g. "Alfie's Food Co."); otherwise just the first
    // supplier for the tenant.
    const { data: tenantRow } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();
    const { data: suppliers } = await supabaseAdmin
      .from('suppliers')
      .select('id, name')
      .eq('tenant_id', tenantId);
    const defaultSupplier =
      suppliers?.find(
        (s) => tenantRow?.name && s.name.toLowerCase() === tenantRow.name.toLowerCase()
      ) || suppliers?.[0];

    if (!defaultSupplier) {
      return new Response(
        JSON.stringify({
          error:
            'No supplier exists for this tenant. Create at least one supplier before syncing items from Xero.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats = {
      total_from_xero: xeroItems.length,
      created: 0,
      updated: 0,
      linked: 0,
      unchanged: 0,
      deactivated: 0,
      errors: 0,
    };
    const createdNames: string[] = [];
    const updatedNames: string[] = [];
    const linkedNames: string[] = [];
    const deactivatedNames: string[] = [];

    const normaliseName = (n: string | undefined) => (n || '').trim().toLowerCase();
    const touchedDbIds = new Set<string>();

    for (const xeroItem of xeroItems) {
      const itemCode: string | undefined = xeroItem.Code;
      if (!itemCode) continue;

      // Skip items that Xero has marked inactive for sales.
      if (xeroItem.IsSold === false) continue;

      // Match by code first, then fall back to case-insensitive name match.
      let dbItem = dbItems?.find((i) => i.xero_item_code === itemCode);
      let matchedByName = false;
      if (!dbItem) {
        const target = normaliseName(xeroItem.Name);
        dbItem = dbItems?.find((i) => normaliseName(i.name) === target);
        if (dbItem) matchedByName = true;
      }

      // Map Xero tax type to tax rate.
      let taxRate = 10;
      if (
        xeroItem.SalesDetails?.TaxType === 'BASEXCLUDED' ||
        xeroItem.SalesDetails?.TaxType === 'EXEMPTINCOME' ||
        xeroItem.SalesDetails?.TaxType === 'GSTONIMPORTS'
      ) {
        taxRate = 0;
      }

      // Map Xero status to our status.
      let status: 'active' | 'inactive' | 'sold_out' = 'active';
      if (xeroItem.IsTrackedAsInventory && xeroItem.QuantityOnHand === 0) {
        status = 'sold_out';
      }

      const salesPrice =
        typeof xeroItem.SalesDetails?.UnitPrice === 'number'
          ? xeroItem.SalesDetails.UnitPrice
          : null;
      const accountCode = xeroItem.SalesDetails?.AccountCode ?? null;

      if (!dbItem) {
        // Create a new item in our catalog.
        const { error: insertError } = await supabaseAdmin.from('items').insert({
          tenant_id: tenantId,
          supplier_id: defaultSupplier.id,
          name: xeroItem.Name || itemCode,
          sku: itemCode,
          xero_item_code: itemCode,
          xero_account_code: accountCode,
          tax_rate: taxRate,
          wholesale_price: salesPrice ?? 0,
          status,
        });
        if (insertError) {
          console.error('Insert failed for Xero item', itemCode, insertError);
          stats.errors++;
        } else {
          stats.created++;
          if (createdNames.length < 100) createdNames.push(xeroItem.Name || itemCode);
        }
        continue;
      }

      touchedDbIds.add(dbItem.id);

      const updates: Record<string, unknown> = {
        name: xeroItem.Name || dbItem.name,
        wholesale_price: salesPrice ?? dbItem.wholesale_price,
        xero_account_code: accountCode ?? dbItem.xero_account_code,
        tax_rate: taxRate,
        xero_item_code: itemCode,
        status,
        updated_at: new Date().toISOString(),
      };

      const priceChanged =
        Math.abs((updates.wholesale_price as number) - (dbItem.wholesale_price ?? 0)) > 0.01;
      const changed =
        updates.name !== dbItem.name ||
        priceChanged ||
        updates.xero_account_code !== dbItem.xero_account_code ||
        updates.tax_rate !== dbItem.tax_rate ||
        updates.status !== dbItem.status ||
        updates.xero_item_code !== dbItem.xero_item_code;

      if (!changed) {
        stats.unchanged++;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('items')
        .update(updates)
        .eq('id', dbItem.id);
      if (updateError) {
        console.error('Update failed for Xero item', itemCode, updateError);
        stats.errors++;
      } else if (matchedByName && dbItem.xero_item_code !== itemCode) {
        stats.linked++;
        if (linkedNames.length < 100) linkedNames.push(dbItem.name);
      } else {
        stats.updated++;
        if (updatedNames.length < 100) updatedNames.push(dbItem.name);
      }
    }

    // Deactivate DB items that were previously linked to Xero but are no
    // longer in the active Xero set. Items without xero_item_code (manual
    // entries) are deliberately left untouched.
    const candidates =
      dbItems?.filter(
        (i) =>
          i.xero_item_code &&
          !touchedDbIds.has(i.id) &&
          i.status !== 'inactive'
      ) ?? [];
    for (const stale of candidates) {
      const { error: deactivateError } = await supabaseAdmin
        .from('items')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', stale.id);
      if (deactivateError) {
        console.error('Deactivate failed for item', stale.id, deactivateError);
        stats.errors++;
      } else {
        stats.deactivated++;
        if (deactivatedNames.length < 100) deactivatedNames.push(stale.name);
      }
    }

    console.log('Sync complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        samples: {
          created: createdNames,
          linked: linkedNames,
          updated: updatedNames,
          deactivated: deactivatedNames,
        },
        message:
          `Xero sync complete — ` +
          `created ${stats.created}, linked ${stats.linked}, updated ${stats.updated}, ` +
          `unchanged ${stats.unchanged}, deactivated ${stats.deactivated}, errors ${stats.errors}`,
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
