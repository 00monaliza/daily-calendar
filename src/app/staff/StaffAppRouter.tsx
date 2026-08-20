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
