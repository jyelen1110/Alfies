import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { checkXeroConnection, connectXero, disconnectXero } from '../services/xero';
import { checkGmailConnection, connectGmail, disconnectGmail, updateGmailFilters, getGmailLabels, GmailConnectionStatus, GmailLabel } from '../services/gmail';
import BusinessSwitcher from '../components/BusinessSwitcher';

export default function SettingsScreen() {
  const { user, tenant, signOut, isOwner, isMaster } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Xero connection state
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroConnectedAt, setXeroConnectedAt] = useState<string | null>(null);
  const [xeroLoading, setXeroLoading] = useState(false);
  const [checkingXero, setCheckingXero] = useState(true);
  const [syncingXeroItems, setSyncingXeroItems] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Gmail connection state
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus>({ connected: false });
  const [gmailLoading, setGmailLoading] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(true);
  const [showGmailFilterModal, setShowGmailFilterModal] = useState(false);
  const [gmailFilterSender, setGmailFilterSender] = useState('');
  const [gmailFilterTo, setGmailFilterTo] = useState('');
  const [gmailFilterSubject, setGmailFilterSubject] = useState('');
  const [gmailFilterLabel, setGmailFilterLabel] = useState('INBOX');
  const [savingGmailFilters, setSavingGmailFilters] = useState(false);
  const [gmailLabels, setGmailLabels] = useState<GmailLabel[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  // Check for OAuth callback params (web only)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);

      // Gmail callback
      const gmailConnected = params.get('gmail_connected');
      const gmailError = params.get('gmail_error');
      const email = params.get('email');

      if (gmailConnected === 'true') {
        Alert.alert('Success', `Gmail connected${email ? `: ${email}` : ''}! Orders will be processed automatically.`);
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
        // Refresh Gmail status
        if (tenant?.id) {
          checkGmailStatus();
        }
      } else if (gmailError) {
        Alert.alert('Error', `Failed to connect Gmail: ${gmailError}`);
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Xero callback
      const xeroConnected = params.get('xero_connected');
      const xeroError = params.get('xero_error');
      const org = params.get('org');

      if (xeroConnected === 'true') {
        Alert.alert('Success', `Xero connected${org ? ` to ${org}` : ''}! You can now export invoices to Xero.`);
        // Clear URL params
        window.history.replaceState({}, '', window.location.pathname);
        // Refresh Xero status
        if (tenant?.id) {
          checkXeroStatus();
        }
      } else if (xeroError) {
        Alert.alert('Error', `Failed to connect Xero: ${xeroError}`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Check Xero and Gmail connection on mount
  useEffect(() => {
    if (tenant?.id) {
      checkXeroStatus();
      checkGmailStatus();
    }
  }, [tenant?.id]);

  const checkXeroStatus = useCallback(async () => {
    if (!tenant?.id) return;
    setCheckingXero(true);
    try {
      const status = await checkXeroConnection(tenant.id);
      setXeroConnected(status.connected);
      setXeroConnectedAt(status.connectedAt || null);
    } catch (error) {
      console.error('Error checking Xero status:', error);
    } finally {
      setCheckingXero(false);
    }
  }, [tenant?.id]);

  const checkGmailStatus = useCallback(async () => {
    if (!tenant?.id) return;
    setCheckingGmail(true);
    try {
      const status = await checkGmailConnection(tenant.id);
      setGmailStatus(status);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setCheckingGmail(false);
    }
  }, [tenant?.id]);

  const handleConnectXero = async () => {
    setXeroLoading(true);
    try {
      const result = await connectXero();
      if (result.success) {
        // Wait a moment for the callback to complete, then check status
        setTimeout(async () => {
          await checkXeroStatus();
          setXeroLoading(false);
          Alert.alert('Success', 'Xero connected successfully!');
        }, 2000);
      } else {
        setXeroLoading(false);
        if (result.error !== 'Connection cancelled') {
          Alert.alert('Error', result.error || 'Failed to connect Xero');
        }
      }
    } catch (error) {
      setXeroLoading(false);
      Alert.alert('Error', 'Failed to connect Xero');
    }
  };

  const handleDisconnectXero = async () => {
    console.log('handleDisconnectXero called');

    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to disconnect Xero? New invoices will no longer sync automatically.')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Disconnect Xero',
            'Are you sure you want to disconnect Xero? New invoices will no longer sync automatically.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Disconnect', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    if (!tenant?.id) return;
    setXeroLoading(true);
    try {
      const result = await disconnectXero(tenant.id);
      if (result.success) {
        setXeroConnected(false);
        setXeroConnectedAt(null);
        if (Platform.OS === 'web') {
          window.alert('Success: Xero disconnected');
        } else {
          Alert.alert('Success', 'Xero disconnected');
        }
      } else {
        const errorMsg = result.error || 'Failed to disconnect Xero';
        if (Platform.OS === 'web') {
          window.alert(`Error: ${errorMsg}`);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('handleDisconnectXero exception:', error);
      if (Platform.OS === 'web') {
        window.alert('Error: Failed to disconnect Xero');
      } else {
        Alert.alert('Error', 'Failed to disconnect Xero');
      }
    } finally {
      setXeroLoading(false);
    }
  };

  const handleSyncXeroItems = async () => {
    console.log('handleSyncXeroItems called');
    setSyncingXeroItems(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const msg = 'Not authenticated. Please sign in again.';
        if (Platform.OS === 'web') {
          window.alert('Error: ' + msg);
        } else {
          Alert.alert('Error', msg);
        }
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-xero-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLastSyncTime(new Date().toISOString());
        const msg = result.message || `Synced ${result.stats?.updated || 0} items from Xero`;
        if (Platform.OS === 'web') {
          window.alert('Success: ' + msg);
        } else {
          Alert.alert('Success', msg);
        }
      } else {
        const errorMsg = result.error || 'Failed to sync items';
        if (Platform.OS === 'web') {
          window.alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('handleSyncXeroItems exception:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to sync items';
      if (Platform.OS === 'web') {
        window.alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setSyncingXeroItems(false);
    }
  };

  const handleConnectGmail = async () => {
    console.log('handleConnectGmail called, tenant:', tenant?.id);
    if (!tenant?.id) {
      console.error('No tenant ID');
      if (Platform.OS === 'web') {
        window.alert('Error: No tenant ID found');
      } else {
        Alert.alert('Error', 'No tenant ID found');
      }
      return;
    }
    setGmailLoading(true);
    try {
      const result = await connectGmail(tenant.id);
      console.log('connectGmail result:', result);
      if (result.success) {
        // On web, the page will redirect, so this code won't run
        // On native, show success after a delay
        if (Platform.OS !== 'web') {
          setTimeout(async () => {
            await checkGmailStatus();
            setGmailLoading(false);
            Alert.alert('Success', 'Gmail connected! Order emails will be processed automatically.');
          }, 2000);
        }
      } else {
        setGmailLoading(false);
        if (result.error !== 'Connection cancelled') {
          const errorMsg = result.error || 'Failed to connect Gmail';
          console.error('Gmail connection error:', errorMsg);
          if (Platform.OS === 'web') {
            window.alert(`Error: ${errorMsg}`);
          } else {
            Alert.alert('Error', errorMsg);
          }
        }
      }
    } catch (error) {
      console.error('handleConnectGmail exception:', error);
      setGmailLoading(false);
      const errorMsg = error instanceof Error ? error.message : 'Failed to connect Gmail';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const handleOpenGmailFilters = async () => {
    setGmailFilterSender(gmailStatus.filterSender || '');
    setGmailFilterTo(gmailStatus.filterTo || '');
    setGmailFilterSubject(gmailStatus.filterSubject || '');
    setGmailFilterLabel(gmailStatus.filterLabel || 'INBOX');
    setShowGmailFilterModal(true);

    // Fetch labels
    if (tenant?.id) {
      setLoadingLabels(true);
      const result = await getGmailLabels(tenant.id);
      if (result.labels.length > 0) {
        setGmailLabels(result.labels);
      }
      setLoadingLabels(false);
    }
  };

  const handleSaveGmailFilters = async () => {
    if (!tenant?.id) return;
    setSavingGmailFilters(true);
    try {
      const result = await updateGmailFilters(tenant.id, {
        filterSender: gmailFilterSender.trim() || undefined,
        filterTo: gmailFilterTo.trim() || undefined,
        filterSubject: gmailFilterSubject.trim() || undefined,
        filterLabel: gmailFilterLabel.trim() || 'INBOX',
      });
      if (result.success) {
        await checkGmailStatus();
        setShowGmailFilterModal(false);
        Alert.alert('Success', 'Email filters updated');
      } else {
        Alert.alert('Error', result.error || 'Failed to save filters');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save filters');
    } finally {
      setSavingGmailFilters(false);
    }
  };

  const handleDisconnectGmail = async () => {
    console.log('handleDisconnectGmail called');

    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to disconnect Gmail? Order emails will no longer be processed automatically.')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Disconnect Gmail',
            'Are you sure you want to disconnect Gmail? Order emails will no longer be processed automatically.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Disconnect', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    if (!tenant?.id) return;
    setGmailLoading(true);
    try {
      const result = await disconnectGmail(tenant.id);
      if (result.success) {
        setGmailStatus({ connected: false });
        if (Platform.OS === 'web') {
          window.alert('Success: Gmail disconnected');
        } else {
          Alert.alert('Success', 'Gmail disconnected');
        }
      } else {
        const errorMsg = result.error || 'Failed to disconnect Gmail';
        if (Platform.OS === 'web') {
          window.alert(`Error: ${errorMsg}`);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('handleDisconnectGmail exception:', error);
      if (Platform.OS === 'web') {
        window.alert('Error: Failed to disconnect Gmail');
      } else {
        Alert.alert('Error', 'Failed to disconnect Gmail');
      }
    } finally {
      setGmailLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        setSigningOut(true);
        await signOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
          },
        },
      ]);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      Alert.alert('Error', 'Please type "delete" to confirm account deletion.');
      return;
    }

    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        Alert.alert('Error', 'Please sign in again to delete your account.');
        setDeletingAccount(false);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let result: { error?: string; success?: boolean };
      try {
        result = await response.json();
      } catch {
        result = { error: 'Server error. Please try again.' };
      }

      if (!response.ok) {
        Alert.alert('Error', result.error || 'Failed to delete account');
        setDeletingAccount(false);
        return;
      }

      // Account deleted successfully - sign out and show message
      setShowDeleteModal(false);
      setDeletingAccount(false);
      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted.',
        [{ text: 'OK', onPress: () => signOut() }]
      );
    } catch (error: any) {
      console.error('Delete account error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setDeletingAccount(false);
    }
  };

  const openDeleteAccountModal = () => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.logoPlaceholder}>
          <Ionicons name="cart" size={48} color={theme.colors.accent} />
        </View>
        <Text style={styles.businessName}>
          {isOwner() ? (tenant?.name || 'My Business') : (user?.business_name || user?.full_name || 'Customer')}
        </Text>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons
              name={isMaster() ? 'star' : isOwner() ? 'shield-checkmark' : 'person'}
              size={14}
              color={isMaster() ? theme.colors.warning : isOwner() ? theme.colors.accent : theme.colors.info}
            />
            <Text
              style={[
                styles.roleText,
                { color: isMaster() ? theme.colors.warning : isOwner() ? theme.colors.accent : theme.colors.info },
              ]}
            >
              {isMaster() ? 'Master Admin' : isOwner() ? 'Owner' : 'Team Member'}
            </Text>
          </View>
        </View>
      </View>

      {/* Business Switcher for Master Users */}
      <BusinessSwitcher />

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} />
              <View>
                <Text style={styles.menuItemLabel}>Name</Text>
                <Text style={styles.menuItemValue}>{user?.full_name}</Text>
              </View>
            </View>
          </View>
          <View style={styles.menuDivider} />
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} />
              <View>
                <Text style={styles.menuItemLabel}>Email</Text>
                <Text style={styles.menuItemValue}>{user?.email}</Text>
              </View>
            </View>
          </View>
          <View style={styles.menuDivider} />
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="business-outline" size={20} color={theme.colors.textSecondary} />
              <View>
                <Text style={styles.menuItemLabel}>Business</Text>
                <Text style={styles.menuItemValue}>
                  {isOwner() ? tenant?.name : (user?.business_name || user?.full_name)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>


      {/* Xero Integration - Owner only */}
      {isOwner() && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integrations</Text>
          <View style={styles.menuCard}>
            {checkingXero ? (
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={styles.menuItemValue}>Checking Xero connection...</Text>
                </View>
              </View>
            ) : xeroConnected ? (
              <>
                <View style={styles.menuItem}>
                  <View style={styles.menuItemLeft}>
                    <View style={styles.xeroConnectedIcon}>
                      <Ionicons name="checkmark" size={16} color={theme.colors.white} />
                    </View>
                    <View>
                      <Text style={styles.menuItemLabel}>Xero</Text>
                      <Text style={[styles.menuItemValue, { color: theme.colors.success }]}>
                        Connected
                      </Text>
                      {xeroConnectedAt && (
                        <Text style={styles.xeroConnectedDate}>
                          Since {new Date(xeroConnectedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleSyncXeroItems}
                  disabled={syncingXeroItems}
                >
                  <View style={styles.menuItemLeft}>
                    {syncingXeroItems ? (
                      <ActivityIndicator size="small" color={theme.colors.info} />
                    ) : (
                      <Ionicons name="sync-outline" size={20} color={theme.colors.info} />
                    )}
                    <View>
                      <Text style={styles.menuItemValue}>
                        {syncingXeroItems ? 'Syncing items...' : 'Sync Items from Xero'}
                      </Text>
                      {lastSyncTime && !syncingXeroItems && (
                        <Text style={styles.xeroConnectedDate}>
                          Last synced: {new Date(lastSyncTime).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDisconnectXero}
                  disabled={xeroLoading}
                >
                  <View style={styles.menuItemLeft}>
                    {xeroLoading ? (
                      <ActivityIndicator size="small" color={theme.colors.danger} />
                    ) : (
                      <Ionicons name="unlink-outline" size={20} color={theme.colors.danger} />
                    )}
                    <Text style={[styles.menuItemValue, { color: theme.colors.danger }]}>
                      Disconnect Xero
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleConnectXero}
                disabled={xeroLoading}
              >
                <View style={styles.menuItemLeft}>
                  {xeroLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.info} />
                  ) : (
                    <Ionicons name="link-outline" size={20} color={theme.colors.info} />
                  )}
                  <View>
                    <Text style={styles.menuItemLabel}>Xero</Text>
                    <Text style={styles.menuItemValue}>
                      {xeroLoading ? 'Connecting...' : 'Connect your Xero account'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.integrationNote}>
            Connect Xero to automatically sync invoices when orders are approved.
          </Text>

          {/* Gmail Integration */}
          <View style={styles.menuCard}>
            {checkingGmail ? (
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={styles.menuItemValue}>Checking Gmail connection...</Text>
                </View>
              </View>
            ) : gmailStatus.connected ? (
              <>
                <View style={styles.menuItem}>
                  <View style={styles.menuItemLeft}>
                    <View style={styles.gmailConnectedIcon}>
                      <Ionicons name="mail" size={14} color={theme.colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuItemLabel}>Gmail</Text>
                      <Text style={[styles.menuItemValue, { color: theme.colors.success }]}>
                        Connected - {gmailStatus.email}
                      </Text>
                      {gmailStatus.lastSyncAt && (
                        <Text style={styles.xeroConnectedDate}>
                          Last sync: {new Date(gmailStatus.lastSyncAt).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Filter Settings Button */}
                <View style={styles.gmailFilterSection}>
                  <Text style={styles.gmailFilterTitle}>Email Filters</Text>
                  <View style={styles.gmailFilterInfo}>
                    <View style={styles.gmailFilterRow}>
                      <Text style={styles.gmailFilterLabel}>From:</Text>
                      <Text style={styles.gmailFilterValue}>
                        {gmailStatus.filterSender || 'Any sender'}
                      </Text>
                    </View>
                    <View style={styles.gmailFilterRow}>
                      <Text style={styles.gmailFilterLabel}>To:</Text>
                      <Text style={styles.gmailFilterValue}>
                        {gmailStatus.filterTo || 'Any recipient'}
                      </Text>
                    </View>
                    <View style={styles.gmailFilterRow}>
                      <Text style={styles.gmailFilterLabel}>Subject:</Text>
                      <Text style={styles.gmailFilterValue}>
                        {gmailStatus.filterSubject || 'Any subject'}
                      </Text>
                    </View>
                    <View style={styles.gmailFilterRow}>
                      <Text style={styles.gmailFilterLabel}>Folder:</Text>
                      <Text style={styles.gmailFilterValue}>
                        {gmailStatus.filterLabel || 'INBOX'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.gmailFilterButton}
                    onPress={handleOpenGmailFilters}
                  >
                    <Ionicons name="settings-outline" size={16} color={theme.colors.white} />
                    <Text style={styles.gmailFilterButtonText}>Configure Filters</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.menuDivider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDisconnectGmail}
                  disabled={gmailLoading}
                >
                  <View style={styles.menuItemLeft}>
                    {gmailLoading ? (
                      <ActivityIndicator size="small" color={theme.colors.danger} />
                    ) : (
                      <Ionicons name="unlink-outline" size={20} color={theme.colors.danger} />
                    )}
                    <Text style={[styles.menuItemValue, { color: theme.colors.danger }]}>
                      Disconnect Gmail
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleConnectGmail}
                disabled={gmailLoading}
              >
                <View style={styles.menuItemLeft}>
                  {gmailLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.info} />
                  ) : (
                    <Ionicons name="mail-outline" size={20} color={theme.colors.info} />
                  )}
                  <View>
                    <Text style={styles.menuItemLabel}>Gmail</Text>
                    <Text style={styles.menuItemValue}>
                      {gmailLoading ? 'Connecting...' : 'Connect Gmail for automatic orders'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.integrationNote}>
            Connect Gmail to automatically create orders from supplier emails.
          </Text>
        </View>
      )}

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
        <Text style={styles.signOutText}>
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </Text>
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity
        style={styles.deleteAccountButton}
        onPress={openDeleteAccountModal}
        disabled={deletingAccount}
      >
        <Ionicons name="trash-outline" size={20} color={theme.colors.textMuted} />
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Alfies v1.0.0</Text>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={showDeleteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)} disabled={deletingAccount}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.deleteWarningBox}>
                <Ionicons name="warning" size={32} color={theme.colors.danger} />
                <Text style={styles.deleteWarningTitle}>This action cannot be undone</Text>
              </View>

              <Text style={styles.deleteWarningText}>
                Deleting your account will permanently remove:
              </Text>
              <View style={styles.deleteWarningList}>
                <Text style={styles.deleteWarningItem}>Your profile and account information</Text>
                <Text style={styles.deleteWarningItem}>Your cart items and saved preferences</Text>
                <Text style={styles.deleteWarningItem}>Any connected integrations (Xero, Gmail)</Text>
                <Text style={styles.deleteWarningItem}>Your access to all associated businesses</Text>
              </View>

              <Text style={styles.deleteWarningText}>
                Order history will be preserved but will no longer be linked to your account.
              </Text>

              <Text style={styles.inputLabel}>Type "delete" to confirm:</Text>
              <TextInput
                style={styles.textInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="delete"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!deletingAccount}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  (deleteConfirmText.toLowerCase() !== 'delete' || deletingAccount) && styles.deleteConfirmButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons name="trash" size={18} color={theme.colors.white} />
                    <Text style={styles.deleteConfirmButtonText}>Delete Account</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gmail Filter Modal */}
      <Modal visible={showGmailFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Email Filters</Text>
              <TouchableOpacity onPress={() => setShowGmailFilterModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>From (Sender Email)</Text>
              <TextInput
                style={styles.textInput}
                value={gmailFilterSender}
                onChangeText={setGmailFilterSender}
                placeholder="e.g. orders@supplier.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.filterHint}>Only process emails from this sender</Text>

              <Text style={styles.inputLabel}>To (Recipient Email)</Text>
              <TextInput
                style={styles.textInput}
                value={gmailFilterTo}
                onChangeText={setGmailFilterTo}
                placeholder="e.g. orders@mybusiness.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.filterHint}>Only process emails sent to this address</Text>

              <Text style={styles.inputLabel}>Subject Contains</Text>
              <TextInput
                style={styles.textInput}
                value={gmailFilterSubject}
                onChangeText={setGmailFilterSubject}
                placeholder="e.g. Order, PO, Purchase"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={styles.filterHint}>Only process emails with this text in subject</Text>

              <Text style={styles.inputLabel}>Gmail Folder/Label</Text>
              {loadingLabels ? (
                <View style={styles.labelLoadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={styles.labelLoadingText}>Loading labels...</Text>
                </View>
              ) : gmailLabels.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.labelScrollView}>
                  {gmailLabels.map((label) => (
                    <TouchableOpacity
                      key={label.id}
                      style={[
                        styles.labelChip,
                        gmailFilterLabel === label.id && styles.labelChipActive,
                      ]}
                      onPress={() => setGmailFilterLabel(label.id)}
                    >
                      <Text
                        style={[
                          styles.labelChipText,
                          gmailFilterLabel === label.id && styles.labelChipTextActive,
                        ]}
                      >
                        {label.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TextInput
                  style={styles.textInput}
                  value={gmailFilterLabel}
                  onChangeText={setGmailFilterLabel}
                  placeholder="INBOX"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="none"
                />
              )}
              <Text style={styles.filterHint}>Select which folder/label to search for emails</Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowGmailFilterModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteButton, savingGmailFilters && styles.inviteButtonDisabled]}
                onPress={handleSaveGmailFilters}
                disabled={savingGmailFilters}
              >
                {savingGmailFilters ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={theme.colors.white} />
                    <Text style={styles.inviteButtonText}>Save Filters</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessName: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  userName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    ...theme.shadow.sm,
  },
  roleText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  menuCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  menuItemValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.danger + '30',
    marginBottom: theme.spacing.sm,
  },
  signOutText: {
    color: theme.colors.danger,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  deleteAccountText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
  },
  deleteWarningBox: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.danger + '10',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  deleteWarningTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.danger,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  deleteWarningText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  deleteWarningList: {
    marginBottom: theme.spacing.md,
    paddingLeft: theme.spacing.sm,
  },
  deleteWarningItem: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    paddingLeft: theme.spacing.sm,
  },
  deleteConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  deleteConfirmButtonDisabled: {
    opacity: 0.5,
  },
  deleteConfirmButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
  version: {
    textAlign: 'center',
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalBody: {
    padding: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  textInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteNote: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  inviteButton: {
    flex: 2,
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  inviteButtonDisabled: {
    opacity: 0.7,
  },
  inviteButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
  // Xero styles
  xeroConnectedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xeroConnectedDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  integrationNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
    lineHeight: 18,
  },
  // Gmail styles
  gmailConnectedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmailEmail: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  filterHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  labelLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  labelLoadingText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  labelScrollView: {
    marginVertical: theme.spacing.xs,
  },
  labelChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  labelChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  labelChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  labelChipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
  gmailFilterSection: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    marginHorizontal: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  gmailFilterTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  gmailFilterInfo: {
    marginBottom: theme.spacing.md,
  },
  gmailFilterRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  gmailFilterLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    width: 60,
  },
  gmailFilterValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    flex: 1,
  },
  gmailFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.info,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  gmailFilterButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
});
