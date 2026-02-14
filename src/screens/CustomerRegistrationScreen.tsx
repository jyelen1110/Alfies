import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { supabase } from '../lib/supabase';

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

interface Props {
  route: {
    params?: {
      token?: string;
      email?: string;
    };
  };
  navigation: any;
}

export default function CustomerRegistrationScreen({ route, navigation }: Props) {
  const { token, email: inviteEmail } = route.params || {};

  // Form state
  const [email, setEmail] = useState(inviteEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile fields
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [accountsEmail, setAccountsEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<any>(null);
  const [step, setStep] = useState<'credentials' | 'profile'>('credentials');

  // Password validation
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSymbol: false,
  });

  useEffect(() => {
    if (token) {
      validateInvitationByToken();
    } else {
      setIsValidating(false);
    }
  }, [token]);

  const validateInvitationByToken = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        setError('This invitation link is invalid or has expired.');
        setIsValidating(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError('This invitation link has expired. Please contact the business owner for a new invitation.');
        setIsValidating(false);
        return;
      }

      setInvitation(data);
      setEmail(data.email);
      setContactEmail(data.email);
      setIsValidating(false);
    } catch {
      setError('Failed to validate invitation. Please try again.');
      setIsValidating(false);
    }
  };

  const checkInvitationByEmail = async (emailToCheck: string) => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('email', emailToCheck.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        return null;
      }

      // Check if expired (skip if no expiry set)
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Validate password as user types
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    });
  }, [password]);


  const isPasswordValid = (): boolean => {
    return Object.values(passwordValidation).every(Boolean);
  };

  const handleNextStep = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!isPasswordValid()) {
      setError('Please ensure your password meets all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // If no invitation yet, check by email
    if (!invitation) {
      setIsLoading(true);
      const foundInvitation = await checkInvitationByEmail(email.trim());
      setIsLoading(false);

      if (!foundInvitation) {
        setError('No invitation found for this email address. Please contact the business owner to request an invitation.');
        return;
      }

      setInvitation(foundInvitation);
      setContactEmail(email.trim());
    }

    setStep('profile');
  };

  const handleRegister = async () => {
    setError(null);

    // Validate required profile fields
    if (!businessName.trim()) {
      setError('Business name is required.');
      return;
    }
    if (!contactName.trim()) {
      setError('Contact name is required.');
      return;
    }
    if (!contactPhone.trim()) {
      setError('Contact phone is required.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setError('Delivery address is required.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create account');

      // 2. Sign in immediately to establish session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (signInError) throw signInError;

      // 3. Create the user profile (now authenticated)
      const { error: profileError } = await supabase.from('users').upsert({
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        full_name: contactName.trim(),
        tenant_id: invitation?.tenant_id,
        role: invitation?.role || 'user',
        business_name: businessName.trim(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim().toLowerCase(),
        accounts_email: accountsEmail.trim().toLowerCase(),
        delivery_address: deliveryAddress.trim(),
        delivery_instructions: deliveryInstructions.trim() || null,
      });

      if (profileError) throw profileError;

      // 4. Mark invitation as accepted
      if (invitation) {
        await supabase
          .from('user_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', invitation.id);
      }

      // Navigation will be handled by auth state change
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <View style={styles.validationItem}>
      <Ionicons
        name={valid ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={valid ? theme.colors.success : theme.colors.textMuted}
      />
      <Text style={[styles.validationText, valid && styles.validationTextValid]}>
        {text}
      </Text>
    </View>
  );

  if (isValidating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Validating invitation...</Text>
      </View>
    );
  }

  if (error && !invitation && token) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={theme.colors.danger} />
        <Text style={styles.errorTitle}>Invalid Invitation</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <Ionicons name="cart" size={64} color={theme.colors.white} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            {step === 'credentials' ? 'Set up your login' : 'Business Details'}
          </Text>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'credentials' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'profile' && styles.stepDotActive]} />
        </View>

        <View style={styles.formCard}>
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === 'credentials' ? (
            <>
              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={theme.colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, invitation && styles.inputDisabled]}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!invitation && !isLoading}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password"
                    placeholderTextColor={theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.validationContainer}>
                <Text style={styles.validationTitle}>Password must contain:</Text>
                <ValidationItem valid={passwordValidation.minLength} text="At least 8 characters" />
                <ValidationItem valid={passwordValidation.hasUppercase} text="One uppercase letter" />
                <ValidationItem valid={passwordValidation.hasLowercase} text="One lowercase letter" />
                <ValidationItem valid={passwordValidation.hasNumber} text="One number" />
                <ValidationItem valid={passwordValidation.hasSymbol} text="One symbol (!@#$%^&*...)" />
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={theme.colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor={theme.colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <Text style={styles.mismatchText}>Passwords do not match</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, !isPasswordValid() && styles.buttonDisabled]}
                onPress={handleNextStep}
                disabled={!isPasswordValid() || isLoading}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Business Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Business Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your business name"
                  placeholderTextColor={theme.colors.textMuted}
                  value={businessName}
                  onChangeText={setBusinessName}
                  editable={!isLoading}
                />
              </View>

              {/* Contact Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Primary contact person"
                  placeholderTextColor={theme.colors.textMuted}
                  value={contactName}
                  onChangeText={setContactName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              {/* Contact Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Phone *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contact phone number"
                  placeholderTextColor={theme.colors.textMuted}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
              </View>

              {/* Contact Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Primary contact email"
                  placeholderTextColor={theme.colors.textMuted}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              {/* Accounts Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Accounts Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Email for invoices"
                  placeholderTextColor={theme.colors.textMuted}
                  value={accountsEmail}
                  onChangeText={setAccountsEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              {/* Delivery Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Address *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Full delivery address"
                  placeholderTextColor={theme.colors.textMuted}
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline
                  numberOfLines={3}
                  editable={!isLoading}
                />
              </View>

              {/* Delivery Instructions */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Instructions (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Special delivery instructions"
                  placeholderTextColor={theme.colors.textMuted}
                  value={deliveryInstructions}
                  onChangeText={setDeliveryInstructions}
                  multiline
                  numberOfLines={2}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.backStepButton}
                  onPress={() => setStep('credentials')}
                  disabled={isLoading}
                >
                  <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
                  <Text style={styles.backStepButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, styles.submitButton, isLoading && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.colors.white} size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Create Account</Text>
                      <Ionicons name="checkmark" size={20} color={theme.colors.white} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Back to Login Link */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
            disabled={isLoading}
          >
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1565A0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1565A0',
    gap: theme.spacing.md,
  },
  loadingText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  errorTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  errorMessage: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    backgroundColor: '#1565A0',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  backButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepDotActive: {
    backgroundColor: theme.colors.white,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadow.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 4,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.danger,
    fontWeight: theme.fontWeight.medium,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs + 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
  },
  inputIcon: {
    paddingLeft: theme.spacing.sm + 4,
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: theme.spacing.sm + 2,
  },
  inputDisabled: {
    backgroundColor: theme.colors.border,
    color: theme.colors.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: theme.spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  eyeButton: {
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.sm,
  },
  validationContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  validationTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  validationText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  validationTextValid: {
    color: theme.colors.success,
  },
  mismatchText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  backStepButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#1565A0',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    marginTop: theme.spacing.sm,
  },
  submitButton: {
    flex: 1,
    marginTop: 0,
  },
  primaryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  loginLinkText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  loginLinkBold: {
    fontWeight: theme.fontWeight.semibold,
    color: '#1565A0',
  },
});
