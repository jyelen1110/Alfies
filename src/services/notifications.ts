// Web stub for notifications - push notifications only work on native
import { supabase } from '../lib/supabase';

/**
 * Register for push notifications - no-op on web
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('Push notifications not available on web');
  return null;
}

/**
 * Clear push token - no-op on web
 */
export async function clearPushToken(): Promise<void> {
  // No-op on web
}

/**
 * Send a notification to specific users (via Edge Function)
 * This works on web since it just calls the backend
 */
export async function sendNotification(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: { userIds, title, body, data },
    });

    if (error) {
      console.error('Error sending notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Notify owners of a tenant about a new order
 */
export async function notifyNewOrder(
  tenantId: string,
  orderNumber: string,
  customerName: string
): Promise<void> {
  try {
    // Get all owners for this tenant
    const { data: owners, error } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .not('push_token', 'is', null);

    if (error || !owners || owners.length === 0) {
      console.log('No owners with push tokens found for tenant:', tenantId);
      return;
    }

    const ownerIds = owners.map(o => o.id);

    await sendNotification(
      ownerIds,
      'New Order Received',
      `${customerName} placed order #${orderNumber}`,
      { type: 'new_order', orderNumber }
    );
  } catch (error) {
    console.error('Error notifying owners:', error);
  }
}
