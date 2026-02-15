// Xero Integration Service
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';

const SUPABASE_URL = supabaseUrl;
const SUPABASE_ANON_KEY = supabaseAnonKey;

interface XeroAuthResponse {
  url: string;
  state: string;
}

interface XeroInvoiceResponse {
  success: boolean;
  xero_invoice_id?: string;
  xero_invoice_number?: string;
  error?: string;
}

interface XeroConnectionStatus {
  connected: boolean;
  connectedAt?: string;
  xeroTenantId?: string;
}

/**
 * Check if Xero is connected for the current user
 */
export async function checkXeroConnection(tenantId: string): Promise<XeroConnectionStatus> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { connected: false };
  }

  const { data, error } = await supabase
    .from('integration_tokens')
    .select('xero_tenant_id, updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'xero')
    .single();

  if (error || !data) {
    return { connected: false };
  }

  return {
    connected: true,
    connectedAt: data.updated_at,
    xeroTenantId: data.xero_tenant_id,
  };
}

/**
 * Initiate Xero OAuth flow
 */
export async function connectXero(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Starting Xero connection');

    // Check current auth state
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Current session:', session ? 'exists' : 'null');
    console.log('User ID:', session?.user?.id);

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Call the xero-auth edge function using fetch with explicit headers
    // Both apikey (for gateway) and Authorization (for user auth) are required
    const response = await fetch(`${SUPABASE_URL}/functions/v1/xero-auth`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('xero-auth response status:', response.status);

    const data = await response.json();
    console.log('xero-auth response data:', data);

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to initiate Xero connection' };
    }

    const { url }: XeroAuthResponse = data;

    if (!url) {
      return { success: false, error: 'No authorization URL received' };
    }

    console.log('Opening Xero auth URL:', url);

    // Open the OAuth URL in a browser
    const result = await WebBrowser.openAuthSessionAsync(
      url,
      `${SUPABASE_URL}/functions/v1/xero-callback`
    );

    console.log('WebBrowser result:', result.type);

    if (result.type === 'success') {
      return { success: true };
    } else if (result.type === 'cancel') {
      return { success: false, error: 'Connection cancelled' };
    } else {
      return { success: false, error: 'Connection failed' };
    }
  } catch (error) {
    console.error('Xero connection error:', error);
    return { success: false, error: `Failed to connect to Xero: ${error}` };
  }
}

/**
 * Disconnect Xero integration for current user
 */
export async function disconnectXero(tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Delete the integration token for this user
    const { error } = await supabase
      .from('integration_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'xero');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Xero disconnect error:', error);
    return { success: false, error: 'Failed to disconnect Xero' };
  }
}

/**
 * Create an invoice in Xero
 */
export async function createXeroInvoice(
  orderId: string,
  invoiceId: string
): Promise<XeroInvoiceResponse> {
  try {
    // Get session for auth header
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use fetch directly for better error handling
    const response = await fetch(`${SUPABASE_URL}/functions/v1/xero-create-invoice`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId, invoice_id: invoiceId }),
    });

    const data = await response.json();
    console.log('Xero create invoice response:', response.status, data);

    // Check for errors - the Edge Function returns error details in the response body
    if (!response.ok || data.error) {
      let errorMessage = data.error || 'Failed to create Xero invoice';

      // Add context for common errors
      if (errorMessage.includes('JWT') || errorMessage.includes('401')) {
        errorMessage = 'Session expired. Please sign out and sign back in.';
      }

      console.error('Xero create invoice error:', errorMessage);
      return { success: false, error: errorMessage };
    }

    if (data.code === 'XERO_NOT_CONNECTED') {
      return { success: false, error: data.error || 'Xero not connected' };
    }

    return {
      success: true,
      xero_invoice_id: data.xero_invoice_id,
      xero_invoice_number: data.xero_invoice_number,
    };
  } catch (error) {
    console.error('Xero create invoice error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create Xero invoice';
    return { success: false, error: errorMessage };
  }
}

interface XeroPDFResponse {
  success: boolean;
  pdf_base64?: string;
  error?: string;
}

/**
 * Get invoice PDF from Xero
 */
export async function getXeroInvoicePDF(xeroInvoiceId: string): Promise<XeroPDFResponse> {
  try {
    console.log('Fetching PDF from Xero for invoice:', xeroInvoiceId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/xero-get-invoice-pdf`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ xero_invoice_id: xeroInvoiceId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to fetch PDF:', data.error);
      return { success: false, error: data.error || 'Failed to fetch PDF' };
    }

    console.log('PDF fetched successfully');
    return {
      success: true,
      pdf_base64: data.pdf_base64,
    };
  } catch (error) {
    console.error('Xero get PDF error:', error);
    return { success: false, error: 'Failed to fetch invoice PDF' };
  }
}
