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
import { useOrders } from '../context/OrderContext';
import { supabase } from '../lib/supabase';
import { checkXeroConnection, connectXero, disconnectXero } from '../services/xero';
import { checkGmailConnection, connectGmail, disconnectGmail, updateGmailFilters, getGmailLabels, GmailConnectionStatus, GmailLabel } from '../services/gmail';
import BusinessSwitcher from '../components/BusinessSwitcher';

export default function SettingsScreen() {
  const { user, tenant, signOut, isOwner, isMaster } = useAuth();
  const { state } = useOrders();
  const [signingOut, setSigningOut] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);

  // Xero connection state
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroConnectedAt, setXeroConnectedAt] = useState<string | null>(null);
  const [xeroLoading, setXeroLoading] = useState(false);
  const [checkingXero, setCheckingXero] = useState(true);

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

  // Check for Gmail OAuth callback params (web only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
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

  const handleDisconnectXero = () => {
    Alert.alert(
      'Disconnect Xero',
      'Are you sure you want to disconnect Xero? New invoices will no longer sync automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            if (!tenant?.id) return;
            setXeroLoading(true);
            try {
              const result = await disconnectXero(tenant.id);
              if (result.success) {
                setXeroConnected(false);
                setXeroConnectedAt(null);
                Alert.alert('Success', 'Xero disconnected');
              } else {
                Alert.alert('Error', result.error || 'Failed to disconnect Xero');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect Xero');
            } finally {
              setXeroLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleConnectGmail = async () => {
    if (!tenant?.id) return;
    setGmailLoading(true);
    try {
      const result = await connectGmail(tenant.id);
      if (result.success) {
        setTimeout(async () => {
          await checkGmailStatus();
          setGmailLoading(false);
          Alert.alert('Success', 'Gmail connected! Order emails will be processed automatically.');
        }, 2000);
      } else {
        setGmailLoading(false);
        if (result.error !== 'Connection cancelled') {
          Alert.alert('Error', result.error || 'Failed to connect Gmail');
        }
      }
    } catch (error) {
      setGmailLoading(false);
      Alert.alert('Error', 'Failed to connect Gmail');
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

  const handleDisconnectGmail = () => {
    Alert.alert(
      'Disconnect Gmail',
      'Are you sure you want to disconnect Gmail? Order emails will no longer be processed automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            if (!tenant?.id) return;
            setGmailLoading(true);
            try {
              const result = await disconnectGmail(tenant.id);
              if (result.success) {
                setGmailStatus({ connected: false });
                Alert.alert('Success', 'Gmail disconnected');
              } else {
                Alert.alert('Error', result.error || 'Failed to disconnect Gmail');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect Gmail');
            } finally {
              setGmailLoading(false);
            }
          },
        },
      ]
    );
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

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    if (!inviteName.trim()) {
      Alert.alert('Error', 'Please enter a name for the user');
      return;
    }

    setInviting(true);
    try {
      // Create a pending invitation in the database
      const { error } = await supabase.from('user_invitations').insert({
        tenant_id: user?.tenant_id,
        email: inviteEmail.trim().toLowerCase(),
        full_name: inviteName.trim(),
        invited_by: user?.id,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Error', 'An invitation has already been sent to this email address');
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        Alert.alert(
          'Invitation Sent',
          `An invitation has been created for ${inviteName}. They can sign up using ${inviteEmail} to place orders.`
        );
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteName('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const stats = {
    suppliers: state.suppliers.length,
    items: state.items.length,
    orders: state.orders.length,
    invoices: state.invoices.length,
    pendingApprovals: state.orders.filter((o) => o.status === 'pending_approval').length,
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

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="storefront-outline" size={24} color={theme.colors.accent} />
            <Text style={styles.statValue}>{stats.suppliers}</Text>
            <Text style={styles.statLabel}>Suppliers</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cube-outline" size={24} color={theme.colors.info} />
            <Text style={styles.statValue}>{stats.items}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={24} color={theme.colors.success} />
            <Text style={styles.statValue}>{stats.orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={24} color={theme.colors.warning} />
            <Text style={styles.statValue}>{stats.invoices}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
        </View>
      </View>

      {/* Pending Approvals */}
      {isOwner() && stats.pendingApprovals > 0 && (
        <View style={styles.section}>
          <View style={styles.alertCard}>
            <Ionicons name="time" size={24} color={theme.colors.warning} />
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>
                {stats.pendingApprovals} order{stats.pendingApprovals !== 1 ? 's' : ''} awaiting approval
              </Text>
              <Text style={styles.alertSubtitle}>Review in the Orders tab</Text>
            </View>
          </View>
        </View>
      )}

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

      {/* Customer Management - Owner only */}
      {isOwner() && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Management</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowInviteModal(true)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-add-outline" size={20} color={theme.colors.success} />
                <View>
                  <Text style={styles.menuItemLabel}>Invite Customer</Text>
                  <Text style={styles.menuItemValue}>Send an invitation to a new customer</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

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

      <Text style={styles.version}>Easy Ordering v1.0.0</Text>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Customer</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Customer Name</Text>
              <TextInput
                style={styles.textInput}
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="Enter customer's name"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="Enter email address"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inviteNote}>
                The customer will be able to sign up and place orders from your store.
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteButton, inviting && styles.inviteButtonDisabled]}
                onPress={handleInviteUser}
                disabled={inviting}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color={theme.colors.white} />
                    <Text style={styles.inviteButtonText}>Send Invitation</Text>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  statValue: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning + '15',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning + '30',
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  alertSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
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
    marginBottom: theme.spacing.md,
  },
  signOutText: {
    color: theme.colors.danger,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
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
