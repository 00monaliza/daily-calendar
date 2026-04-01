# Profile & Settings Pages — Design Spec
**Date:** 2026-04-02
**Scope:** A (Profile) + B (General Settings) + C (Calendar Settings)
**Stack:** React 19 + TypeScript + Supabase + TanStack Query + Zustand + Tailwind CSS

---

## 1. Goals

Add `/profile` and `/settings` routes wired to the existing UserMenu dropdown buttons. Both pages follow the existing visual design (color `#376E6F`, card-based layout, Phosphor icons, Tailwind).

Out of scope for this iteration: language switching (no translations exist), avatar upload, team/multi-user, notifications, integrations, dark theme.

---

## 2. Data Layer

### Supabase: new `settings` table

```sql
create table settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  date_format   text    not null default 'DD.MM.YYYY',  -- 'DD.MM.YYYY' | 'MM.DD.YYYY'
  week_start    text    not null default 'monday',       -- 'monday' | 'sunday'
  timezone      text    not null default 'Asia/Almaty',
  show_full_text boolean not null default true,
  compact_mode  boolean not null default false
);

-- Row-level security: user can only read/write their own row
alter table settings enable row level security;
create policy "owner" on settings using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Existing `profiles` table
Already has: `id`, `full_name`, `phone`. No schema changes needed.

### New entity: `src/entities/settings/`

**types.ts**
```ts
export interface UserSettings {
  user_id: string
  date_format: 'DD.MM.YYYY' | 'MM.DD.YYYY'
  week_start: 'monday' | 'sunday'
  timezone: string
  show_full_text: boolean
  compact_mode: boolean
}
export type SettingsPatch = Partial<Omit<UserSettings, 'user_id'>>
```

**api.ts**
- `getSettings(userId)` → `supabase.from('settings').select('*').eq('user_id', userId).single()`
- `upsertSettings(userId, patch)` → `supabase.from('settings').upsert({ user_id: userId, ...patch })`

**queries.ts**
- `useSettings()` — React Query, key `['settings', userId]`, uses `useUser()` for userId
- `useUpdateSettings()` — `useMutation` calling `upsertSettings`, invalidates `['settings', userId]`

If `getSettings` returns null (first time), fall back to defaults.

---

## 3. Profile Page (`/profile`)

### Route
```
/profile  →  ProfilePage.tsx  (inside ProtectedRoute + AppLayout)
```

### Layout
Two cards stacked vertically (same card style as rest of app):

**Card 1 — Профиль**
- Large avatar circle (80px, initials, `#376E6F` bg) — centered at top
- Fields: Имя (`full_name`), Телефон (`phone`), Email
- All fields controlled; local state tracks dirty state
- Save button enabled only when dirty
- On save:
  - `profiles`: `supabase.from('profiles').upsert({ id: userId, full_name, phone })`
  - Email (if changed): `supabase.auth.updateUser({ email })` → toast "Письмо подтверждения отправлено на новый адрес"
  - Success: toast "Профиль сохранён"
  - Error: toast с текстом ошибки

**Card 2 — Безопасность**
- Fields: Новый пароль, Подтверждение пароля
- Note: Supabase `updateUser({ password })` does not require current password; current password field shown for UX only (client-side check is skipped — Supabase handles session security)
- Inline validation shown below fields (not on submit):
  - Мин. 8 символов
  - Содержит цифру
  - Содержит спецсимвол (`!@#$%^&*` etc.)
- Submit enabled only when new === confirm and all rules pass
- On save: `supabase.auth.updateUser({ password: newPassword })` → toast "Пароль изменён"

### Validation (client-side, no zod/react-hook-form — plain useState)
- Email: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Phone: allow digits, `+`, spaces, dashes
- Password rules checked live as user types

---

## 4. Settings Page (`/settings`)

### Route
```
/settings  →  SettingsPage.tsx  (inside ProtectedRoute + AppLayout)
```

### Layout
Two cards:

**Card 1 — Общие**
- Часовой пояс: `<select>` with ~10 common timezones (UTC, Asia/Almaty, Asia/Tashkent, Europe/Moscow, Europe/Kiev, Asia/Dubai, Asia/Tokyo, America/New_York, America/Los_Angeles, Europe/London)
- Формат даты: two toggle buttons `DD.MM.YYYY` / `MM.DD.YYYY`
- Первый день недели: two toggle buttons `Пн` / `Вс`

**Card 2 — Календарь**
- Toggle switch "Показывать полный текст брони" (`show_full_text`)
- Toggle switch "Компактный режим" (`compact_mode`)

### Save behavior
Autosave with 800ms debounce after any change — no explicit save button. Small "Сохранено" indicator fades in/out after successful save.

### Settings consumption
- `ChessGrid` reads `show_full_text` from `useSettings()` to decide text rendering (the overlay width approach implemented separately)
- `compact_mode` toggles `h-10` → `h-7` row height in ChessGrid

---

## 5. Navigation Wiring

**UserMenu.tsx** — update two `MenuItem` onClick handlers:
```ts
// "Личный кабинет"
onClick={() => { setOpen(false); navigate('/profile') }

// "Настройки"  
onClick={() => { setOpen(false); navigate('/settings') }
```

**AppRouter.tsx** — add inside the AppLayout route:
```tsx
<Route path="profile" element={<ProfilePage />} />
<Route path="settings" element={<SettingsPage />} />
```

---

## 6. UI Conventions (match existing design)

- Page wrapper: `max-w-2xl mx-auto px-4 py-6`
- Cards: `bg-white rounded-2xl border border-gray-100 shadow-sm p-6`
- Section title: `text-base font-semibold text-gray-800 mb-4`
- Input: match existing BookingModal input style
- Primary button: `bg-[#376E6F] text-white rounded-xl px-4 py-2 hover:bg-[#2d5a5b]`
- Toast: simple fixed-position toast component (`src/shared/ui/Toast.tsx`), no external library — success (green), error (red), auto-dismiss after 3s
- Icons: Phosphor icons (already installed)

---

## 7. File Checklist

New files:
- `src/entities/settings/types.ts`
- `src/entities/settings/api.ts`
- `src/entities/settings/queries.ts`
- `src/pages/profile/ProfilePage.tsx`
- `src/pages/settings/SettingsPage.tsx`
- `src/features/profile/ProfileForm.tsx`
- `src/features/profile/PasswordForm.tsx`
- `src/features/settings/GeneralSettings.tsx`
- `src/features/settings/CalendarSettings.tsx`
- `src/shared/ui/Toast.tsx` (simple fixed-position toast)
- `src/shared/ui/Toggle.tsx` (reusable toggle switch)

Modified files:
- `src/app/router/AppRouter.tsx` — add 2 routes
- `src/widgets/user-menu/UserMenu.tsx` — wire navigation
- `src/widgets/chess-grid/ChessGrid.tsx` — read `show_full_text` + `compact_mode` from settings

---

## 8. Out of Scope

- Avatar file upload
- Language switching (no translations)
- Activity log
- Notification settings
- Team/multi-user
- Integrations (Google Calendar, Telegram, Webhook)
- Dark theme
