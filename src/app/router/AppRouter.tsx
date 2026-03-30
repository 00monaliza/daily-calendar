import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthPage } from '@/pages/auth/AuthPage'
import { ChessPage } from '@/pages/chess/ChessPage'
import { PropertiesPage } from '@/pages/properties/PropertiesPage'
import { FinancesPage } from '@/pages/finances/FinancesPage'
import { GuestsPage } from '@/pages/guests/GuestsPage'
import { AppLayout } from '@/app/providers/AppLayout'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
