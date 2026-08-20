import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!
const TEST_EMAIL = process.env.TEST_EMAIL!
const TEST_PASSWORD = process.env.TEST_PASSWORD!

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEST_EMAIL and TEST_PASSWORD must be set')
  }

  const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: signInData, error: signInError } = await ownerClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  if (signInError || !signInData.user) throw new Error('Owner sign-in failed: ' + signInError?.message)
  const ownerId = signInData.user.id

  const suffix = Date.now()
  const loginA = `rlstesta${suffix}`
  const loginB = `rlstestb${suffix}`
  const pinA = '135790'
  const pinB = '246801'

  async function createEmployee(login: string) {
    const { data, error } = await ownerClient
      .from('staff_employees')
      .insert({ owner_id: ownerId, full_name: `RLS Test ${login}`, login })
      .select()
      .single()
    if (error || !data) throw new Error('Failed to create employee: ' + error?.message)
    return data
  }

  const employeeA = await createEmployee(loginA)
  const employeeB = await createEmployee(loginB)

  async function provision(employeeId: string, pin: string) {
    const { error } = await ownerClient.functions.invoke('staff-provision-employee', {
      body: { employee_id: employeeId, pin },
    })
    if (error) throw new Error('Provisioning failed: ' + error.message)
  }

  await provision(employeeA.id, pinA)
  await provision(employeeB.id, pinB)

  const today = new Date().toISOString().slice(0, 10)

  async function createShift(employeeId: string) {
    const { data: emp } = await ownerClient
      .from('staff_employees')
      .select('auth_user_id')
      .eq('id', employeeId)
      .single()
    const { error } = await ownerClient.from('staff_shifts').insert({
      owner_id: ownerId,
      employee_id: employeeId,
      auth_user_id: emp?.auth_user_id ?? null,
      date: today,
      status: 'work',
      start_time: '08:00',
      end_time: '17:00',
    })
    if (error) throw new Error('Failed to create shift: ' + error.message)
  }

  await createShift(employeeA.id)
  await createShift(employeeB.id)

  const employeeAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { error: loginAError } = await employeeAClient.auth.signInWithPassword({
    email: `${loginA}@staff.pogostim.kz.internal`,
    password: pinA,
  })
  if (loginAError) throw new Error('Employee A login failed: ' + loginAError.message)

  const { data: visibleShifts, error: readError } = await employeeAClient.from('staff_shifts').select('*')
  if (readError) throw new Error('Employee A read failed: ' + readError.message)

  const leaked = (visibleShifts ?? []).some(s => s.employee_id === employeeB.id)
  if (leaked) throw new Error('FAIL: Employee A can see Employee B shifts — RLS leakage!')

  const canSeeOwn = (visibleShifts ?? []).some(s => s.employee_id === employeeA.id)
  if (!canSeeOwn) throw new Error('FAIL: Employee A cannot see their own shift')

  // A blocked-by-RLS update is not an error from PostgREST's perspective —
  // it succeeds having matched zero rows. So the real signal is whether any
  // row was actually returned/changed, not whether an error was thrown.
  const { data: writeResult, error: writeError } = await employeeAClient
    .from('staff_shifts')
    .update({ status: 'day_off' })
    .eq('employee_id', employeeA.id)
    .select()
  if (writeError) throw new Error('Unexpected error attempting the write: ' + writeError.message)
  if ((writeResult ?? []).length > 0) {
    throw new Error('FAIL: Employee A was able to write to staff_shifts — should be read-only')
  }

  console.log('PASS: RLS isolation verified — no cross-employee leakage, employee writes correctly rejected')

  await ownerClient.from('staff_shifts').delete().eq('employee_id', employeeA.id)
  await ownerClient.from('staff_shifts').delete().eq('employee_id', employeeB.id)
  await ownerClient.from('staff_employees').delete().eq('id', employeeA.id)
  await ownerClient.from('staff_employees').delete().eq('id', employeeB.id)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
