import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function synthesizeEmail(login: string): string {
  const normalized = login.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${normalized}@staff.pogostim.kz.internal`
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { employee_id, pin } = await req.json()
    if (!employee_id || !pin || String(pin).length < 4) {
      return jsonResponse({ error: 'employee_id and a PIN of at least 4 digits are required' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerData, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !callerData.user) {
      return jsonResponse({ error: 'Not authenticated' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: employee, error: employeeError } = await adminClient
      .from('staff_employees')
      .select('id, owner_id, login, auth_user_id')
      .eq('id', employee_id)
      .single()

    if (employeeError || !employee) {
      return jsonResponse({ error: 'Employee not found' }, 404)
    }

    if (employee.owner_id !== callerData.user.id) {
      return jsonResponse({ error: 'Not authorized for this employee' }, 403)
    }

    const email = synthesizeEmail(employee.login)
    let authUserId: string | null = employee.auth_user_id

    if (authUserId) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, { password: pin })
      if (updateError) throw updateError
    } else {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
      })
      if (createError || !created.user) throw createError ?? new Error('Failed to create auth user')
      authUserId = created.user.id

      const { error: setAuthIdError } = await adminClient
        .from('staff_employees')
        .update({ auth_user_id: authUserId })
        .eq('id', employee.id)
      if (setAuthIdError) throw setAuthIdError

      const { error: backfillError } = await adminClient
        .from('staff_shifts')
        .update({ auth_user_id: authUserId })
        .eq('employee_id', employee.id)
      if (backfillError) throw backfillError
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
