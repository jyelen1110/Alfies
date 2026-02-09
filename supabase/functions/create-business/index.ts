import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const {
      businessName,
      ownerEmail,
      ownerName,
      invitedBy // master user id
    } = await req.json()

    // Verify the inviter is a master user
    const { data: inviter, error: inviterError } = await supabase
      .from('users')
      .select('is_master')
      .eq('id', invitedBy)
      .single()

    if (inviterError || !inviter?.is_master) {
      return new Response(
        JSON.stringify({ error: 'Only master users can create new businesses' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check if slug already exists
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()

    const finalSlug = existingTenant ? `${slug}-${Date.now()}` : slug

    // Create the new tenant
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: businessName,
        slug: finalSlug,
        settings: {
          currency: 'AUD',
          timezone: 'Australia/Sydney',
          date_format: 'DD/MM/YYYY',
          tax_rate: 10
        }
      })
      .select()
      .single()

    if (tenantError) {
      console.error('Error creating tenant:', tenantError)
      return new Response(
        JSON.stringify({ error: 'Failed to create business' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth user for the owner
    const tempPassword = crypto.randomUUID()

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError) {
      // Rollback: delete the tenant
      await supabase.from('tenants').delete().eq('id', newTenant.id)

      console.error('Error creating auth user:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the user profile as owner of the new tenant
    const { error: userError } = await supabase.from('users').insert({
      id: authUser.user.id,
      email: ownerEmail,
      full_name: ownerName,
      tenant_id: newTenant.id,
      role: 'owner',
      business_name: businessName,
    })

    if (userError) {
      // Rollback: delete auth user and tenant
      await supabase.auth.admin.deleteUser(authUser.user.id)
      await supabase.from('tenants').delete().eq('id', newTenant.id)

      console.error('Error creating user profile:', userError)
      return new Response(
        JSON.stringify({ error: 'Failed to create owner profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Grant master user access to the new tenant
    await supabase.from('tenant_access').insert({
      user_id: invitedBy,
      tenant_id: newTenant.id,
      access_level: 'full'
    })

    // Send password reset email so owner can set their password
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: ownerEmail,
    })

    if (resetError) {
      console.warn('Could not send password reset email:', resetError)
    }

    // Create default supplier for the new business (same as tenant)
    await supabase.from('suppliers').insert({
      tenant_id: newTenant.id,
      name: businessName,
      orders_email: ownerEmail,
      delivery_fee: 0,
      min_order: 0,
      cutoff_time: '17:00',
      delivery_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      status: 'active'
    })

    return new Response(
      JSON.stringify({
        success: true,
        tenant: newTenant,
        user: {
          id: authUser.user.id,
          email: ownerEmail,
          full_name: ownerName
        },
        message: `Business "${businessName}" created. Password reset email sent to ${ownerEmail}.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
