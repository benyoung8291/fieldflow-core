import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'
import { corsHeaders } from '../_shared/cors.ts'
import { sanitizeError, sanitizeAuthError, sanitizeDatabaseError } from '../_shared/errorHandler.ts'

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
      return new Response(JSON.stringify({ error: sanitizeAuthError(userError, 'list-tenant-users') }), {
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
      return new Response(JSON.stringify({ error: sanitizeAuthError(new Error('No tenant'), 'list-tenant-users') }), {
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
      return new Response(JSON.stringify({ error: sanitizeAuthError(new Error('Insufficient permissions'), 'list-tenant-users') }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get all profiles in the tenant
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('tenant_id', profile.tenant_id)

    if (profilesError) {
      return new Response(JSON.stringify({ error: sanitizeDatabaseError(profilesError, 'list-tenant-users') }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user roles
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .eq('tenant_id', profile.tenant_id)

    // Combine the data (email now comes from profiles)
    const combinedData = profiles?.map((profile) => {
      const roles = userRoles?.filter((role) => role.user_id === profile.id) || []
      const hasWorkerRole = roles.some(r => r.role === 'worker')
      
      return {
        ...profile,
        user_roles: roles,
        has_worker_role: hasWorkerRole,
      }
    })

    return new Response(JSON.stringify({ users: combinedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: sanitizeError(error, 'list-tenant-users') }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
