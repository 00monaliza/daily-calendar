import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, X } from '@phosphor-icons/react'

export type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type: ToastType
  onDismiss: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 3000)
    return () => {
      cancelAnimationFrame(show)
      clearTimeout(timer)
    }
  }, [onDismiss])

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${
        type === 'success'
          ? 'bg-white border-green-200 text-green-800'
          : 'bg-white border-red-200 text-red-800'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle size={18} className="text-green-500 flex-shrink-0" weight="fill" />
      ) : (
        <XCircle size={18} className="text-red-500 flex-shrink-0" weight="fill" />
      )}
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  )
}

// Simple toast manager hook
interface ToastItem {
  id: number
  message: string
  type: ToastType
}

let toastId = 0
const listeners = new Set<(toasts: ToastItem[]) => void>()
let toasts: ToastItem[] = []

function notify(state: ToastItem[]) {
  toasts = state
  listeners.forEach(l => l(state))
}

export const toast = {
  success(message: string) {
    const item: ToastItem = { id: ++toastId, message, type: 'success' }
    notify([...toasts, item])
  },
  error(message: string) {
    const item: ToastItem = { id: ++toastId, message, type: 'error' }
    notify([...toasts, item])
  },
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    listeners.add(setItems)
    return () => { listeners.delete(setItems) }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {items.map(item => (
        <div key={item.id} className="pointer-events-auto">
          <Toast
            message={item.message}
            type={item.type}
            onDismiss={() => notify(toasts.filter(t => t.id !== item.id))}
          />
        </div>
      ))}
    </div>
  )
}
