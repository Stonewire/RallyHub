/**
 * Paddle.js loader + inline overlay checkout helper.
 *
 * Env: VITE_PADDLE_CLIENT_TOKEN (public, safe to expose — same idea as the
 * Supabase anon key) and VITE_PADDLE_ENVIRONMENT ('sandbox' | 'production').
 * The actual transaction (with its final, already-discounted price) is always
 * created server-side first (paddle-checkout Edge Function); this module only
 * ever opens the overlay for an existing transactionId.
 */

type PaddleCheckoutEvent = { name: string; data?: unknown }

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: 'sandbox' | 'production') => void }
      Initialize: (opts: {
        token: string
        eventCallback?: (event: PaddleCheckoutEvent) => void
      }) => void
      Checkout: { open: (opts: { transactionId: string }) => void }
    }
  }
}

const SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js'

let loadPromise: Promise<void> | null = null
let initialized = false

function loadPaddleScript(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    if (window.Paddle) {
      resolve()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Paddle.js')))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paddle.js'))
    document.head.appendChild(script)
  })
  return loadPromise
}

/** All active checkouts' one-shot completion listeners, keyed by nothing —
 * there is only ever one overlay open at a time in this app. */
let activeListener: ((event: PaddleCheckoutEvent) => void) | null = null

async function ensurePaddleInitialized(): Promise<void> {
  await loadPaddleScript()
  if (initialized || !window.Paddle) return

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
  if (!token) {
    throw new Error('VITE_PADDLE_CLIENT_TOKEN is not set — payment is not configured.')
  }
  const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox'

  window.Paddle.Environment.set(environment)
  window.Paddle.Initialize({
    token,
    eventCallback: (event) => activeListener?.(event),
  })
  initialized = true
}

export type PaddleCheckoutResult = 'completed' | 'closed' | 'error'

/**
 * Opens the Paddle overlay checkout for a transaction already created
 * server-side, and resolves once the customer completes, closes, or the
 * checkout errors. Does not itself refetch anything — the caller decides what
 * to refresh on 'completed' (the webhook is still the source of truth for
 * actually marking things paid; this is just for immediate UI feedback).
 */
export async function payWithPaddle(transactionId: string): Promise<PaddleCheckoutResult> {
  await ensurePaddleInitialized()
  if (!window.Paddle) throw new Error('Paddle failed to load.')

  return new Promise((resolve) => {
    activeListener = (event) => {
      if (event.name === 'checkout.completed') {
        activeListener = null
        resolve('completed')
      } else if (event.name === 'checkout.closed') {
        activeListener = null
        resolve('closed')
      } else if (event.name === 'checkout.error') {
        activeListener = null
        resolve('error')
      }
    }
    window.Paddle!.Checkout.open({ transactionId })
  })
}
