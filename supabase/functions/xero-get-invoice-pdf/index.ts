// Xero Get Invoice PDF - Fetch invoice PDF from Xero
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { XERO_API_URL, getValidXeroToken, corsHeaders } from '../_shared/xero.ts';

interface PDFRequest {
  xero_invoice_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Xero Get Invoice PDF - Start ===');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('ERROR: No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from Supabase auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('ERROR: Auth failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('ERROR: User not found');
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { xero_invoice_id }: PDFRequest = await req.json();
    console.log('Fetching PDF for Xero Invoice ID:', xero_invoice_id);

    if (!xero_invoice_id) {
      return new Response(JSON.stringify({ error: 'Missing xero_invoice_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get valid Xero token
    const tokenData = await getValidXeroToken(userData.tenant_id);
    if (!tokenData) {
      console.error('ERROR: Xero not connected');
      return new Response(JSON.stringify({ error: 'Xero not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch PDF from Xero
    console.log('Fetching PDF from Xero API...');
    const xeroResponse = await fetch(`${XERO_API_URL}/Invoices/${xero_invoice_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        'Xero-Tenant-Id': tokenData.xeroTenantId,
        Accept: 'application/pdf',
      },
    });

    console.log('Xero API response status:', xeroResponse.status);

    if (!xeroResponse.ok) {
      const errorText = await xeroResponse.text();
      console.error('ERROR: Xero API failed:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch invoice PDF from Xero' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PDF as ArrayBuffer and convert to base64
    const pdfBuffer = await xeroResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Convert to base64 in chunks to avoid call stack issues
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const pdfBase64 = btoa(binary);

    console.log('PDF fetched successfully, size:', pdfBuffer.byteLength, 'bytes');
    console.log('=== Xero Get Invoice PDF - Success ===');

    return new Response(
      JSON.stringify({
        success: true,
        pdf_base64: pdfBase64,
        content_type: 'application/pdf',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('=== Xero Get Invoice PDF - Error ===');
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
