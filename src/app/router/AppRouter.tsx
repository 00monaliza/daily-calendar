import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthPage } from '@/pages/auth/AuthPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { ChessPage } from '@/pages/chess/ChessPage'
import { PropertiesPage } from '@/pages/properties/PropertiesPage'
import { FinancesPage } from '@/pages/finances/FinancesPage'
import { GuestsPage } from '@/pages/guests/GuestsPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { AppLayout } from '@/app/providers/AppLayout'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ChessPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="finances" element={<FinancesPage />} />
        <Route path="guests" element={<GuestsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
