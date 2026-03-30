// Delete Account - Allows users to delete their own account (Apple App Store requirement)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Delete Account - Start ===');

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

    const userId = user.id;
    console.log('Deleting account for user:', userId);

    // Get user data to check role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role, tenant_id, is_master')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use admin client for deletion operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // If user is an owner, check if they're the only owner in the tenant
    if (userData.role === 'owner') {
      const { data: otherOwners, error: ownerCheckError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('tenant_id', userData.tenant_id)
        .eq('role', 'owner')
        .neq('id', userId);

      if (ownerCheckError) {
        console.error('Error checking for other owners:', ownerCheckError);
        return new Response(JSON.stringify({ error: 'Failed to verify account status' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!otherOwners || otherOwners.length === 0) {
        return new Response(JSON.stringify({
          error: 'Cannot delete the only owner account. Please transfer ownership or delete the entire business first.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // If user is a master admin, prevent deletion
    if (userData.is_master) {
      return new Response(JSON.stringify({
        error: 'Master admin accounts cannot be deleted through the app. Please contact support.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete user's integration tokens
    const { error: tokensError } = await supabaseAdmin
      .from('integration_tokens')
      .delete()
      .eq('user_id', userId);

    if (tokensError) {
      console.warn('Error deleting integration tokens:', tokensError);
      // Continue - don't fail the whole operation
    } else {
      console.log('Deleted integration tokens');
    }

    // Delete user's Gmail connections
    const { error: gmailError } = await supabaseAdmin
      .from('gmail_connections')
      .delete()
      .eq('user_id', userId);

    if (gmailError) {
      console.warn('Error deleting Gmail connections:', gmailError);
      // Continue - don't fail the whole operation
    } else {
      console.log('Deleted Gmail connections');
    }

    // Delete user's cart items (should cascade, but be explicit)
    const { error: cartError } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (cartError) {
      console.warn('Error deleting cart items:', cartError);
    } else {
      console.log('Deleted cart items');
    }

    // Delete tenant access records (for master users - shouldn't hit this due to check above)
    const { error: tenantAccessError } = await supabaseAdmin
      .from('tenant_access')
      .delete()
      .eq('user_id', userId);

    if (tenantAccessError) {
      console.warn('Error deleting tenant access:', tenantAccessError);
    } else {
      console.log('Deleted tenant access records');
    }

    // Delete customer_suppliers relationships
    const { error: supplierError } = await supabaseAdmin
      .from('customer_suppliers')
      .delete()
      .eq('customer_id', userId);

    if (supplierError) {
      console.warn('Error deleting customer_suppliers:', supplierError);
    } else {
      console.log('Deleted customer_suppliers relationships');
    }

    // Nullify references in orders (created_by, approved_by) to preserve order history
    // These are nullable fields, so we just remove the user reference
    const { error: ordersCreatedError } = await supabaseAdmin
      .from('orders')
      .update({ created_by: null })
      .eq('created_by', userId);

    if (ordersCreatedError) {
      console.warn('Error nullifying orders.created_by:', ordersCreatedError);
    }

    const { error: ordersApprovedError } = await supabaseAdmin
      .from('orders')
      .update({ approved_by: null })
      .eq('approved_by', userId);

    if (ordersApprovedError) {
      console.warn('Error nullifying orders.approved_by:', ordersApprovedError);
    }

    console.log('Nullified order references');

    // Delete the user record from the users table
    const { error: userDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (userDeleteError) {
      console.error('Error deleting user record:', userDeleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Deleted user record');

    // Delete the auth user (this is the final step)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      // Auth deletion failed - this is critical for privacy compliance
      return new Response(JSON.stringify({
        error: 'Failed to complete account deletion. Please contact support.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Deleted auth user');
    console.log('=== Delete Account - Success ===');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('=== Delete Account - Error ===');
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
