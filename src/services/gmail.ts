import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  lastError?: string;
  filterSender?: string;
  filterTo?: string;
  filterSubject?: string;
  filterLabel?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

export async function checkGmailConnection(tenantId: string): Promise<GmailConnectionStatus> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { connected: false };
    }

    const { data, error } = await supabase
      .from('gmail_connections')
      .select('email, last_sync_at, last_error, is_active, filter_sender, filter_to, filter_subject, filter_label')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { connected: false };
    }

    return {
      connected: data.is_active,
      email: data.email,
      lastSyncAt: data.last_sync_at,
      lastError: data.last_error,
      filterSender: data.filter_sender,
      filterTo: data.filter_to,
      filterSubject: data.filter_subject,
      filterLabel: data.filter_label,
    };
  } catch (error) {
    console.error('Error checking Gmail connection:', error);
    return { connected: false };
  }
}

export async function connectGmail(tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('connectGmail: Starting connection for tenant', tenantId);

    // Get the auth URL from our edge function (no auth required)
    const response = await fetch(`${supabaseUrl}/functions/v1/gmail-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ tenantId }),
    });

    console.log('connectGmail: Response status', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('connectGmail: Error response', errorData);
      return { success: false, error: errorData.error || 'Failed to start Gmail connection' };
    }

    const data = await response.json();
    console.log('connectGmail: Got auth URL', data.authUrl ? 'yes' : 'no');

    const { authUrl } = data;

    if (!authUrl) {
      console.error('connectGmail: No authUrl in response');
      return { success: false, error: 'No auth URL received' };
    }

    // Open browser for OAuth
    if (Platform.OS === 'web') {
      // For web, redirect to Google OAuth
      // After auth, Google redirects to /api/auth/gmail/callback
      // which then redirects back to the app with success/error params
      console.log('connectGmail: Redirecting to', authUrl);
      window.location.href = authUrl;
      return { success: true }; // Will redirect, so this doesn't matter
    } else {
      // For native, use WebBrowser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'easy-ordering://'
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const gmailConnected = url.searchParams.get('gmail_connected');
        const gmailError = url.searchParams.get('gmail_error');

        if (gmailConnected === 'true') {
          return { success: true };
        } else if (gmailError) {
          return { success: false, error: gmailError };
        }
      }

      return { success: false, error: 'Connection cancelled' };
    }
  } catch (error) {
    console.error('Error connecting Gmail:', error);
    return { success: false, error: 'Failed to connect Gmail' };
  }
}

export async function disconnectGmail(tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('gmail_connections')
      .update({ is_active: false })
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return { success: false, error: 'Failed to disconnect Gmail' };
  }
}

export async function updateGmailFilters(
  tenantId: string,
  filters: { filterSender?: string; filterTo?: string; filterSubject?: string; filterLabel?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('gmail_connections')
      .update({
        filter_sender: filters.filterSender || null,
        filter_to: filters.filterTo || null,
        filter_subject: filters.filterSubject || null,
        filter_label: filters.filterLabel || 'INBOX',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating Gmail filters:', error);
    return { success: false, error: 'Failed to update filters' };
  }
}

export async function getGmailLabels(tenantId: string): Promise<{ labels: GmailLabel[]; error?: string }> {
  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { labels: [], error: 'Not authenticated' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/gmail-labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tenantId }),
    });

    if (!response.ok) {
      return { labels: [], error: 'Failed to fetch labels' };
    }

    const data = await response.json();
    return { labels: data.labels || [] };
  } catch (error) {
    return { labels: [], error: 'Failed to fetch labels' };
  }
}

export interface GmailSyncResult {
  messageId: string;
  success: boolean;
  orderId?: string;
  error?: string;
  hasUnmatchedItems?: boolean;
  unmatchedItems?: string[];
}

export interface GmailSyncResponse {
  success: boolean;
  processed?: number;
  results?: GmailSyncResult[];
  error?: string;
}

export async function triggerGmailSync(): Promise<GmailSyncResponse> {
  console.log('triggerGmailSync called');
  try {
    console.log('Getting session...');
    const session = await supabase.auth.getSession();
    console.log('Session:', session.data.session ? 'exists' : 'null');

    const url = `${supabaseUrl}/functions/v1/process-gmail-orders`;
    console.log('Fetching:', url);

    // Use AbortController for 2 minute timeout (processing can take a while)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.data.session?.access_token}`,
        'apikey': supabaseAnonKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('Response status:', response.status);

    const result = await response.json();
    console.log('Gmail sync response:', JSON.stringify(result, null, 2));

    if (response.ok) {
      return { success: true, processed: result.processed, results: result.results };
    } else {
      return { success: false, error: result.error || result.details || JSON.stringify(result) };
    }
  } catch (error: any) {
    console.error('Error triggering Gmail sync:', error);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Try again.' };
    }
    return { success: false, error: error.message || 'Failed to sync Gmail' };
  }
}
