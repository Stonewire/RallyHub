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
        // A phone's own notification: it drops in at the top, out of the way
        // of whatever the thumbs are doing at the bottom of the screen.
        <div
          role="status"
          aria-live="polite"
          // Above the camera overlay (z-10000): the message that matters most
          // is usually the one the camera itself just raised.
          className="pointer-events-none fixed inset-x-0 top-0 z-[10050] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <div
            key={current.id}
            className="xp-notification-drop pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-left text-[13px] leading-snug font-semibold text-black"
            style={{ boxShadow: '0 6px 22px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.12)' }}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            />
            <span className="line-clamp-2">{current.message}</span>
          </div>
          <style>{`
            @keyframes xp-notification-drop {
              from { opacity: 0; transform: translateY(-120%); }
              to { opacity: 1; transform: translateY(0); }
            }
            .xp-notification-drop {
              animation: xp-notification-drop 260ms cubic-bezier(0.22, 1, 0.36, 1);
            }
            @media (prefers-reduced-motion: reduce) {
              .xp-notification-drop { animation: none; }
            }
          `}</style>
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
