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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
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
        signIn,
        signOut,
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
