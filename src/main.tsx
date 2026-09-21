import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryProvider } from './app/providers/QueryProvider'
import { AuthProvider } from './features/auth/AuthProvider'
import { RootRouter } from './app/RootRouter'
import { ErrorBoundary } from './app/ErrorBoundary'
import { registerPwa } from './shared/lib/pwa/registerPwa'
import './app/styles/global.css'

registerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryProvider>
          <AuthProvider>
            <RootRouter />
          </AuthProvider>
        </QueryProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
