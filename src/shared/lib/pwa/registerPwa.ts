interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      setupServiceWorkerUpdateFlow(registration)
      setupServiceWorkerMessageFlow()

      // Trigger update checks whenever the tab regains focus.
      window.addEventListener('focus', () => registration.update())
      devLog('Service Worker registered', registration.scope)
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error)
    }
  })

  setupInstallPrompt()
}

function setupInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    const promptEvent = event as BeforeInstallPromptEvent
    promptEvent.preventDefault()
    deferredPrompt = promptEvent

    if (window.matchMedia('(display-mode: standalone)').matches) {
      return
    }

    showInstallButton()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    removeInstallButton()
  })
}

function showInstallButton(): void {
  const existing = document.getElementById('pwa-install-button')
  if (existing) {
    return
  }

  const button = document.createElement('button')
  button.id = 'pwa-install-button'
  button.type = 'button'
  button.textContent = 'Установить приложение'
  button.setAttribute('aria-label', 'Установить приложение на устройство')

  button.style.position = 'fixed'
  button.style.right = '16px'
  button.style.bottom = '16px'
  button.style.padding = '10px 14px'
  button.style.border = '0'
  button.style.borderRadius = '999px'
  button.style.background = '#2b6f70'
  button.style.color = '#fff'
  button.style.font = '600 14px/1 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
  button.style.boxShadow = '0 10px 24px rgba(43, 111, 112, 0.35)'
  button.style.cursor = 'pointer'
  button.style.zIndex = '9999'

  button.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return
    }

    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    removeInstallButton()
  })

  document.body.appendChild(button)
}

function removeInstallButton(): void {
  document.getElementById('pwa-install-button')?.remove()
}

function setupServiceWorkerUpdateFlow(
  registration: ServiceWorkerRegistration,
): void {
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    if (!worker) {
      return
    }

    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed') {
        return
      }

      if (!navigator.serviceWorker.controller) {
        return
      }

      showUpdatePrompt(registration)
    })
  })
}

function setupServiceWorkerMessageFlow(): void {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_ACTIVATED') {
      devLog('Service Worker activated', event.data.version)
    }
  })

  let isRefreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isRefreshing) {
      return
    }

    isRefreshing = true
    window.location.reload()
  })
}

function showUpdatePrompt(registration: ServiceWorkerRegistration): void {
  const shouldUpdate = window.confirm(
    'Доступна новая версия приложения. Обновить сейчас?',
  )

  if (!shouldUpdate) {
    return
  }

  registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
}

function devLog(message: string, payload?: string): void {
  if (!import.meta.env.DEV) {
    return
  }

  if (payload) {
    console.info('[PWA]', message, payload)
    return
  }

  console.info('[PWA]', message)
}
