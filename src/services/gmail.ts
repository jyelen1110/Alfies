import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cijgmmckafmfmmlpvgyi.supabase.co';

export interface GmailConnectionStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
  lastError?: string;
}

export async function checkGmailConnection(tenantId: string): Promise<GmailConnectionStatus> {
  try {
    const { data, error } = await supabase
      .from('gmail_connections')
      .select('email, last_sync_at, last_error, is_active')
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
      // For web, open in new window and listen for callback
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'gmail-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      return new Promise((resolve) => {
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'gmail-oauth-callback') {
            window.removeEventListener('message', handleMessage);
            popup?.close();

            if (event.data.code) {
              // Exchange code for tokens
              const callbackResponse = await fetch(`${SUPABASE_URL}/functions/v1/gmail-callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: event.data.code,
                  state: event.data.state,
                }),
              });

              if (callbackResponse.ok) {
                resolve({ success: true });
              } else {
                const error = await callbackResponse.json();
                resolve({ success: false, error: error.error });
              }
            } else {
              resolve({ success: false, error: 'Connection cancelled' });
            }
          }
        };

        window.addEventListener('message', handleMessage);

        // Also check if popup was closed without completing
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            resolve({ success: false, error: 'Connection cancelled' });
          }
        }, 500);
      });
    } else {
      // For native, use WebBrowser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'easy-ordering://'
      );

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (code && state) {
          const callbackResponse = await fetch(`${SUPABASE_URL}/functions/v1/gmail-callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          });

          if (callbackResponse.ok) {
            return { success: true };
          } else {
            const error = await callbackResponse.json();
            return { success: false, error: error.error };
          }
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
