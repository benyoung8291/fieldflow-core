import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Delete user request received')
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ No authorization header')
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔐 Validating user token')
    
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !requestingUser) {
      console.error('❌ User validation failed:', userError)
      throw new Error('Unauthorized')
    }

    console.log('✅ User validated:', requestingUser.id)

    // Check if requesting user is admin
    console.log('📋 Fetching user profile')
    const { data: requestingProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', requestingUser.id)
      .single()

    if (profileError || !requestingProfile) {
      console.error('❌ Profile fetch failed:', profileError)
      throw new Error('Profile not found')
    }

    console.log('✅ Profile found, tenant_id:', requestingProfile.tenant_id)
    console.log('🔍 Checking admin roles')

    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('tenant_id', requestingProfile.tenant_id)
      .in('role', ['tenant_admin', 'super_admin'])

    console.log('📊 Admin roles query result:', { 
      adminRoles, 
      rolesError,
      count: adminRoles?.length || 0 
    })

    if (rolesError) {
      console.error('❌ Roles query failed:', rolesError)
      throw new Error('Failed to verify permissions')
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.error('❌ No admin roles found for user:', requestingUser.id)
      throw new Error('Insufficient permissions')
    }

    console.log('✅ User has admin role(s):', adminRoles.map(r => r.role))

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    // Cannot delete yourself
    if (userId === requestingUser.id) {
      throw new Error('Cannot delete your own account')
    }

    // Check if user belongs to same tenant
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .single()

    if (!userProfile || userProfile.tenant_id !== requestingProfile.tenant_id) {
      throw new Error('User not found in your organization')
    }

    // Check if this is the last admin
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', requestingProfile.tenant_id)

    const hasAdminRole = userRoles?.some(r => r.role === 'tenant_admin' || r.role === 'super_admin')

    if (hasAdminRole) {
      const { data: adminCount } = await supabaseAdmin
        .from('user_roles')
        .select('id', { count: 'exact' })
        .eq('tenant_id', requestingProfile.tenant_id)
        .in('role', ['tenant_admin', 'super_admin'])

      if ((adminCount?.length || 0) <= 1) {
        throw new Error('Cannot delete the last admin user')
      }
    }

    // Delete user (cascade will handle related records)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('❌ Error in delete-user:', error)
    console.error('Error type:', typeof error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
