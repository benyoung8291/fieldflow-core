import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !requestingUser) {
      throw new Error('Unauthorized')
    }

    // Check if requesting user is admin
    const { data: requestingProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', requestingUser.id)
      .single()

    if (!requestingProfile) {
      throw new Error('Profile not found')
    }

    const { data: adminRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('tenant_id', requestingProfile.tenant_id)
      .in('role', ['tenant_admin', 'super_admin'])

    if (!adminRoles || adminRoles.length === 0) {
      throw new Error('Insufficient permissions')
    }

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
    const errorMessage = error instanceof Error ? error.message : 'An error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
