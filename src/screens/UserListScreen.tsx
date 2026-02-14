import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';

type User = {
  id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  role: 'owner' | 'user';
  customer_id?: string;
  business_name?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  accounts_email?: string;
  delivery_address?: string;
  delivery_instructions?: string;
};

type Invitation = {
  id: string;
  email: string;
  tenant_id: string;
  role: 'owner' | 'user';
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
  customer_data?: {
    customer_id?: string;
    business_name?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    accounts_email?: string;
    delivery_address?: string;
    delivery_instructions?: string;
  };
};

type RoleOption = 'owner' | 'user';

export default function UserListScreen() {
  const { user: currentUser, tenant, isMaster } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Invite modal state
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleOption>('user');
  const [inviting, setInviting] = useState(false);
  const [inviteBusinessName, setInviteBusinessName] = useState('');
  const [inviteOwnerName, setInviteOwnerName] = useState('');
  const [inviteBusinessType, setInviteBusinessType] = useState<'new' | 'existing'>('new');
  const [availableTenants, setAvailableTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Add customer modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addCustomerId, setAddCustomerId] = useState('');
  const [addBusinessName, setAddBusinessName] = useState('');
  const [addContactName, setAddContactName] = useState('');
  const [addContactPhone, setAddContactPhone] = useState('');
  const [addContactEmail, setAddContactEmail] = useState('');
  const [addAccountsEmail, setAddAccountsEmail] = useState('');
  const [addDeliveryAddress, setAddDeliveryAddress] = useState('');
  const [addDeliveryInstructions, setAddDeliveryInstructions] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editRole, setEditRole] = useState<RoleOption>('user');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Invitation detail modal state
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      // Fetch users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('full_name');

      if (userError) throw userError;
      setUsers(userData || []);

      // Fetch pending invitations
      const { data: inviteData, error: inviteError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (inviteError) throw inviteError;
      setInvitations(inviteData || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id]);

  // Fetch available tenants for master user
  const fetchTenants = useCallback(async () => {
    if (!isMaster()) return;
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAvailableTenants(data || []);
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  }, [isMaster]);

  // Initial load
  useEffect(() => {
    fetchData();
    fetchTenants();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // --- Add Customer Manually ---

  const openAddModal = () => {
    setAddEmail('');
    setAddCustomerId('');
    setAddBusinessName('');
    setAddContactName('');
    setAddContactPhone('');
    setAddContactEmail('');
    setAddAccountsEmail('');
    setAddDeliveryAddress('');
    setAddDeliveryInstructions('');
    setAddModalVisible(true);
  };

  const handleAddCustomer = async () => {
    if (!addEmail.trim()) {
      Alert.alert('Validation', 'Please enter an email address.');
      return;
    }
    if (!addBusinessName.trim()) {
      Alert.alert('Validation', 'Please enter a business name.');
      return;
    }
    if (!tenant?.id) return;

    // Check if email already exists as a user
    const existingUser = users.find(u => u.email.toLowerCase() === addEmail.trim().toLowerCase());
    if (existingUser) {
      Alert.alert('Already Registered', 'This email is already registered as a customer.');
      return;
    }

    // Check if there's already a pending invitation
    const existingInvite = invitations.find(i => i.email.toLowerCase() === addEmail.trim().toLowerCase());
    if (existingInvite) {
      Alert.alert('Invitation Exists', 'There is already a pending invitation for this email.');
      return;
    }

    setAdding(true);
    try {
      // Create invitation with pre-filled customer data
      const newId = Crypto.randomUUID();
      const token = generateInviteToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

      const customerData = {
        customer_id: addCustomerId.trim() || null,
        business_name: addBusinessName.trim(),
        contact_name: addContactName.trim() || null,
        contact_phone: addContactPhone.trim() || null,
        contact_email: addContactEmail.trim().toLowerCase() || addEmail.trim().toLowerCase(),
        accounts_email: addAccountsEmail.trim().toLowerCase() || null,
        delivery_address: addDeliveryAddress.trim() || null,
        delivery_instructions: addDeliveryInstructions.trim() || null,
      };

      const { data, error } = await supabase.from('user_invitations').insert({
        id: newId,
        email: addEmail.trim().toLowerCase(),
        tenant_id: tenant.id,
        role: 'user',
        token: token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        customer_data: customerData,
      }).select().single();

      if (error) throw error;

      // Clear form fields
      const customerName = addBusinessName.trim();
      const customerEmail = addEmail.trim();
      setAddEmail('');
      setAddCustomerId('');
      setAddBusinessName('');
      setAddContactName('');
      setAddContactPhone('');
      setAddContactEmail('');
      setAddAccountsEmail('');
      setAddDeliveryAddress('');
      setAddDeliveryInstructions('');

      setAddModalVisible(false);
      fetchData();

      // Show invitation created and offer to share
      setSelectedInvitation(data);
      setInvitationModalVisible(true);
      Alert.alert(
        'Invitation Created',
        `An invitation has been created for ${customerName}. They can register using ${customerEmail} and their details will be pre-filled.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add customer');
    } finally {
      setAdding(false);
    }
  };

  // --- Invite User ---

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteRole('user');
    setInviteModalVisible(true);
  };

  const generateInviteToken = (): string => {
    // Generate a URL-safe random token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const sendInvitationEmail = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          to: email,
          tenantName: tenant?.name || 'My Business',
          inviterName: currentUser?.full_name,
        },
      });

      if (error) {
        console.error('Failed to send invitation email:', error);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Error sending invitation email:', err);
      return false;
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Validation', 'Please enter an email address.');
      return;
    }
    if (!tenant?.id) return;

    // If master user is inviting an owner, create a new business
    if (isMaster() && inviteRole === 'owner') {
      if (inviteBusinessType === 'new') {
        // Creating a new business
        if (!inviteBusinessName.trim()) {
          Alert.alert('Validation', 'Please enter a business name for the new owner.');
          return;
        }
        if (!inviteOwnerName.trim()) {
          Alert.alert('Validation', 'Please enter the owner\'s name.');
          return;
        }

        setInviting(true);
        try {
          const { data: result, error: fnError } = await supabase.functions.invoke('create-business', {
            body: {
              businessName: inviteBusinessName.trim(),
              ownerEmail: inviteEmail.trim().toLowerCase(),
              ownerName: inviteOwnerName.trim(),
              invitedBy: currentUser?.id,
            },
          });

          if (fnError) {
            throw new Error(fnError.message || 'Failed to create business');
          }
          if (result?.error) {
            throw new Error(result.error);
          }

          setInviteModalVisible(false);
          setInviteEmail('');
          setInviteBusinessName('');
          setInviteOwnerName('');
          setInviteRole('user');
          setInviteBusinessType('new');
          setSelectedTenantId(null);

          Alert.alert(
            'Business Created',
            result.message || `New business "${inviteBusinessName}" created successfully.`
          );
          fetchTenants(); // Refresh tenant list
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to create business');
        } finally {
          setInviting(false);
        }
        return;
      } else {
        // Adding owner to existing business
        if (!selectedTenantId) {
          Alert.alert('Validation', 'Please select a business.');
          return;
        }
        if (!inviteOwnerName.trim()) {
          Alert.alert('Validation', 'Please enter the owner\'s name.');
          return;
        }

        setInviting(true);
        try {
          // Create invitation for existing business
          const newId = Crypto.randomUUID();
          const token = generateInviteToken();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          const { error } = await supabase.from('user_invitations').insert({
            id: newId,
            email: inviteEmail.trim().toLowerCase(),
            tenant_id: selectedTenantId,
            role: 'owner',
            token: token,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
            full_name: inviteOwnerName.trim(),
          });

          if (error) throw error;

          const selectedTenant = availableTenants.find(t => t.id === selectedTenantId);
          setInviteModalVisible(false);
          setInviteEmail('');
          setInviteBusinessName('');
          setInviteOwnerName('');
          setInviteRole('user');
          setInviteBusinessType('new');
          setSelectedTenantId(null);

          Alert.alert(
            'Owner Invitation Sent',
            `Invitation sent to ${inviteEmail} to join "${selectedTenant?.name}" as an owner.`
          );
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to send invitation');
        } finally {
          setInviting(false);
        }
        return;
      }
    }

    // Check if email already exists
    const existingUser = users.find(u => u.email.toLowerCase() === inviteEmail.trim().toLowerCase());
    if (existingUser) {
      Alert.alert('Already Registered', 'This email is already registered as a customer.');
      return;
    }

    // Check if there's already a pending invitation
    const existingInvite = invitations.find(i => i.email.toLowerCase() === inviteEmail.trim().toLowerCase());
    if (existingInvite) {
      Alert.alert('Invitation Exists', 'There is already a pending invitation for this email.');
      return;
    }

    setInviting(true);
    try {
      const newId = Crypto.randomUUID();
      const token = generateInviteToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { data, error } = await supabase.from('user_invitations').insert({
        id: newId,
        email: inviteEmail.trim().toLowerCase(),
        tenant_id: tenant.id,
        role: inviteRole,
        token: token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      }).select().single();

      if (error) throw error;

      // Send invitation email automatically
      const emailSent = await sendInvitationEmail(inviteEmail.trim().toLowerCase());

      setInviteModalVisible(false);
      fetchData();

      if (emailSent) {
        Alert.alert(
          'Invitation Sent',
          `An invitation email has been sent to ${inviteEmail.trim()}.`
        );
      } else {
        // Email failed but invitation was created - show manual options
        setSelectedInvitation(data);
        setInvitationModalVisible(true);
        Alert.alert(
          'Invitation Created',
          'The invitation was created but the email could not be sent automatically. You can share the invitation manually.'
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  // --- Invitation Actions ---

  const openInvitationModal = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setInvitationModalVisible(true);
  };

  const getInviteMessage = (email: string): string => {
    const tenantName = tenant?.name || 'our business';
    return `You've been invited to order from ${tenantName}!\n\nTo get started:\n1. Download the Easy Ordering app\n2. Tap "Have an invitation? Register here"\n3. Enter your email: ${email}\n4. Complete your registration\n\nWe look forward to serving you!`;
  };

  const shareInvitation = async () => {
    if (!selectedInvitation) return;

    try {
      await Share.share({
        message: getInviteMessage(selectedInvitation.email),
        title: 'Invitation to Order',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const copyInviteText = async () => {
    if (!selectedInvitation) return;
    const message = getInviteMessage(selectedInvitation.email);
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied', 'Invitation message copied to clipboard.');
  };

  const [sendingEmail, setSendingEmail] = useState(false);

  const resendInviteEmail = async () => {
    if (!selectedInvitation) return;

    setSendingEmail(true);
    try {
      const emailSent = await sendInvitationEmail(selectedInvitation.email);

      if (emailSent) {
        Alert.alert('Email Sent', `Invitation email has been sent to ${selectedInvitation.email}.`);
      } else {
        Alert.alert(
          'Email Failed',
          'Could not send the email automatically. Please use Share or Copy instead.'
        );
      }
    } catch (error) {
      console.error('Resend error:', error);
      Alert.alert('Error', 'Failed to resend invitation email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const cancelInvitation = async () => {
    if (!selectedInvitation) return;

    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation for ${selectedInvitation.email}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Invitation',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_invitations')
                .update({ status: 'cancelled' })
                .eq('id', selectedInvitation.id);

              if (error) throw error;

              setInvitationModalVisible(false);
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel invitation');
            }
          },
        },
      ]
    );
  };

  // --- Edit User ---

  const openEditModal = (u: User) => {
    setEditUser(u);
    setEditName(u.business_name || u.full_name);
    setEditCustomerId(u.customer_id || '');
    setEditRole(u.role);
    setEditModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    if (!editName.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          business_name: editName.trim(),
          customer_id: editCustomerId.trim() || null,
          role: editRole,
        })
        .eq('id', editUser.id);

      if (error) throw error;

      setEditModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = () => {
    if (!editUser) return;

    if (editUser.id === currentUser?.id) {
      Alert.alert('Error', 'You cannot remove yourself.');
      return;
    }

    Alert.alert(
      'Remove Customer',
      `Are you sure you want to remove ${editUser.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', editUser.id);

              if (error) throw error;

              setEditModalVisible(false);
              fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove customer');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // --- Role Picker (Owner option only visible to master users) ---

  const RolePicker = ({
    value,
    onChange,
  }: {
    value: RoleOption;
    onChange: (role: RoleOption) => void;
  }) => (
    <View style={styles.rolePicker}>
      <TouchableOpacity
        style={[
          styles.roleOption,
          value === 'user' && styles.roleOptionActive,
        ]}
        onPress={() => onChange('user')}
      >
        <Ionicons
          name="person"
          size={16}
          color={value === 'user' ? theme.colors.white : theme.colors.textSecondary}
        />
        <Text
          style={[
            styles.roleOptionText,
            value === 'user' && styles.roleOptionTextActive,
          ]}
        >
          Customer
        </Text>
      </TouchableOpacity>
      {isMaster() && (
        <TouchableOpacity
          style={[
            styles.roleOption,
            value === 'owner' && styles.roleOptionActiveOwner,
          ]}
          onPress={() => onChange('owner')}
        >
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={value === 'owner' ? theme.colors.white : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.roleOptionText,
              value === 'owner' && styles.roleOptionTextActive,
            ]}
          >
            Owner
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // --- Render User Card ---

  const renderUserCard = ({ item }: { item: User }) => {
    const isCurrentUser = item.id === currentUser?.id;
    const isOwnerRole = item.role === 'owner';

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatar}>
          <Ionicons
            name={isOwnerRole ? 'shield-checkmark' : 'person'}
            size={22}
            color={isOwnerRole ? theme.colors.accent : theme.colors.info}
          />
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.business_name || item.full_name}
            </Text>
            {isCurrentUser && (
              <Text style={styles.youBadge}>You</Text>
            )}
            {item.customer_id && (
              <Text style={styles.customerIdBadge}>{item.customer_id}</Text>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isOwnerRole
                ? theme.colors.accent + '18'
                : theme.colors.info + '18',
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: isOwnerRole
                  ? theme.colors.accent
                  : theme.colors.info,
              },
            ]}
          >
            {isOwnerRole ? 'Owner' : 'Customer'}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.textMuted}
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  };

  // --- Render Invitation Card ---

  const renderInvitationCard = ({ item }: { item: Invitation }) => {
    const expiresAt = new Date(item.expires_at);
    const isExpired = expiresAt < new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return (
      <TouchableOpacity
        style={[styles.userCard, styles.invitationCard]}
        onPress={() => openInvitationModal(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.userAvatar, styles.invitationAvatar]}>
          <Ionicons name="mail" size={22} color={theme.colors.warning} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.email}
          </Text>
          <Text style={[styles.userEmail, isExpired && styles.expiredText]}>
            {isExpired ? 'Expired' : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={[styles.badge, styles.pendingBadge]}>
          <Text style={styles.pendingBadgeText}>Pending</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.textMuted}
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  };

  // --- Empty State ---

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color={theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>No Customers Yet</Text>
        <Text style={styles.emptySubtitle}>
          Invite customers so they can place orders.
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={openInviteModal}>
          <Ionicons name="person-add" size={18} color={theme.colors.white} />
          <Text style={styles.emptyButtonText}>Invite Your First Customer</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // --- Header ---

  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerSubtitle}>
            {users.length} registered{invitations.length > 0 ? `, ${invitations.length} pending` : ''}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Ionicons name="add" size={20} color={theme.colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteButton} onPress={openInviteModal}>
            <Ionicons name="mail" size={18} color={theme.colors.white} />
            <Text style={styles.inviteButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- Main Render ---

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Build flat list with section headers
  type ListItem =
    | { type: 'header' }
    | { type: 'section-header'; title: string }
    | { type: 'invitation'; data: Invitation }
    | { type: 'user'; data: User };

  const listData: ListItem[] = [];

  // Add main header
  listData.push({ type: 'header' });

  // Add invitations section if any
  if (invitations.length > 0) {
    listData.push({ type: 'section-header', title: 'Pending Invitations' });
    invitations.forEach(inv => listData.push({ type: 'invitation', data: inv }));
  }

  // Add users section if any (filter out owners from customer list)
  const customers = users.filter(u => u.role !== 'owner');
  if (customers.length > 0) {
    listData.push({ type: 'section-header', title: 'Registered Customers' });
    customers.forEach(u => listData.push({ type: 'user', data: u }));
  }

  const renderListItem = ({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'header':
        return renderHeader();
      case 'section-header':
        return <Text style={styles.sectionHeader}>{item.title}</Text>;
      case 'invitation':
        return renderInvitationCard({ item: item.data });
      case 'user':
        return renderUserCard({ item: item.data });
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {customers.length === 0 && invitations.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          renderItem={() => null}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContentEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => {
            if (item.type === 'header') return 'header';
            if (item.type === 'section-header') return `section-${item.title}`;
            if (item.type === 'invitation') return `inv-${item.data.id}`;
            if (item.type === 'user') return `user-${item.data.id}`;
            return `item-${index}`;
          }}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Customer</Text>
              <TouchableOpacity
                onPress={() => setInviteModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inviteDescription}>
              Send an invitation to a new customer. They will receive a link to register and set up their account.
            </Text>

            <Text style={styles.inputLabel}>Role</Text>
            <RolePicker value={inviteRole} onChange={setInviteRole} />

            {isMaster() && inviteRole === 'owner' && (
              <>
                <Text style={styles.inputLabel}>Business</Text>
                <View style={styles.rolePicker}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      inviteBusinessType === 'new' && styles.roleOptionActive,
                    ]}
                    onPress={() => {
                      setInviteBusinessType('new');
                      setSelectedTenantId(null);
                    }}
                  >
                    <Ionicons
                      name="add-circle"
                      size={16}
                      color={inviteBusinessType === 'new' ? theme.colors.white : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        inviteBusinessType === 'new' && styles.roleOptionTextActive,
                      ]}
                    >
                      New Business
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      inviteBusinessType === 'existing' && styles.roleOptionActive,
                    ]}
                    onPress={() => setInviteBusinessType('existing')}
                  >
                    <Ionicons
                      name="business"
                      size={16}
                      color={inviteBusinessType === 'existing' ? theme.colors.white : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        inviteBusinessType === 'existing' && styles.roleOptionTextActive,
                      ]}
                    >
                      Existing
                    </Text>
                  </TouchableOpacity>
                </View>

                {inviteBusinessType === 'new' ? (
                  <>
                    <Text style={styles.inputLabel}>Business Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="New Business Name"
                      placeholderTextColor={theme.colors.textMuted}
                      value={inviteBusinessName}
                      onChangeText={setInviteBusinessName}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Select Business</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tenantPicker}>
                      {availableTenants.map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          style={[
                            styles.tenantOption,
                            selectedTenantId === t.id && styles.tenantOptionActive,
                          ]}
                          onPress={() => setSelectedTenantId(t.id)}
                        >
                          <Text
                            style={[
                              styles.tenantOptionText,
                              selectedTenantId === t.id && styles.tenantOptionTextActive,
                            ]}
                          >
                            {t.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                <Text style={styles.inputLabel}>Owner Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Smith"
                  placeholderTextColor={theme.colors.textMuted}
                  value={inviteOwnerName}
                  onChangeText={setInviteOwnerName}
                />
              </>
            )}

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="customer@example.com"
              placeholderTextColor={theme.colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.primaryButton, inviting && styles.buttonDisabled]}
              onPress={handleInvite}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={theme.colors.white} />
                  <Text style={styles.primaryButtonText}>
                    {isMaster() && inviteRole === 'owner'
                      ? (inviteBusinessType === 'new' ? 'Create Business' : 'Send Invitation')
                      : 'Send Invitation'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Customer Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.addModalContainer}
            >
              <View style={[styles.modalContent, styles.addModalContent]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Customer</Text>
                  <TouchableOpacity
                    onPress={() => setAddModalVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.addFormScroll}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.inputLabel}>Email Address *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="customer@example.com"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addEmail}
                    onChangeText={setAddEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={styles.inputLabel}>Customer ID</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. CUST001 (optional)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addCustomerId}
                    onChangeText={setAddCustomerId}
                    autoCapitalize="characters"
                  />

                  <Text style={styles.inputLabel}>Business Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Business name"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addBusinessName}
                    onChangeText={setAddBusinessName}
                  />

                  <Text style={styles.inputLabel}>Contact Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Primary contact"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addContactName}
                    onChangeText={setAddContactName}
                    autoCapitalize="words"
                  />

                  <Text style={styles.inputLabel}>Contact Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Phone number"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addContactPhone}
                    onChangeText={setAddContactPhone}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.inputLabel}>Contact Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Contact email"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addContactEmail}
                    onChangeText={setAddContactEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>Accounts Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email for invoices"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addAccountsEmail}
                    onChangeText={setAddAccountsEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.inputLabel}>Delivery Address</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Full delivery address"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addDeliveryAddress}
                    onChangeText={setAddDeliveryAddress}
                    multiline
                    numberOfLines={2}
                  />

                  <Text style={styles.inputLabel}>Delivery Instructions</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Special instructions"
                    placeholderTextColor={theme.colors.textMuted}
                    value={addDeliveryInstructions}
                    onChangeText={setAddDeliveryInstructions}
                    multiline
                    numberOfLines={2}
                  />

                  <View style={styles.scrollPadding} />
                </ScrollView>

                <TouchableOpacity
                  style={[styles.primaryButton, adding && styles.buttonDisabled]}
                  onPress={handleAddCustomer}
                  disabled={adding}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={theme.colors.white} />
                      <Text style={styles.primaryButtonText}>Add Customer</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Customer</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {editUser && (
              <Text style={styles.editEmail}>{editUser.email}</Text>
            )}

            <Text style={styles.inputLabel}>Customer ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. CUST001 (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={editCustomerId}
              onChangeText={setEditCustomerId}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Business Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter business name"
              placeholderTextColor={theme.colors.textMuted}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Role</Text>
            <RolePicker value={editRole} onChange={setEditRole} />

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSaveUser}
              disabled={saving || deleting}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={theme.colors.white} />
                  <Text style={styles.primaryButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            {editUser?.id !== currentUser?.id && (
              <TouchableOpacity
                style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                onPress={handleDeleteUser}
                disabled={saving || deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.colors.danger} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                    <Text style={styles.deleteButtonText}>Remove Customer</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invitation Detail Modal */}
      <Modal
        visible={invitationModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setInvitationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invitation Details</Text>
              <TouchableOpacity
                onPress={() => setInvitationModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedInvitation && (
              <>
                <View style={styles.invitationDetails}>
                  <View style={styles.invitationIconContainer}>
                    <Ionicons name="mail" size={40} color={theme.colors.warning} />
                  </View>
                  <Text style={styles.invitationEmail}>{selectedInvitation.email}</Text>
                  <Text style={styles.invitationStatus}>
                    {new Date(selectedInvitation.expires_at) < new Date()
                      ? 'This invitation has expired'
                      : `Expires ${new Date(selectedInvitation.expires_at).toLocaleDateString()}`}
                  </Text>
                </View>

                <View style={styles.invitationInfo}>
                  <Text style={styles.invitationInfoLabel}>How to register:</Text>
                  <View style={styles.invitationSteps}>
                    <Text style={styles.invitationStepText}>1. Open the app</Text>
                    <Text style={styles.invitationStepText}>2. Tap "Have an invitation? Register here"</Text>
                    <Text style={styles.invitationStepText}>3. Enter: {selectedInvitation.email}</Text>
                    <Text style={styles.invitationStepText}>4. Complete registration</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, sendingEmail && styles.buttonDisabled]}
                  onPress={resendInviteEmail}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <>
                      <Ionicons name="mail" size={18} color={theme.colors.white} />
                      <Text style={styles.primaryButtonText}>Send Email Invitation</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={shareInvitation}>
                  <Ionicons name="share-outline" size={18} color={theme.colors.accent} />
                  <Text style={styles.secondaryButtonText}>Share Invitation</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tertiaryButton} onPress={copyInviteText}>
                  <Ionicons name="copy-outline" size={18} color={theme.colors.textSecondary} />
                  <Text style={styles.tertiaryButtonText}>Copy Message</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteButton} onPress={cancelInvitation}>
                  <Ionicons name="close-circle-outline" size={18} color={theme.colors.danger} />
                  <Text style={styles.deleteButtonText}>Cancel Invitation</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  listContentEmpty: {
    flexGrow: 1,
    padding: theme.spacing.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.sm,
  },
  inviteButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
  },

  // User Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.sm,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  userName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flexShrink: 1,
  },
  youBadge: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
    backgroundColor: theme.colors.accent + '15',
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  customerIdBadge: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  userEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  chevron: {
    marginLeft: theme.spacing.sm,
  },
  separator: {
    height: theme.spacing.sm,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  emptyButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  addModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addModalContent: {
    maxHeight: '90%',
  },
  addFormScroll: {
    flexGrow: 0,
    marginBottom: theme.spacing.md,
  },
  scrollPadding: {
    height: theme.spacing.md,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: theme.spacing.sm + 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  editEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.sm,
  },

  // Form
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },

  // Role Picker
  rolePicker: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  roleOptionActive: {
    backgroundColor: theme.colors.info,
    borderColor: theme.colors.info,
  },
  roleOptionActiveOwner: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  roleOptionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  roleOptionTextActive: {
    color: theme.colors.white,
  },

  // Tenant picker for existing business selection
  tenantPicker: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    maxHeight: 44,
  },
  tenantOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
  },
  tenantOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tenantOptionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  tenantOptionTextActive: {
    color: theme.colors.white,
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.danger + '30',
    backgroundColor: theme.colors.surface,
  },
  deleteButtonText: {
    color: theme.colors.danger,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Section styles
  sectionHeader: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSeparator: {
    height: theme.spacing.md,
  },

  // Invitation card styles
  invitationCard: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning,
  },
  invitationAvatar: {
    backgroundColor: theme.colors.warning + '18',
  },
  pendingBadge: {
    backgroundColor: theme.colors.warning + '18',
  },
  pendingBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.warning,
  },
  expiredText: {
    color: theme.colors.danger,
  },

  // Invite modal styles
  inviteDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },

  // Invitation detail modal styles
  invitationDetails: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  invitationIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.warning + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  invitationEmail: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  invitationStatus: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  invitationInfo: {
    marginBottom: theme.spacing.md,
  },
  invitationInfoLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  invitationSteps: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  invitationStepText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    lineHeight: 20,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  tertiaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  tertiaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
});
