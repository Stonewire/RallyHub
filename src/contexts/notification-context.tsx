import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { detectPlatform } from '@/lib/client-diagnostics'

type Notification = {
  id: number
  message: string
}

type NotificationContextValue = {
  notify: (message: string) => void
  accentColor: string
  setAccentColor: (color: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const DISPLAY_MS = 5000
const DEFAULT_ACCENT = '#FFC107'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null)
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)
  const idRef = useRef(0)
  const queueRef = useRef<string[]>([])
  const drainingRef = useRef(false)

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return
    drainingRef.current = true
    while (queueRef.current.length > 0) {
      const message = queueRef.current.shift()!
      idRef.current += 1
      const id = idRef.current
      setCurrent({ id, message })
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, DISPLAY_MS)
      })
      setCurrent((c) => (c?.id === id ? null : c))
    }
    drainingRef.current = false
  }, [])

  const notify = useCallback(
    (message: string) => {
      const text = message.trim().slice(0, 120)
      if (!text) return
      queueRef.current.push(text)
      void drainQueue()
    },
    [drainQueue],
  )

  const value = useMemo(
    () => ({ notify, accentColor, setAccentColor }),
    [notify, accentColor],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {current ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="pointer-events-auto w-full max-w-md">
            <div
              // backdrop-blur is dropped on iOS ONLY: the frosted toast froze
              // iOS Safari's compositor for seconds every time it appeared
              // (the post-submit screen freezes and next-tap lag, 31 Jul 2026,
              // where every JS/paint timer measured idle while pixels stalled).
              // A slightly darker flat background keeps it readable; Android
              // and desktop keep the identical blurred look.
              className={`flex items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg ${
                detectPlatform() === 'ios' ? '' : 'backdrop-blur-xl'
              }`}
              style={{
                backgroundColor:
                  detectPlatform() === 'ios' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.45)',
                boxShadow: `0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px ${accentColor}55`,
              }}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: accentColor }}
                aria-hidden
              />
              <span className="line-clamp-2">{current.message}</span>
            </div>
          </div>
        </div>
      ) : null}
    </NotificationContext.Provider>
  )
}

export function NotificationAccentSync({ color }: { color: string }) {
  const ctx = useContext(NotificationContext)
  useEffect(() => {
    ctx?.setAccentColor(color)
  }, [color, ctx])
  return null
}

// eslint-disable-next-line react-refresh/only-export-components -- companion hook for NotificationProvider
export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components -- companion hook for NotificationProvider
export function useOptionalNotification() {
  return useContext(NotificationContext)
}
