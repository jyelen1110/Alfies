import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and store the token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Only works on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('Expo push token:', token);

    // Store the token in the database
    await savePushToken(token);

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Save push token to the current user's profile
 */
async function savePushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No user logged in, cannot save push token');
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', user.id);

  if (error) {
    console.error('Error saving push token:', error);
  } else {
    console.log('Push token saved successfully');
  }
}

/**
 * Clear push token (call on logout)
 */
export async function clearPushToken(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('users')
    .update({ push_token: null })
    .eq('id', user.id);
}

/**
 * Send a notification to specific users (via Edge Function)
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

// Android notification channel setup
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B35',
  });
}
