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

    // Check if email already exists as a customer in the database
    const { data: existingCustomer } = await supabaseAdmin
      .from('users')
      .select('id, email, role, tenant_id, business_name')
      .eq('email', customerData.email.toLowerCase())
      .single();

    if (existingCustomer) {
      // User exists - check if they're a customer (not an owner)
      if (existingCustomer.role !== 'user') {
        return new Response(JSON.stringify({ error: 'Email belongs to an owner account, cannot add as customer' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if relationship already exists with this tenant
      const { data: existingRelationship } = await supabaseAdmin
        .from('customer_suppliers')
        .select('id')
        .eq('customer_id', existingCustomer.id)
        .eq('supplier_tenant_id', callerData.tenant_id)
        .single();

      if (existingRelationship) {
        return new Response(JSON.stringify({ error: 'Customer is already connected to your business' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create new supplier relationship for existing customer
      const { error: relationshipError } = await supabaseAdmin
        .from('customer_suppliers')
        .insert({
          customer_id: existingCustomer.id,
          supplier_tenant_id: callerData.tenant_id,
          status: 'active',
          accepted_at: new Date().toISOString(),
        });

      if (relationshipError) {
        console.error('Failed to create customer relationship:', relationshipError);
        return new Response(JSON.stringify({ error: 'Failed to connect customer' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Connected existing customer:', existingCustomer.id);
      return new Response(
        JSON.stringify({
          success: true,
          user_id: existingCustomer.id,
          message: `Connected to existing customer: ${existingCustomer.business_name || existingCustomer.email}`,
          existing_customer: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if email exists in auth but not in users table (edge case)
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExistsInAuth = existingAuthUsers?.users?.some(
      u => u.email?.toLowerCase() === customerData.email.toLowerCase()
    );

    if (emailExistsInAuth) {
      return new Response(JSON.stringify({ error: 'Email already registered but not as a customer' }), {
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

    // Create customer_suppliers relationship for multi-supplier support
    const { error: relationshipError } = await supabaseAdmin
      .from('customer_suppliers')
      .insert({
        customer_id: authUser.user.id,
        supplier_tenant_id: callerData.tenant_id,
        status: 'active',
        accepted_at: new Date().toISOString(),
      });

    if (relationshipError) {
      console.warn('Failed to create customer_suppliers relationship:', relationshipError);
      // Don't fail the whole operation - the user is created, relationship can be added later
    } else {
      console.log('Customer supplier relationship created');
    }

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
