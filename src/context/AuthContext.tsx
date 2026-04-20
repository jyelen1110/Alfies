import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Tenant } from '../types';
import { registerForPushNotifications, clearPushToken } from '../services/notifications';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  isOwner: () => boolean;
  isMaster: () => boolean;
  allTenants: Tenant[];
  switchTenant: (tenantId: string) => Promise<void>;
  activeTenantId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Check URL for recovery token on web and process it
    const checkForRecoveryToken = async () => {
      if (typeof window === 'undefined') return false;

      // Check both hash and query params (Supabase uses different formats)
      const hash = window.location.hash.substring(1);
      const query = window.location.search.substring(1);

      // Try hash first, then query params
      let params = new URLSearchParams(hash);
      if (!params.get('type') && !params.get('access_token')) {
        params = new URLSearchParams(query);
      }

      const type = params.get('type');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const tokenHash = params.get('token_hash');

      console.log('Recovery check:', { type, hasAccessToken: !!accessToken, hasTokenHash: !!tokenHash });

      // Handle PKCE flow (token_hash)
      if (type === 'recovery' && tokenHash) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          console.log('verifyOtp result:', { data, error });

          if (data.session) {
            setSession(data.session);
            setIsPasswordRecovery(true);
            setIsLoading(false);
            window.history.replaceState(null, '', window.location.pathname);
            return true;
          }
        } catch (e) {
          console.error('Error verifying recovery token:', e);
        }
      }

      // Handle implicit flow (access_token)
      if (type === 'recovery' && accessToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          console.log('setSession result:', { data, error });

          if (data.session) {
            setSession(data.session);
            setIsPasswordRecovery(true);
            setIsLoading(false);
            window.history.replaceState(null, '', window.location.pathname);
            return true;
          }
        } catch (e) {
          console.error('Error setting session from recovery token:', e);
        }
      }

      // Just type=recovery without tokens (show screen anyway)
      if (type === 'recovery') {
        setIsPasswordRecovery(true);
        setIsLoading(false);
        return true;
      }

      return false;
    };

    checkForRecoveryToken().then((isRecovery) => {
      if (!isRecovery) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          if (session?.user) {
            fetchUserProfile(session.user.id);
          } else {
            setIsLoading(false);
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      if (session?.user && !isPasswordRecovery) {
        fetchUserProfile(session.user.id);
      } else if (!session) {
        setUser(null);
        setTenant(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*, tenant:tenants(*)')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const userProfile: User = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        tenant_id: userData.tenant_id,
        role: userData.role,
        is_master: userData.is_master || false,
        customer_id: userData.customer_id,
        business_name: userData.business_name,
        contact_name: userData.contact_name,
        contact_phone: userData.contact_phone,
        contact_email: userData.contact_email,
        accounts_email: userData.accounts_email,
        delivery_address: userData.delivery_address,
        delivery_instructions: userData.delivery_instructions,
      };

      setUser(userProfile);
      setTenant(userData.tenant);
      setActiveTenantId(userData.tenant_id);

      // If master user, load all tenants
      if (userData.is_master) {
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*')
          .order('name');
        setAllTenants(tenantsData || []);
      }

      // Register for push notifications
      registerForPushNotifications().catch((err) => {
        console.log('Push notification registration skipped:', err);
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectTo = 'https://easy-ordering.vercel.app';

      // Use direct fetch to avoid Supabase client issues on web
      const response = await fetch(
        `https://cijgmmckafmfmmlpvgyi.supabase.co/auth/v1/recover`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamdtbWNrYWZtZm1tbHB2Z3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjQzNTgsImV4cCI6MjA4NTYwMDM1OH0.nwe0aDmwCKGbdFHwiWhEv6aeonwwOO1mmLQTQw2wuFU',
          },
          body: JSON.stringify({
            email,
            redirect_to: redirectTo,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return { error: new Error(data.message || 'Failed to send reset email') };
      }

      return { error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // Clear push token before signing out
    await clearPushToken().catch(() => {});
    await supabase.auth.signOut();
  };

  const isOwner = (): boolean => {
    return user?.role === 'owner';
  };

  const isMaster = (): boolean => {
    return user?.is_master === true;
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const switchTenant = async (tenantId: string) => {
    if (!user?.is_master) return;

    const { data: tenantData, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error('Error switching tenant:', error);
      return;
    }

    setTenant(tenantData);
    setActiveTenantId(tenantId);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        tenant,
        isLoading,
        isPasswordRecovery,
        clearPasswordRecovery,
        signIn,
        signOut,
        resetPassword,
        isOwner,
        isMaster,
        allTenants,
        switchTenant,
        activeTenantId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
