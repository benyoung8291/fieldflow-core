import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get the requesting user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user's tenant_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user is admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id)

    const isAdmin = roles?.some(r => r.role === 'tenant_admin')

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get all profiles in the tenant
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('tenant_id', profile.tenant_id)

    if (profilesError) throw profilesError

    // Get user roles
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .eq('tenant_id', profile.tenant_id)

    // Get all auth users for this tenant
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) throw authError

    // Combine the data
    const combinedData = profiles?.map((profile) => {
      const authUser = authUsers.find((u) => u.id === profile.id)
      const roles = userRoles?.filter((role) => role.user_id === profile.id) || []
      const hasWorkerRole = roles.some(r => r.role === 'worker')
      
      return {
        ...profile,
        email: authUser?.email || null,
        user_roles: roles,
        has_worker_role: hasWorkerRole,
      }
    })

    return new Response(JSON.stringify({ users: combinedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
