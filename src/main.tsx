import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryProvider } from './app/providers/QueryProvider'
import { AppRouter } from './app/router/AppRouter'
import { registerPwa } from './shared/lib/pwa/registerPwa'
import './app/styles/global.css'

registerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
)
