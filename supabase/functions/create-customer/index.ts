// Create Customer - Creates auth user and database record
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CustomerData {
  email: string;
  business_name: string;
  customer_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  accounts_email?: string;
  delivery_address?: string;
  delivery_instructions?: string;
  xero_contact_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Create Customer - Start ===');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the calling user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get caller's tenant
    const { data: callerData, error: callerError } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (callerError || !callerData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only owners can create customers
    if (callerData.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only owners can create customers' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerData: CustomerData = await req.json();
    console.log('Creating customer:', customerData.email);

    if (!customerData.email || !customerData.business_name) {
      return new Response(JSON.stringify({ error: 'Email and business name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if email already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === customerData.email.toLowerCase()
    );

    if (emailExists) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a random temporary password
    const tempPassword = crypto.randomUUID() + '!' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create auth user
    const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: customerData.email.toLowerCase(),
      password: tempPassword,
      email_confirm: true, // Auto-confirm email so they can log in
      user_metadata: {
        business_name: customerData.business_name,
      },
    });

    if (createAuthError || !authUser.user) {
      console.error('Failed to create auth user:', createAuthError);
      return new Response(JSON.stringify({ error: createAuthError?.message || 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Auth user created:', authUser.user.id);

    // Create database record
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: authUser.user.id,
      email: customerData.email.toLowerCase(),
      full_name: customerData.contact_name || customerData.business_name,
      tenant_id: callerData.tenant_id,
      role: 'user',
      customer_id: customerData.customer_id || null,
      business_name: customerData.business_name,
      contact_name: customerData.contact_name || null,
      contact_phone: customerData.contact_phone || null,
      contact_email: customerData.contact_email || customerData.email.toLowerCase(),
      accounts_email: customerData.accounts_email || null,
      delivery_address: customerData.delivery_address || null,
      delivery_instructions: customerData.delivery_instructions || null,
      xero_contact_id: customerData.xero_contact_id || null,
    });

    if (dbError) {
      console.error('Failed to create database record:', dbError);
      // Try to clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: dbError.message || 'Failed to create customer record' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Database record created');

    // Send password reset email so customer can set their own password
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: customerData.email.toLowerCase(),
    });

    if (resetError) {
      console.warn('Failed to generate password reset link:', resetError);
      // Don't fail the whole operation, just log it
    }

    // Actually send the reset email
    const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(
      customerData.email.toLowerCase(),
      {
        redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/callback`,
      }
    );

    if (emailError) {
      console.warn('Failed to send password reset email:', emailError);
    } else {
      console.log('Password reset email sent');
    }

    console.log('=== Create Customer - Success ===');
    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUser.user.id,
        message: 'Customer created. A password reset email has been sent.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('=== Create Customer - Error ===');
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
