// Xero Webhook - Receive invoice update notifications
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { XERO_API_URL, corsHeaders } from '../_shared/xero.ts';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const WEBHOOK_KEY = Deno.env.get('XERO_WEBHOOK_KEY') ?? '';

interface WebhookEvent {
  resourceUrl: string;
  resourceId: string;
  eventDateUtc: string;
  eventType: string;
  eventCategory: string;
  tenantId: string;
  tenantType: string;
}

interface WebhookPayload {
  events: WebhookEvent[];
  firstEventSequence: number;
  lastEventSequence: number;
  entropy: string;
}

// Verify Xero webhook signature
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_KEY) {
    console.error('XERO_WEBHOOK_KEY not configured');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(WEBHOOK_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Xero Webhook Received ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const signature = req.headers.get('x-xero-signature');
    const payloadText = await req.text();

    console.log('Signature present:', !!signature);
    console.log('Payload length:', payloadText.length);

    // Xero sends an "Intent to receive" verification request
    // We must respond with 200 and the correct hash
    if (!payloadText || payloadText === '{}') {
      console.log('Intent to receive verification request');
      // For intent to receive, just return 200
      return new Response('', { status: 200, headers: corsHeaders });
    }

    // Verify signature
    if (!signature) {
      console.error('No signature provided');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const isValid = await verifySignature(payloadText, signature);
    if (!isValid) {
      console.error('Invalid signature');
      // Must return 401 for invalid signature
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    console.log('Signature verified successfully');

    const payload: WebhookPayload = JSON.parse(payloadText);
    console.log('Events count:', payload.events?.length || 0);

    if (!payload.events || payload.events.length === 0) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process each event
    for (const event of payload.events) {
      console.log('Processing event:', event.eventType, event.eventCategory, event.resourceId);

      // Only process invoice update events
      if (event.eventCategory !== 'INVOICE') {
        console.log('Skipping non-invoice event');
        continue;
      }

      const xeroTenantId = event.tenantId;
      const xeroInvoiceId = event.resourceId;

      // Find the integration token for this Xero tenant
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('integration_tokens')
        .select('tenant_id, access_token, refresh_token, token_expires_at')
        .eq('xero_tenant_id', xeroTenantId)
        .eq('provider', 'xero')
        .single();

      if (tokenError || !tokenData) {
        console.log('No matching tenant found for Xero tenant:', xeroTenantId);
        continue;
      }

      // Find the invoice in our database
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .select('id, status')
        .eq('xero_invoice_id', xeroInvoiceId)
        .eq('tenant_id', tokenData.tenant_id)
        .single();

      if (invoiceError || !invoice) {
        console.log('Invoice not found in database for Xero ID:', xeroInvoiceId);
        continue;
      }

      // Fetch invoice details from Xero to get payment status
      console.log('Fetching invoice from Xero...');
      const xeroResponse = await fetch(`${XERO_API_URL}/Invoices/${xeroInvoiceId}`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Xero-Tenant-Id': xeroTenantId,
          Accept: 'application/json',
        },
      });

      if (!xeroResponse.ok) {
        console.error('Failed to fetch invoice from Xero:', xeroResponse.status);
        continue;
      }

      const xeroData = await xeroResponse.json();
      const xeroInvoice = xeroData.Invoices?.[0];

      if (!xeroInvoice) {
        console.log('No invoice data in Xero response');
        continue;
      }

      console.log('Xero invoice status:', xeroInvoice.Status);

      // Map Xero status to our status
      // Xero statuses: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED, DELETED
      let newStatus = invoice.status;
      if (xeroInvoice.Status === 'PAID') {
        newStatus = 'paid';
      } else if (xeroInvoice.Status === 'VOIDED' || xeroInvoice.Status === 'DELETED') {
        // Keep current status, maybe add a voided status later
        console.log('Invoice voided/deleted in Xero');
      }

      // Update invoice status if changed
      if (newStatus !== invoice.status) {
        console.log('Updating invoice status from', invoice.status, 'to', newStatus);
        const { error: updateError } = await supabaseAdmin
          .from('invoices')
          .update({ status: newStatus })
          .eq('id', invoice.id);

        if (updateError) {
          console.error('Failed to update invoice:', updateError);
        } else {
          console.log('Invoice status updated successfully');
        }
      }
    }

    console.log('=== Xero Webhook Processed ===');
    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Xero from retrying
    // Log the error for debugging
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
