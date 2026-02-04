// Xero Create Invoice - Create an invoice in Xero from an order
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { XERO_API_URL, getValidXeroToken, corsHeaders } from '../_shared/xero.ts';

interface OrderItemWithXero {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total?: number;
  procurement_item_id?: string;
  item?: {
    xero_account_code?: string;
    xero_item_code?: string;
  };
}

interface InvoiceRequest {
  order_id: string;
  invoice_id: string;
}

const DEFAULT_ACCOUNT_CODE = '200';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Xero Create Invoice - Start ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('ERROR: No authorization header provided');
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
      console.error('ERROR: Auth failed -', authError?.message || 'No user');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('User authenticated:', user.id);

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('ERROR: User not found -', userError?.message);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Tenant ID:', userData.tenant_id, 'Role:', userData.role);

    const { order_id, invoice_id }: InvoiceRequest = await req.json();
    console.log('Request payload - Order ID:', order_id, 'Invoice ID:', invoice_id);

    if (!order_id || !invoice_id) {
      console.error('ERROR: Missing order_id or invoice_id');
      return new Response(JSON.stringify({ error: 'Missing order_id or invoice_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get valid Xero token
    console.log('Fetching Xero token...');
    const tokenData = await getValidXeroToken(userData.tenant_id);
    if (!tokenData) {
      console.error('ERROR: Xero not connected for tenant', userData.tenant_id);
      return new Response(JSON.stringify({ error: 'Xero not connected', code: 'XERO_NOT_CONNECTED' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Xero token retrieved, Xero Tenant ID:', tokenData.xeroTenantId);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get order with items (including xero codes)
    console.log('Fetching order with items...');
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        items:order_items(
          id,
          name,
          quantity,
          unit_price,
          total,
          xero_item_code,
          xero_account_code
        )
      `)
      .eq('id', order_id)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (orderError || !order) {
      console.error('ERROR: Order not found -', orderError?.message);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Order found:', order.order_number || order.id);
    console.log('Order items count:', order.items?.length || 0);

    // Get invoice
    console.log('Fetching invoice...');
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('ERROR: Invoice not found -', invoiceError?.message);
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Invoice found:', invoice.invoice_number);

    // Get customer info (the user who placed the order)
    console.log('Fetching customer info for created_by:', order.created_by);
    let customerName = 'Customer';
    let customerEmail = '';
    let xeroContactId: string | null = null;

    if (order.created_by) {
      const { data: customer } = await supabaseAdmin
        .from('users')
        .select('business_name, full_name, contact_email, email, xero_contact_id')
        .eq('id', order.created_by)
        .single();

      if (customer) {
        customerName = customer.business_name || customer.full_name || 'Customer';
        customerEmail = customer.contact_email || customer.email || '';
        xeroContactId = customer.xero_contact_id || null;
        console.log('Customer found:', customerName, customerEmail, 'Xero Contact ID:', xeroContactId || 'none');
      } else {
        console.log('No customer found, using default');
      }
    }

    // Build line items with Xero codes
    console.log('Building line items...');
    const lineItems = (order.items || []).map((orderItem: {
      id: string;
      name: string;
      quantity: number;
      unit_price: number;
      total?: number;
      xero_item_code?: string;
      xero_account_code?: string;
    }, index: number) => {
      const accountCode = orderItem.xero_account_code || DEFAULT_ACCOUNT_CODE;
      const itemCode = orderItem.xero_item_code;

      console.log(`Line ${index + 1}: "${orderItem.name}" | Qty: ${orderItem.quantity} | Price: ${orderItem.unit_price} | AccountCode: ${accountCode} | ItemCode: ${itemCode || 'none'}`);

      const lineItem: Record<string, unknown> = {
        Description: orderItem.name,
        Quantity: orderItem.quantity,
        UnitAmount: orderItem.unit_price,
        AccountCode: accountCode,
        TaxType: 'OUTPUT', // GST on Income
      };

      // Include ItemCode if set
      if (itemCode) {
        lineItem.ItemCode = itemCode;
      }

      return lineItem;
    });

    // Calculate dates - use requested_delivery_date from order, due date is 7 days later
    const deliveryDate = order.requested_delivery_date || order.order_date || new Date().toISOString().split('T')[0];
    const deliveryDateObj = new Date(deliveryDate);
    const dueDateObj = new Date(deliveryDateObj);
    dueDateObj.setDate(dueDateObj.getDate() + 7);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    console.log('Invoice dates - Delivery/Invoice Date:', deliveryDate, 'Due Date:', dueDate);

    // Build Contact object - use ContactID if available, otherwise use Name
    const contact: Record<string, unknown> = {};
    if (xeroContactId) {
      contact.ContactID = xeroContactId;
      console.log('Using Xero ContactID:', xeroContactId);
    } else {
      contact.Name = customerName;
      if (customerEmail) {
        contact.EmailAddress = customerEmail;
      }
      console.log('Using Contact Name:', customerName);
    }

    // Build Xero invoice payload
    // InvoiceNumber is omitted to let Xero auto-generate
    const xeroInvoice = {
      Type: 'ACCREC', // Accounts Receivable (Sales Invoice)
      Contact: contact,
      Date: deliveryDate,
      DueDate: dueDate,
      LineAmountTypes: 'Exclusive', // Tax exclusive
      Reference: order.order_number || order.id.substring(0, 8),
      Status: 'AUTHORISED',
      LineItems: lineItems,
    };

    console.log('Xero invoice payload:', JSON.stringify(xeroInvoice, null, 2));

    // Create invoice in Xero
    console.log('Sending invoice to Xero API...');
    console.log('Xero API URL:', `${XERO_API_URL}/Invoices`);

    const xeroResponse = await fetch(`${XERO_API_URL}/Invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        'Xero-Tenant-Id': tokenData.xeroTenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Invoices: [xeroInvoice] }),
    });

    console.log('Xero API response status:', xeroResponse.status, xeroResponse.statusText);

    if (!xeroResponse.ok) {
      const errorText = await xeroResponse.text();
      console.error('ERROR: Xero API failed');
      console.error('Xero API error status:', xeroResponse.status);
      console.error('Xero API error body:', errorText);

      // Parse Xero error
      let errorMessage = 'Failed to create invoice in Xero';
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Xero API error parsed:', JSON.stringify(errorJson, null, 2));

        if (errorJson.Message) {
          errorMessage = errorJson.Message;
        } else if (errorJson.Elements?.[0]?.ValidationErrors?.[0]?.Message) {
          errorMessage = errorJson.Elements[0].ValidationErrors[0].Message;
        }

        // Log all validation errors if present
        if (errorJson.Elements?.[0]?.ValidationErrors) {
          console.error('Validation errors:', JSON.stringify(errorJson.Elements[0].ValidationErrors, null, 2));
        }
      } catch {
        console.error('Could not parse Xero error response as JSON');
      }

      console.log('=== Xero Create Invoice - Failed ===');
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xeroResult = await xeroResponse.json();
    console.log('Xero API success response:', JSON.stringify(xeroResult, null, 2));

    const createdInvoice = xeroResult.Invoices?.[0];

    if (!createdInvoice) {
      console.error('ERROR: No invoice in Xero response');
      console.log('=== Xero Create Invoice - Failed ===');
      return new Response(JSON.stringify({ error: 'No invoice returned from Xero' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Xero Invoice created - ID:', createdInvoice.InvoiceID, 'Number:', createdInvoice.InvoiceNumber);

    // Fetch PDF from Xero immediately
    console.log('Fetching PDF from Xero...');
    let pdfStoragePath: string | null = null;

    try {
      const pdfResponse = await fetch(`${XERO_API_URL}/Invoices/${createdInvoice.InvoiceID}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Xero-Tenant-Id': tokenData.xeroTenantId,
          Accept: 'application/pdf',
        },
      });

      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        console.log('PDF fetched, size:', pdfBuffer.byteLength, 'bytes');

        // Upload to Supabase Storage
        const storagePath = `${userData.tenant_id}/${createdInvoice.InvoiceNumber || createdInvoice.InvoiceID}.pdf`;
        console.log('Uploading PDF to storage:', storagePath);

        const { error: uploadError } = await supabaseAdmin.storage
          .from('invoice-pdfs')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.error('Warning: Failed to upload PDF -', uploadError.message);
        } else {
          pdfStoragePath = storagePath;
          console.log('PDF uploaded successfully');
        }
      } else {
        console.error('Warning: Failed to fetch PDF from Xero -', pdfResponse.status);
      }
    } catch (pdfError) {
      console.error('Warning: Error fetching/storing PDF -', pdfError);
    }

    // Update local invoice with Xero ID and PDF path
    console.log('Updating local invoice with Xero ID...');
    const updateData: Record<string, unknown> = {
      xero_invoice_id: createdInvoice.InvoiceID,
      exported_at: new Date().toISOString(),
      status: 'exported',
    };

    if (pdfStoragePath) {
      updateData.pdf_storage_path = pdfStoragePath;
    }

    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoice_id);

    if (updateError) {
      console.error('Warning: Failed to update local invoice -', updateError.message);
    } else {
      console.log('Local invoice updated successfully');
    }

    console.log('=== Xero Create Invoice - Success ===');
    return new Response(
      JSON.stringify({
        success: true,
        xero_invoice_id: createdInvoice.InvoiceID,
        xero_invoice_number: createdInvoice.InvoiceNumber,
        pdf_storage_path: pdfStoragePath,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('=== Xero Create Invoice - Error ===');
    console.error('Unexpected error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
