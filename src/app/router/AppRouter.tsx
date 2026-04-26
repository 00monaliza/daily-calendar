import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from '@/app/providers/AppLayout'

const AuthPage = lazy(() => import('@/pages/auth/AuthPage').then(m => ({ default: m.AuthPage })))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const ChessPage = lazy(() => import('@/pages/chess/ChessPage').then(m => ({ default: m.ChessPage })))
const PropertiesPage = lazy(() => import('@/pages/properties/PropertiesPage').then(m => ({ default: m.PropertiesPage })))
const FinancesPage = lazy(() => import('@/pages/finances/FinancesPage').then(m => ({ default: m.FinancesPage })))
const GuestsPage = lazy(() => import('@/pages/guests/GuestsPage').then(m => ({ default: m.GuestsPage })))
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#376E6F] border-t-transparent" />
    </div>
  )
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={withSuspense(<AuthPage />)} />
      <Route path="/auth/reset-password" element={withSuspense(<ResetPasswordPage />)} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={withSuspense(<ChessPage />)} />
        <Route path="properties" element={withSuspense(<PropertiesPage />)} />
        <Route path="finances" element={withSuspense(<FinancesPage />)} />
        <Route path="guests" element={withSuspense(<GuestsPage />)} />
        <Route path="profile" element={withSuspense(<ProfilePage />)} />
        <Route path="settings" element={withSuspense(<SettingsPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
