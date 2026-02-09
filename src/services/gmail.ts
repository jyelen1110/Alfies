import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cijgmmckafmfmmlpvgyi.supabase.co';

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  lastError?: string;
  filterSender?: string;
  filterSubject?: string;
  filterLabel?: string;
}

export async function checkGmailConnection(tenantId: string): Promise<GmailConnectionStatus> {
  try {
    const { data, error } = await supabase
      .from('gmail_connections')
      .select('email, last_sync_at, last_error, is_active, filter_sender, filter_subject, filter_label')
      .eq('tenant_id', tenantId)
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
    // Get the auth URL from our edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ tenantId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to start Gmail connection' };
    }

    const { authUrl } = await response.json();

    // Open browser for OAuth
    if (Platform.OS === 'web') {
      // For web, redirect to Google OAuth
      // After auth, Google redirects to /api/auth/gmail/callback
      // which then redirects back to the app with success/error params
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
    const { error } = await supabase
      .from('gmail_connections')
      .update({ is_active: false })
      .eq('tenant_id', tenantId);

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
  filters: { filterSender?: string; filterSubject?: string; filterLabel?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('gmail_connections')
      .update({
        filter_sender: filters.filterSender || null,
        filter_subject: filters.filterSubject || null,
        filter_label: filters.filterLabel || 'INBOX',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating Gmail filters:', error);
    return { success: false, error: 'Failed to update filters' };
  }
}

export async function getGmailLabels(tenantId: string): Promise<{ labels: string[]; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-labels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
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

export async function triggerGmailSync(): Promise<{ success: boolean; processed?: number; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-gmail-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, processed: result.processed };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error triggering Gmail sync:', error);
    return { success: false, error: 'Failed to sync Gmail' };
  }
}
