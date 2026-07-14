/**
 * Paddle.js loader + inline overlay checkout helper.
 *
 * Env: VITE_PADDLE_CLIENT_TOKEN (public, safe to expose — same idea as the
 * Supabase anon key) and VITE_PADDLE_ENVIRONMENT ('sandbox' | 'production').
 * The actual transaction (with its final, already-discounted price) is always
 * created server-side first (paddle-checkout Edge Function); this module only
 * ever opens the overlay for an existing transactionId.
 */

import { supabase } from '@/lib/supabase'

type PaddleCheckoutEvent = { name: string; data?: unknown }

/**
 * Pulls the server's actual `{ error }` message out of a failed functions.invoke.
 * Without this the caller only ever sees "Edge Function returned a non-2xx status
 * code", which tells the organiser nothing about what to fix.
 */
async function edgeFunctionError(error: unknown, fallback: string): Promise<string> {
  try {
    const body = await (
      error as { context?: { json?: () => Promise<{ error?: string }> } }
    ).context?.json?.()
    if (body?.error) return body.error
  } catch {
    /* fall through to the generic message */
  }
  return fallback
}

/**
 * Opens Paddle's hosted customer portal, where the organiser manages their saved
 * cards and billing details.
 *
 * Card data never touches RallyHub. It is entered and stored only inside Paddle
 * (PCI-DSS compliant); we hold nothing but Paddle's opaque customer id. The link
 * is minted server-side with the secret API key, scoped to that one customer, and
 * short-lived — so it is never cached or persisted here either.
 *
 * Opened in a new tab, never an iframe: Paddle explicitly requires this, and
 * embedding a payment surface in an iframe invites clickjacking.
 */
export async function openBillingPortal(organizationId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('paddle-checkout', {
    body: { organizationId, kind: 'portal' },
  })
  if (error) {
    throw new Error(await edgeFunctionError(error, 'Could not open billing details.'))
  }

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error('Could not open billing details.')

  // noopener/noreferrer: the new tab must not get a handle back to this one.
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Fire-and-forget: charges a freshly-activated event's invoice to the payment
 * method already saved against the org's subscription.
 *
 * Deliberately swallows every failure. The event is already live at this point,
 * and billing must never disrupt a live event — if the card declines, the org
 * has no subscription, or the network drops, the invoice simply stays unpaid and
 * is settled later with "Pay now". Never await this in a way that blocks the UI.
 */
export async function autoChargeEventInvoice(
  organizationId: string | null | undefined,
  eventId: string,
): Promise<void> {
  if (!organizationId) return
  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, status, amount_due')
      .eq('event_id', eventId)
      .maybeSingle()

    if (!invoice || invoice.status !== 'unpaid' || Number(invoice.amount_due) <= 0) return

    await supabase.functions.invoke('paddle-checkout', {
      body: { organizationId, kind: 'event_auto', invoiceId: invoice.id },
    })
  } catch {
    // Intentionally ignored — see the note above.
  }
}

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
