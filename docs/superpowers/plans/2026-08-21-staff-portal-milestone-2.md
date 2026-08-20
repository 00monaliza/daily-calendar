# Staff Portal — Employee Access (Milestone 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner grant an employee login access (login + PIN) from the `/staff` tab, and let that employee log into a small, read-only "Schedules" portal (hostname-routed to `staff.pogostim.kz` in production, reachable via a `?staff=1` dev override locally) to see their own upcoming shifts and weekly hours — no attendance/clock-in, per the original spec's scope.

**Architecture:** Reuses Milestone 1's data model as-is (`staff_employees.auth_user_id`, `staff_shifts.auth_user_id`, and the `employee_reads_own_record`/`employee_reads_own_shifts` RLS policies already exist from migration `006_staff_scheduling.sql` — **no new migration in this plan**). Adds: a Supabase Edge Function that provisions/resets an employee's Supabase Auth user under a synthetic email (PIN as password, per ADR-0003) using the service-role key server-side; a manager-side UI action to trigger it; an employee-side login + schedule page; and a hostname branch at the app's entry point that swaps in a small, isolated employee router instead of the owner app, per ADR-0001.

**Tech Stack:** Same as Milestone 1 (React 19, TypeScript, Vite, Tailwind v4, Supabase JS + Edge Functions, TanStack Query, React Router 7, Vitest, Playwright), plus Deno (Supabase Edge Function runtime — no local install needed, the Supabase CLI bundles it) and `tsx` (new devDependency, to run the one-off RLS verification script).

**Spec:** [docs/superpowers/specs/2026-08-21-staff-scheduling-design.md](../specs/2026-08-21-staff-scheduling-design.md)
**Related:** [ADR-0001](../../adr/0001-single-deploy-two-surfaces.md), [ADR-0003](../../adr/0003-pin-auth-via-synthetic-email.md), [testing strategy](../../adr/testing-strategy-staff-scheduling.md), [deploy checklist](../../adr/deploy-checklist-staff-scheduling.md), [Milestone 1 plan](2026-08-21-staff-schedule-manager-tab.md) (already shipped and verified against production)

## Global Constraints

- No new database migration — `auth_user_id` columns and the employee-read RLS policies already exist on `staff_employees`/`staff_shifts` from `006_staff_scheduling.sql`.
- Employee login is PIN-based via a synthetic email (`<normalized-login>@staff.pogostim.kz.internal`), exactly as `src/shared/lib/staffAuthEmail.ts` already implements (Milestone 1) — reuse it, don't reimplement.
- The service-role key is **only** ever used inside the Edge Function (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, auto-injected by Supabase into every deployed function) — it must never appear in client code, `.env`, or any file in this repo.
- Still no real clock-in/clock-out and no Attendance tab — the employee portal has exactly one screen (Schedules), per the spec.
- The hostname branch must default to the owner app for every hostname except `staff.pogostim.kz` (or the explicit dev override) — a misconfigured branch must fail toward showing the owner app, never toward leaking it to the employee surface.
- Match existing code style: Tailwind utility classes inline, Russian UI copy, same component patterns as Milestone 1 (`BottomSheet` for modals, `toast` for feedback).
- No component-level unit tests (matches this codebase's convention, established in Milestone 1). Pure functions get Vitest tests; user flows get Playwright e2e tests; RLS gets the direct-Supabase-client script from the testing strategy doc.

---

### Task 1: Add the hostname/surface-detection pure function

**Files:**
- Create: `src/shared/lib/hostSurface.ts`
- Test: `src/shared/lib/hostSurface.test.ts`

**Interfaces:**
- Produces: `STAFF_HOSTNAME = 'staff.pogostim.kz'`, `isStaffHost(hostname: string, forceStaffApp: boolean): boolean`. Consumed by Task 11's `RootRouter`.

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/lib/hostSurface.test.ts
import { describe, expect, it } from 'vitest'
import { isStaffHost, STAFF_HOSTNAME } from './hostSurface'

describe('isStaffHost', () => {
  it('is true for the staff hostname', () => {
    expect(isStaffHost(STAFF_HOSTNAME, false)).toBe(true)
  })

  it('is false for the owner hostname', () => {
    expect(isStaffHost('pogostim.kz', false)).toBe(false)
  })

  it('is false for localhost by default', () => {
    expect(isStaffHost('localhost', false)).toBe(false)
  })

  it('is true when forced, regardless of hostname', () => {
    expect(isStaffHost('localhost', true)).toBe(true)
    expect(isStaffHost('pogostim.kz', true)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/lib/hostSurface.test.ts`
Expected: FAIL — `Cannot find module './hostSurface'`

- [ ] **Step 3: Implement**

```ts
// src/shared/lib/hostSurface.ts
export const STAFF_HOSTNAME = 'staff.pogostim.kz'

/**
 * Decides which app surface to render (see ADR-0001). `forceStaffApp` lets
 * the employee router be exercised without real DNS: locally via
 * VITE_FORCE_STAFF_APP, or in tests via a `?staff=1` query param — both are
 * read once by the caller (RootRouter) and passed in here as a plain bool,
 * keeping this function pure and easy to test exhaustively.
 */
export function isStaffHost(hostname: string, forceStaffApp: boolean): boolean {
  if (forceStaffApp) return true
  return hostname === STAFF_HOSTNAME
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/lib/hostSurface.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/hostSurface.ts src/shared/lib/hostSurface.test.ts
git commit -m "feat: add host-surface detection for owner vs staff portal routing"
```

---

### Task 2: Add the PinInput shared component

**Files:**
- Create: `src/shared/ui/PinInput.tsx`

**Interfaces:**
- Produces: `<PinInput value={string} onChange={(value: string) => void} autoFocus?={boolean} />` — digits-only, max 6 chars. Consumed by Task 8 (`EmployeeAccessModal`) and Task 9 (`StaffPortalLoginPage`).

- [ ] **Step 1: Build the component**

```tsx
// src/shared/ui/PinInput.tsx
interface Props {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function PinInput({ value, onChange, autoFocus }: Props) {
  return (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoFocus={autoFocus}
      value={value}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
      placeholder="••••••"
      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
    />
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/ui/PinInput.tsx
git commit -m "feat: add PinInput shared component"
```

---

### Task 3: Add the next-shift lookup pure function

**Files:**
- Create: `src/shared/lib/staffNextShift.ts`
- Test: `src/shared/lib/staffNextShift.test.ts`

**Interfaces:**
- Produces: type `ShiftForNextLookup { date: string; status: 'work' | 'day_off' | 'vacation' | 'sick'; start_time: string | null; end_time: string | null }`, `findNextShift(shifts: ShiftForNextLookup[], todayStr: string): ShiftForNextLookup | null`. Consumed by Task 10 (`StaffPortalSchedulePage`).

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/lib/staffNextShift.test.ts
import { describe, expect, it } from 'vitest'
import { findNextShift } from './staffNextShift'

describe('findNextShift', () => {
  it('returns null for an empty list', () => {
    expect(findNextShift([], '2026-08-20')).toBeNull()
  })

  it('picks the earliest upcoming work shift', () => {
    const shifts = [
      { date: '2026-08-25', status: 'work' as const, start_time: '08:00', end_time: '17:00' },
      { date: '2026-08-21', status: 'work' as const, start_time: '09:00', end_time: '18:00' },
    ]
    expect(findNextShift(shifts, '2026-08-20')).toEqual(shifts[1])
  })

  it('includes a shift scheduled for today', () => {
    const shifts = [{ date: '2026-08-20', status: 'work' as const, start_time: '08:00', end_time: '17:00' }]
    expect(findNextShift(shifts, '2026-08-20')).toEqual(shifts[0])
  })

  it('ignores past shifts', () => {
    const shifts = [{ date: '2026-08-19', status: 'work' as const, start_time: '08:00', end_time: '17:00' }]
    expect(findNextShift(shifts, '2026-08-20')).toBeNull()
  })

  it('ignores non-work statuses', () => {
    const shifts = [
      { date: '2026-08-21', status: 'day_off' as const, start_time: null, end_time: null },
      { date: '2026-08-22', status: 'vacation' as const, start_time: null, end_time: null },
    ]
    expect(findNextShift(shifts, '2026-08-20')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/lib/staffNextShift.test.ts`
Expected: FAIL — `Cannot find module './staffNextShift'`

- [ ] **Step 3: Implement**

```ts
// src/shared/lib/staffNextShift.ts
export interface ShiftForNextLookup {
  date: string
  status: 'work' | 'day_off' | 'vacation' | 'sick'
  start_time: string | null
  end_time: string | null
}

export function findNextShift(shifts: ShiftForNextLookup[], todayStr: string): ShiftForNextLookup | null {
  const upcoming = shifts
    .filter(s => s.status === 'work' && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
  return upcoming[0] ?? null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/lib/staffNextShift.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/staffNextShift.ts src/shared/lib/staffNextShift.test.ts
git commit -m "feat: add findNextShift pure helper"
```

---

### Task 4: Add self-lookup to the staff-employee entity

**Files:**
- Modify: `src/entities/staff-employee/api.ts`
- Modify: `src/entities/staff-employee/queries.ts`

**Interfaces:**
- Produces: `staffEmployeeApi.getByAuthUserId(authUserId: string)`, `useStaffEmployeeSelf(authUserId: string | undefined)`. Consumed by Task 10 (`StaffPortalSchedulePage`).

- [ ] **Step 1: Add the API method**

In `src/entities/staff-employee/api.ts`, add to the `staffEmployeeApi` object (alongside `getAll`):

```ts
  async getByAuthUserId(authUserId: string) {
    return supabase.from('staff_employees').select('*').eq('auth_user_id', authUserId).maybeSingle()
  },
```

- [ ] **Step 2: Add the query hook**

In `src/entities/staff-employee/queries.ts`, add:

```ts
export function useStaffEmployeeSelf(authUserId: string | undefined) {
  return useQuery({
    queryKey: ['staff-employee-self', authUserId],
    queryFn: async () => {
      if (!authUserId) return null
      const { data, error } = await staffEmployeeApi.getByAuthUserId(authUserId)
      if (error) throw error
      return data
    },
    enabled: !!authUserId,
    staleTime: 60_000,
  })
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/entities/staff-employee/api.ts src/entities/staff-employee/queries.ts
git commit -m "feat: add self-lookup query to staff-employee entity"
```

---

### Task 5: Add employee-scoped shift range to the staff-shift entity

**Files:**
- Modify: `src/entities/staff-shift/types.ts`
- Modify: `src/entities/staff-shift/api.ts`
- Modify: `src/entities/staff-shift/queries.ts`

**Interfaces:**
- Produces: `StaffShiftUpsert` gains an optional `auth_user_id?: string | null` field; `staffShiftApi.getRangeForEmployee(employeeId, fromDate, toDate)`; `useStaffShiftsForEmployee(employeeId: string | undefined, fromDate: string, toDate: string)`. Consumed by Task 6 (denormalization write) and Task 10 (employee schedule read).

**Why a separate query instead of reusing `useStaffShifts`:** `useStaffShifts` filters by `owner_id`. An employee's own `auth.uid()` is their own id, not the owner's — filtering by `owner_id = employeeAuthUid` would always return zero rows for an employee. The employee portal must query by `employee_id` instead and let RLS (not a client-side `owner_id` filter) do the access control.

- [ ] **Step 1: Add `auth_user_id` to the upsert type**

In `src/entities/staff-shift/types.ts`, modify `StaffShiftUpsert`:

```ts
export interface StaffShiftUpsert {
  owner_id: string
  employee_id: string
  auth_user_id?: string | null
  date: string
  status: StaffShiftStatus
  start_time?: string | null
  end_time?: string | null
  note?: string | null
}
```

- [ ] **Step 2: Add the API method**

In `src/entities/staff-shift/api.ts`, add to `staffShiftApi` (alongside `getRange`):

```ts
  async getRangeForEmployee(employeeId: string, fromDate: string, toDate: string) {
    return supabase
      .from('staff_shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', fromDate)
      .lte('date', toDate)
  },
```

- [ ] **Step 3: Add the query hook**

In `src/entities/staff-shift/queries.ts`, add:

```ts
export function useStaffShiftsForEmployee(employeeId: string | undefined, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['staff-shifts-for-employee', employeeId, fromDate, toDate],
    queryFn: async () => {
      if (!employeeId) return []
      const { data, error } = await staffShiftApi.getRangeForEmployee(employeeId, fromDate, toDate)
      if (error) throw error
      return data ?? []
    },
    enabled: !!employeeId,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/entities/staff-shift/types.ts src/entities/staff-shift/api.ts src/entities/staff-shift/queries.ts
git commit -m "feat: add employee-scoped shift range to staff-shift entity"
```

---

### Task 6: Denormalize auth_user_id onto shifts at write time (Milestone 1 touch-up)

**Files:**
- Modify: `src/widgets/staff-schedule-grid/ShiftEditModal.tsx`
- Modify: `src/widgets/staff-schedule-grid/StaffScheduleGrid.tsx`

**Why this is needed now:** `staff_shifts.auth_user_id` must match the employee's `staff_employees.auth_user_id` for the `employee_reads_own_shifts` RLS policy to work. Milestone 1 always wrote `auth_user_id` implicitly as whatever the DB default is (unset/null) because no employee had one yet. Now that employees can get access (this milestone), every future shift write must carry the employee's current `auth_user_id` — otherwise a shift edited after access was granted would still be invisible to that employee.

**Interfaces:**
- Consumes: nothing new (uses the `auth_user_id` field added to `StaffShiftUpsert` in Task 5).
- Changes: `ShiftEditModal` gains a required prop `employeeAuthUserId: string | null`; `StaffScheduleGrid` passes `employee.auth_user_id` through to it.

- [ ] **Step 1: Update ShiftEditModal's props and upsert payload**

In `src/widgets/staff-schedule-grid/ShiftEditModal.tsx`, update the `Props` interface and the `handleSave` function:

```ts
interface Props {
  open: boolean
  ownerId: string
  employeeId: string
  employeeAuthUserId: string | null
  date: string
  existingShift: StaffShift | undefined
  onClose: () => void
}
```

```ts
export function ShiftEditModal({ open, ownerId, employeeId, employeeAuthUserId, date, existingShift, onClose }: Props) {
```

In `handleSave`, add `auth_user_id: employeeAuthUserId,` to the object passed to `upsert.mutateAsync`:

```ts
    const { error } = await upsert.mutateAsync({
      owner_id: ownerId,
      employee_id: employeeId,
      auth_user_id: employeeAuthUserId,
      date,
      status,
      start_time: status === 'work' ? startTime : null,
      end_time: status === 'work' ? endTime : null,
      note: note || null,
    })
```

- [ ] **Step 2: Pass the employee's auth_user_id from StaffScheduleGrid**

In `src/widgets/staff-schedule-grid/StaffScheduleGrid.tsx`, the grid already has `editing.employeeId` when rendering `<ShiftEditModal>`. Look up the employee record to get its `auth_user_id` and pass it through:

```tsx
      {editing && (
        <ShiftEditModal
          open
          ownerId={ownerId}
          employeeId={editing.employeeId}
          employeeAuthUserId={employees.find(e => e.id === editing.employeeId)?.auth_user_id ?? null}
          date={editing.date}
          existingShift={editingShift}
          onClose={() => setEditing(null)}
        />
      )}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually verify the existing Milestone 1 flow still works**

Run `npm run dev`, open `/staff`, edit a shift for an employee with no access yet (auth_user_id null) — should save exactly as before (null passed through, no behavior change for employees without access).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/staff-schedule-grid/ShiftEditModal.tsx src/widgets/staff-schedule-grid/StaffScheduleGrid.tsx
git commit -m "fix: denormalize employee auth_user_id onto shifts at write time"
```

---

### Task 7: Build and deploy the staff-provision-employee Edge Function

**Files:**
- Create: `supabase/functions/staff-provision-employee/index.ts`

**Interfaces:**
- Produces: a deployed Edge Function `staff-provision-employee`, invoked as `supabase.functions.invoke('staff-provision-employee', { body: { employee_id: string, pin: string } })`, returning `{ success: true }` or `{ error: string }`. Consumed by Task 8 (`EmployeeAccessModal`).

**Security model:** The function reads the caller's identity from the forwarded `Authorization` header (the owner's own session — `supabase-js` attaches this automatically), verifies the target employee's `owner_id` matches that caller, and only then uses the service-role key to create/reset the employee's Supabase Auth user. On first provisioning it also backfills `auth_user_id` onto any of that employee's existing `staff_shifts` rows, so shifts scheduled before access was granted become visible too.

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/staff-provision-employee/index.ts
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
```

- [ ] **Step 2: Deploy the function**

The Supabase CLI on this machine is already authenticated (`supabase login` was completed during Milestone 1's migration work) and can see the project — `supabase functions deploy` uses the Management API (access token), not a direct DB connection, so it does **not** need the database password.

Run: `supabase functions deploy staff-provision-employee --project-ref mxszkkqebaroflrcweno --use-api`

Expected: deployment succeeds and prints a function URL. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available as environment variables inside every deployed Edge Function — no manual secret configuration needed for this function.

- [ ] **Step 3: Smoke-test the deployed function rejects unauthenticated calls**

Run:
```bash
curl -i -X POST "https://mxszkkqebaroflrcweno.supabase.co/functions/v1/staff-provision-employee" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"00000000-0000-0000-0000-000000000000","pin":"123456"}'
```
Expected: `401` with `{"error":"Missing Authorization header"}` (no `apikey`/auth header was sent). This confirms the function is live and its auth check is active before any real employee data is involved.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/staff-provision-employee/index.ts
git commit -m "feat: add staff-provision-employee Edge Function"
```

---

### Task 8: Add the manager-side "grant access" action

**Files:**
- Create: `src/widgets/staff-schedule-grid/EmployeeAccessModal.tsx`
- Modify: `src/widgets/staff-schedule-grid/StaffEmployeeListPanel.tsx`

**Interfaces:**
- Consumes: `PinInput` (Task 2), `supabase.functions.invoke` (`@/shared/api/supabaseClient`), `StaffEmployee` (Milestone 1).
- Produces: `<EmployeeAccessModal open employee={StaffEmployee} onClose={() => void} />`, and a "Доступ" button on each employee row in `StaffEmployeeListPanel` that opens it.

- [ ] **Step 1: Build EmployeeAccessModal**

```tsx
// src/widgets/staff-schedule-grid/EmployeeAccessModal.tsx
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
import { PinInput } from '@/shared/ui/PinInput'
import { toast } from '@/shared/ui/Toast'
import { supabase } from '@/shared/api/supabaseClient'
import type { StaffEmployee } from '@/entities/staff-employee/types'

interface Props {
  open: boolean
  employee: StaffEmployee
  onClose: () => void
}

export function EmployeeAccessModal({ open, employee, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const qc = useQueryClient()
  const hasAccess = !!employee.auth_user_id

  async function handleSubmit() {
    if (pin.length < 4) {
      toast.error('PIN должен быть не короче 4 цифр')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.functions.invoke('staff-provision-employee', {
      body: { employee_id: employee.id, pin },
    })
    setSubmitting(false)

    if (error) {
      toast.error('Не удалось выдать доступ')
      return
    }

    toast.success(hasAccess ? 'PIN обновлён' : 'Доступ выдан')
    qc.invalidateQueries({ queryKey: ['staff-employees'] })
    setPin('')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={hasAccess ? 'Сбросить PIN' : 'Выдать доступ'}>
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-500">
          Логин: <span className="font-mono">{employee.login}</span>. Сообщите сотруднику логин и PIN лично —
          это единственный способ входа на staff.pogostim.kz.
        </p>
        <PinInput value={pin} onChange={setPin} autoFocus />
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
        >
          {submitting ? 'Сохранение...' : hasAccess ? 'Обновить PIN' : 'Выдать доступ'}
        </button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 2: Wire it into StaffEmployeeListPanel**

In `src/widgets/staff-schedule-grid/StaffEmployeeListPanel.tsx`:

Add the import:
```ts
import { EmployeeAccessModal } from './EmployeeAccessModal'
```

Change `SortableEmployeeRow` to accept and render an access button. Replace the function with:

```tsx
function SortableEmployeeRow({ employee, onManageAccess }: { employee: StaffEmployee; onManageAccess: (employee: StaffEmployee) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: employee.id,
  })
  const updateEmployee = useUpdateStaffEmployee()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-gray-100 last:border-0 px-3 py-2.5"
    >
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab flex-shrink-0">
        ⠿
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{employee.full_name}</div>
        {employee.position && <div className="text-xs text-gray-500 truncate">{employee.position}</div>}
      </div>
      <button
        onClick={() => onManageAccess(employee)}
        className="text-xs font-medium text-[#376E6F] hover:underline flex-shrink-0"
      >
        {employee.auth_user_id ? 'PIN ✓' : 'Доступ'}
      </button>
      <Toggle
        checked={employee.is_active}
        onChange={checked => updateEmployee.mutate({ id: employee.id, data: { is_active: checked } })}
      />
    </div>
  )
}
```

In the `StaffEmployeeListPanel` component, add state and render the modal:

```tsx
export function StaffEmployeeListPanel({ ownerId, employees }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [accessEmployee, setAccessEmployee] = useState<StaffEmployee | null>(null)
  const reorderEmployees = useReorderStaffEmployees()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
```

(keep the rest of the function body as-is, then update the `SortableContext` children and add the modal before the closing `</div>`:)

```tsx
        <SortableContext items={employees.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {employees.map(employee => (
            <SortableEmployeeRow key={employee.id} employee={employee} onManageAccess={setAccessEmployee} />
          ))}
        </SortableContext>
      </DndContext>

      {employees.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-gray-400">Пока нет сотрудников</div>
      )}

      <AddEmployeeModal ownerId={ownerId} open={addOpen} onClose={() => setAddOpen(false)} />

      {accessEmployee && (
        <EmployeeAccessModal
          open
          employee={accessEmployee}
          onClose={() => setAccessEmployee(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open `/staff`, click "Доступ" on an employee row, enter a 6-digit PIN, submit. Confirm the toast says "Доступ выдан" and the row's button now reads "PIN ✓".

- [ ] **Step 5: Commit**

```bash
git add src/widgets/staff-schedule-grid/EmployeeAccessModal.tsx src/widgets/staff-schedule-grid/StaffEmployeeListPanel.tsx
git commit -m "feat: add manager UI to grant/reset employee access"
```

---

### Task 9: Build the employee login page

**Files:**
- Create: `src/pages/staff-portal/LoginPage.tsx`

**Interfaces:**
- Consumes: `signIn` (`@/features/auth/useUser`), `buildStaffSyntheticEmail` (`@/shared/lib/staffAuthEmail`), `PinInput` (Task 2).
- Produces: `<StaffPortalLoginPage />`. Consumed by Task 11 (`StaffAppRouter`).

- [ ] **Step 1: Build the page**

```tsx
// src/pages/staff-portal/LoginPage.tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '@/features/auth/useUser'
import { buildStaffSyntheticEmail } from '@/shared/lib/staffAuthEmail'
import { PinInput } from '@/shared/ui/PinInput'

export function StaffPortalLoginPage() {
  const [login, setLogin] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    let email: string
    try {
      email = buildStaffSyntheticEmail(login)
    } catch {
      setError('Введите логин')
      return
    }

    setLoading(true)
    const { error: authError } = await signIn(email, pin)
    setLoading(false)

    if (authError) {
      setError('Неверный логин или PIN')
      return
    }

    navigate('/schedule')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#376E6F]">Pogostim Staff</h1>
          <p className="text-gray-500 mt-1 text-sm">Вход по логину и PIN-коду</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="block text-gray-500 mb-1">Логин</span>
            <input
              type="text"
              required
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Телефон или имя пользователя"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-gray-500 mb-1">PIN</span>
            <PinInput value={pin} onChange={setPin} />
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/staff-portal/LoginPage.tsx
git commit -m "feat: add staff portal login page"
```

---

### Task 10: Build the employee schedule page

**Files:**
- Create: `src/pages/staff-portal/SchedulePage.tsx`

**Interfaces:**
- Consumes: `useUser`, `signOut` (`@/features/auth/useUser`), `useStaffEmployeeSelf` (Task 4), `useStaffShiftsForEmployee` (Task 5), `sumShiftHours` (Milestone 1, `@/shared/lib/staffShiftHours`), `findNextShift` (Task 3).
- Produces: `<StaffPortalSchedulePage />`. Consumed by Task 11 (`StaffAppRouter`).

- [ ] **Step 1: Build the page**

```tsx
// src/pages/staff-portal/SchedulePage.tsx
import { addDays, format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { SignOut } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { signOut, useUser } from '@/features/auth/useUser'
import { useStaffEmployeeSelf } from '@/entities/staff-employee/queries'
import { useStaffShiftsForEmployee } from '@/entities/staff-shift/queries'
import { sumShiftHours } from '@/shared/lib/staffShiftHours'
import { findNextShift } from '@/shared/lib/staffNextShift'

const STATUS_LABEL: Record<string, string> = {
  work: '',
  day_off: 'Выходной',
  vacation: 'Отпуск',
  sick: 'Больничный',
}

export function StaffPortalSchedulePage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { data: employee } = useStaffEmployeeSelf(user?.id)

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const fromDate = format(weekStart, 'yyyy-MM-dd')
  const toDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  const { data: shifts = [] } = useStaffShiftsForEmployee(employee?.id, fromDate, toDate)

  const weekHours = sumShiftHours(
    shifts.map(s => ({ status: s.status, start_time: s.start_time, end_time: s.end_time }))
  )
  const nextShift = findNextShift(shifts, todayStr)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  if (!employee) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <div className="text-sm font-semibold text-gray-800">{employee.full_name}</div>
          {employee.position && <div className="text-xs text-gray-500">{employee.position}</div>}
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600" aria-label="Выйти">
          <SignOut size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Следующая смена</div>
          {nextShift ? (
            <>
              <div className="text-2xl font-bold text-[#376E6F] tabular-nums">
                {nextShift.date === todayStr ? 'Сегодня' : format(new Date(nextShift.date), 'd MMMM', { locale: ru })}
                {', '}
                {nextShift.start_time?.slice(0, 5)}–{nextShift.end_time?.slice(0, 5)}
              </div>
              {employee.position && <div className="text-sm text-gray-500 mt-1">{employee.position}</div>}
            </>
          ) : (
            <div className="text-sm text-gray-400">Нет запланированных смен</div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-sm font-bold text-[#376E6F] tabular-nums">{weekHours.toFixed(1)} ч</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Часов на этой неделе</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {shifts.map(shift => (
            <div
              key={shift.id}
              className="flex items-center justify-between border-b border-gray-100 last:border-0 px-4 py-2.5"
            >
              <span className="text-sm text-gray-700">{format(new Date(shift.date), 'EEE d MMM', { locale: ru })}</span>
              <span className="text-sm tabular-nums text-gray-800">
                {shift.status === 'work'
                  ? `${shift.start_time?.slice(0, 5)}–${shift.end_time?.slice(0, 5)}`
                  : STATUS_LABEL[shift.status]}
              </span>
            </div>
          ))}
          {shifts.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">На этой неделе нет смен</div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/staff-portal/SchedulePage.tsx
git commit -m "feat: add staff portal schedule page"
```

---

### Task 11: Wire up the employee router and the hostname branch

**Files:**
- Create: `src/app/staff/StaffProtectedRoute.tsx`
- Create: `src/app/staff/StaffAppRouter.tsx`
- Create: `src/app/RootRouter.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `isStaffHost` (Task 1), `StaffPortalLoginPage` (Task 9), `StaffPortalSchedulePage` (Task 10), `useUser` (`@/features/auth/useUser`), `AppRouter` (Milestone 1).
- Produces: `<RootRouter />`, mounted in `main.tsx` in place of `<AppRouter />` directly.

- [ ] **Step 1: Add the employee-portal protected route**

```tsx
// src/app/staff/StaffProtectedRoute.tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useUser } from '@/features/auth/useUser'

interface Props {
  children: ReactNode
}

export function StaffProtectedRoute({ children }: Props) {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Add the employee-portal router**

```tsx
// src/app/staff/StaffAppRouter.tsx
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { StaffProtectedRoute } from './StaffProtectedRoute'

const StaffPortalLoginPage = lazy(() =>
  import('@/pages/staff-portal/LoginPage').then(m => ({ default: m.StaffPortalLoginPage }))
)
const StaffPortalSchedulePage = lazy(() =>
  import('@/pages/staff-portal/SchedulePage').then(m => ({ default: m.StaffPortalSchedulePage }))
)

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#376E6F] border-t-transparent" />
    </div>
  )
}

export function StaffAppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<StaffPortalLoginPage />} />
        <Route
          path="/schedule"
          element={
            <StaffProtectedRoute>
              <StaffPortalSchedulePage />
            </StaffProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </Suspense>
  )
}
```

- [ ] **Step 3: Add the root surface switch**

```tsx
// src/app/RootRouter.tsx
import { AppRouter } from './router/AppRouter'
import { StaffAppRouter } from './staff/StaffAppRouter'
import { isStaffHost } from '@/shared/lib/hostSurface'

/**
 * Decides once, at initial render, which surface to show (see ADR-0001).
 * Deliberately does NOT re-evaluate on every client-side navigation — the
 * chosen surface is sticky for the lifetime of the page load, which is
 * exactly right: an owner session and an employee session never need to
 * swap mid-session. The `?staff=1` query param exists only so the staff
 * portal can be exercised in dev/tests without real DNS for
 * staff.pogostim.kz.
 */
export function RootRouter() {
  const forceStaffApp =
    import.meta.env.VITE_FORCE_STAFF_APP === 'true' ||
    new URLSearchParams(window.location.search).get('staff') === '1'

  return isStaffHost(window.location.hostname, forceStaffApp) ? <StaffAppRouter /> : <AppRouter />
}
```

- [ ] **Step 4: Mount RootRouter in main.tsx**

In `src/main.tsx`, replace the `AppRouter` import and usage:

```ts
import { RootRouter } from './app/RootRouter'
```

(remove the `import { AppRouter } from './app/router/AppRouter'` line), and change the render:

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <RootRouter />
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manually verify both surfaces**

Run `npm run dev`. Open `http://localhost:5173/` normally — the owner app must load exactly as before (chess grid, nav, etc.). Then open `http://localhost:5173/login?staff=1` — the staff portal login page must load instead, with no owner navigation visible anywhere on the page.

- [ ] **Step 7: Commit**

```bash
git add src/app/staff/StaffProtectedRoute.tsx src/app/staff/StaffAppRouter.tsx src/app/RootRouter.tsx src/main.tsx
git commit -m "feat: add hostname-routed staff portal entry point"
```

---

### Task 12: Add the hostname-routing Playwright test

**Files:**
- Create: `tests/e2e/staff-hostname-routing.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/staff-hostname-routing.spec.ts
import { expect, test } from '@playwright/test'

test('employee portal surface never exposes owner-only navigation', async ({ page }) => {
  await page.goto('/login?staff=1')

  await expect(page.getByRole('heading', { name: 'Pogostim Staff' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Квартиры' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Финансы' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Гости' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Персонал' })).toHaveCount(0)
})
```

- [ ] **Step 2: Run it**

Ensure the dev server is running, then:

Run: `npx playwright test tests/e2e/staff-hostname-routing.spec.ts`
Expected: PASS (1 test)

If a selector doesn't match, use `npm run test:e2e:ui` to inspect the actual rendered page and adjust the selector — don't change app code to fit the test unless there's a real bug.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/staff-hostname-routing.spec.ts
git commit -m "test: add hostname-routing isolation e2e test"
```

---

### Task 13: Add the full PIN-login-and-schedule Playwright e2e test

**Files:**
- Create: `tests/e2e/staff-portal-login.spec.ts`

**Interfaces:**
- Consumes: `TEST_EMAIL`/`TEST_PASSWORD` from `.env.local` (owner account), the deployed `staff-provision-employee` function (Task 7).

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/staff-portal-login.spec.ts
import { expect, test } from '@playwright/test'

test('employee can log in after manager grants access and sees their schedule', async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.local')
  }

  const employeeName = `Portal E2E ${Date.now()}`
  const login = `portale2e${Date.now()}`
  const pin = '135790'

  // Manager: sign in, create the employee, grant access, set today's shift
  await page.goto('/auth')
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')

  await page.goto('/staff')
  await page.getByRole('button', { name: '+ Добавить' }).click()
  await page.getByLabel('Имя', { exact: true }).fill(employeeName)
  await page.getByLabel('Должность').fill('Portal Server')
  await page.getByLabel('Логин (телефон или имя пользователя)').fill(login)
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  const row = page.getByRole('row', { name: employeeName })
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Доступ' }).click()
  await page.getByPlaceholder('••••••').fill(pin)
  await page.getByRole('button', { name: 'Выдать доступ' }).click()

  await row.locator('td').nth(1).locator('button').click()
  await page.getByLabel('Начало').fill('09:00')
  await page.getByLabel('Конец').fill('18:00')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(row.getByText('09:00–18:00')).toBeVisible()

  // Employee: sign out of the owner session, then log into the staff portal
  await page.getByRole('button', { name: 'Личный кабинет' }).click()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.waitForURL('/auth')

  await page.goto('/login?staff=1')
  await page.getByPlaceholder('Телефон или имя пользователя').fill(login)
  await page.getByPlaceholder('••••••').fill(pin)
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page.getByText(employeeName)).toBeVisible()
  await expect(page.getByText('09:00–18:00')).toBeVisible()
})
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/staff-portal-login.spec.ts`
Expected: PASS (1 test)

Fix any selector mismatches the same way as Task 12 — inspect via `test:e2e:ui`, adjust selectors only, never app code, unless a real bug surfaces.

- [ ] **Step 3: Clean up the test employee**

This test's employee (login prefixed `portale2e`) is real data in the production database. After confirming the test passes, delete it: sign in as the owner in the browser, go to `/staff`, and remove it — or run the same REST cleanup pattern used at the end of Milestone 1 (`DELETE .../staff_employees?login=like.portale2e*` with the owner's access token).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/staff-portal-login.spec.ts
git commit -m "test: add PIN-login-and-schedule e2e test"
```

---

### Task 14: Add the RLS cross-employee-leakage verification script

**Files:**
- Modify: `package.json` (add `tsx` devDependency and a `"test:rls": "tsx tests/rls/staff-scheduling.rls.ts"` script)
- Create: `tests/rls/staff-scheduling.rls.ts`

**Why this can't be skipped:** this is the one test that proves the actual security property Milestone 2 depends on — that one employee's Supabase session cannot read another employee's shifts. Per the testing strategy doc, this must pass before real employees start using the portal.

- [ ] **Step 1: Install tsx**

Run: `npm install -D tsx`

- [ ] **Step 2: Write the script**

```ts
// tests/rls/staff-scheduling.rls.ts
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

  const { error: writeError } = await employeeAClient
    .from('staff_shifts')
    .update({ status: 'day_off' })
    .eq('employee_id', employeeA.id)
  if (!writeError) throw new Error('FAIL: Employee A was able to write to staff_shifts — should be read-only')

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
```

- [ ] **Step 3: Add the npm script**

In `package.json`, alongside `"test:unit"`:

```json
"test:rls": "tsx tests/rls/staff-scheduling.rls.ts"
```

- [ ] **Step 4: Run it**

```bash
set -a; source .env.local; set +a; npm run test:rls
```

Expected: `PASS: RLS isolation verified — no cross-employee leakage, employee writes correctly rejected`, then the script exits 0. If it throws `FAIL: ...`, that's a real RLS bug — stop and fix the policy, don't relax the test.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/rls/staff-scheduling.rls.ts
git commit -m "test: add RLS cross-employee leakage verification script"
```

---

## What's Next (not in this plan)

The `staff.pogostim.kz` domain itself — adding it to the Vercel project and pointing DNS at it — is a manual, owner-performed step (Vercel dashboard + DNS registrar access, neither of which this plan's executor has). Until that's done, the whole employee portal is fully functional and testable via the `?staff=1` dev override (as Tasks 11-13 do) and works on any Vercel preview deployment the same way. Once the domain is live, the exact same code serves `staff.pogostim.kz` with no further changes — the hostname check in `RootRouter` picks it up automatically.
