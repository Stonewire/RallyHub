import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Notification = {
  id: number
  message: string
}

type NotificationContextValue = {
  notify: (message: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const DISPLAY_MS = 5000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null)
  const idRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((message: string) => {
    const text = message.trim().slice(0, 120)
    if (!text) return
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    idRef.current += 1
    const id = idRef.current
    setCurrent({ id, message: text })
    timeoutRef.current = window.setTimeout(() => {
      setCurrent((c) => (c?.id === id ? null : c))
      timeoutRef.current = null
    }, DISPLAY_MS)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {current ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
        >
          <div className="pointer-events-auto w-full max-w-md">
            <div className="flex items-center justify-center gap-2 rounded-full border border-white/20 bg-[#1c1c1e]/92 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg backdrop-blur-xl">
              <span className="line-clamp-2">{current.message}</span>
            </div>
          </div>
        </div>
      ) : null}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return ctx
}
