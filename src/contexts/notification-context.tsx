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
const DEFAULT_ACCENT = '#FFCB03'

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
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]"
        >
          <div className="pointer-events-auto w-full max-w-md">
            <div
              className="flex items-center justify-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-center text-sm font-semibold shadow-lg backdrop-blur-xl"
              style={{
                backgroundColor: accentColor,
                color: '#3E3D3E',
              }}
            >
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

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return ctx
}

export function useOptionalNotification() {
  return useContext(NotificationContext)
}
