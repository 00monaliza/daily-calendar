import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

const CHUNK_LOAD_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i
const RELOAD_GUARD_KEY = 'pogostim:chunk-reload-guard'

/**
 * Catches render errors that Suspense doesn't (e.g. a lazy route chunk
 * failing to load because a redeploy invalidated the hashed asset the
 * cached index.html still references). Without this, React unmounts the
 * whole tree on any uncaught render error, leaving a permanently blank,
 * unresponsive white screen with no way to recover short of the user
 * force-quitting and reopening the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (CHUNK_LOAD_ERROR_PATTERN.test(message)) {
      // A stale chunk reference after a new deploy is self-healing on
      // reload (the fresh index.html points at the current chunks), so
      // recover automatically instead of showing an error screen. Guard
      // against a reload loop if the error persists for some other reason.
      let alreadyReloaded = false
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY) === '1'
      } catch {
        // sessionStorage unavailable (e.g. private browsing) — fall through to manual fallback
      }

      if (!alreadyReloaded) {
        try {
          sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
        } catch {
          // ignore — reload still proceeds, just without loop protection
        }
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-sm w-full text-center">
            <h1 className="text-lg font-semibold text-gray-800 mb-2">Что-то пошло не так</h1>
            <p className="text-sm text-gray-500 mb-5">
              Приложению не удалось загрузиться. Попробуйте обновить страницу.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-lg bg-[#376E6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2b5758]"
            >
              Обновить
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
