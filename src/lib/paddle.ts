/**
 * Paddle.js loader + inline overlay checkout helper.
 *
 * Env: VITE_PADDLE_CLIENT_TOKEN (public, safe to expose — same idea as the
 * Supabase anon key) and VITE_PADDLE_ENVIRONMENT ('sandbox' | 'production').
 * The actual transaction (with its final, already-discounted price) is always
 * created server-side first (paddle-checkout Edge Function); this module only
 * ever opens the overlay for an existing transactionId.
 */

import { i18n } from '@/lib/i18n'

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
 * Opens the official Paddle invoice PDF for a paid event.
 *
 * Paddle is the Merchant of Record, so the legally-valid invoice is theirs, not
 * one we generate. The link Paddle returns expires after an hour, so it is
 * fetched fresh on every click and never cached or stored.
 */
export async function openInvoicePdf(
  organizationId: string,
  invoiceId: string,
  demo = false,
): Promise<void> {
  if (demo) {
    const { data: demoInvoice, error: demoInvoiceError } = await supabase
      .from('invoices')
      .select('amount_due')
      .eq('id', invoiceId)
      .eq('organization_id', organizationId)
      .single()
    if (demoInvoiceError || !demoInvoice) {
      throw new Error(i18n.t('admin:billing.demo.invoiceFetchFailed'))
    }
    const total = new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(Number(demoInvoice.amount_due))
    const invoice = window.open('', '_blank')
    if (!invoice) throw new Error(i18n.t('admin:billing.demo.popupBlocked'))
    invoice.opener = null
    const demoLabel = i18n.t('admin:billing.demo.invoiceTitle')
    invoice.document.write(`<!doctype html><html><head><title>${demoLabel}</title><style>body{font-family:Inter,system-ui,sans-serif;max-width:760px;margin:64px auto;padding:0 32px;color:#252525}header{display:flex;justify-content:space-between;border-bottom:2px solid #252525;padding-bottom:24px}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin-top:40px}td{padding:14px 0;border-bottom:1px solid #ddd}.muted{color:#6f6f6f}.total{text-align:right;font-size:24px;font-weight:700;margin-top:28px}.badge{display:inline-block;background:#e5f7ea;color:#18713a;border-radius:999px;padding:5px 10px;font-size:12px}</style></head><body><header><div><strong>RallyHub</strong><p class="muted">${demoLabel}</p></div><div><span class="badge">${i18n.t('admin:billing.demo.invoiceBadge')}</span><p class="muted">#${invoiceId.slice(0, 8).toUpperCase()}</p></div></header><h1>${i18n.t('admin:billing.demo.invoiceHeading')}</h1><p class="muted">${i18n.t('admin:billing.demo.invoiceNote')}</p><table><tr><td>${i18n.t('admin:billing.demo.invoiceLine')}</td><td style="text-align:right">${total}</td></tr><tr><td>${i18n.t('admin:billing.demo.invoiceVat')}</td><td style="text-align:right">€0.00</td></tr></table><p class="total">${i18n.t('admin:billing.demo.invoiceTotal', { amount: total })}</p></body></html>`)
    invoice.document.close()
    return
  }
  const { data, error } = await supabase.functions.invoke('paddle-checkout', {
    body: { organizationId, kind: 'invoice_pdf', invoiceId },
  })
  if (error) {
    throw new Error(await edgeFunctionError(error, i18n.t('admin:billing.couldNotFetchInvoice')))
  }

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error(i18n.t('admin:billing.couldNotFetchInvoice'))

  window.open(url, '_blank', 'noopener,noreferrer')
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
export async function openBillingPortal(organizationId: string, demo = false): Promise<void> {
  if (demo) {
    await openDemoOverlay({
      title: i18n.t('admin:billing.billingDetails'),
      body: i18n.t('admin:billing.demo.portalBody'),
      confirmLabel: i18n.t('admin:billing.demo.done'),
      allowCancel: false,
    })
    return
  }
  const { data, error } = await supabase.functions.invoke('paddle-checkout', {
    body: { organizationId, kind: 'portal' },
  })
  if (error) {
    throw new Error(
      await edgeFunctionError(error, i18n.t('admin:billing.couldNotOpenBillingDetails')),
    )
  }

  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error(i18n.t('admin:billing.couldNotOpenBillingDetails'))

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
  demo = false,
): Promise<void> {
  if (!organizationId) return
  try {
    // P6.4: only the current invoice. A recurring event carries superseded
    // rows from earlier runs, which are always settled and must never be
    // charged again (and would make maybeSingle throw on multiple rows).
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, status, amount_due')
      .eq('event_id', eventId)
      .eq('superseded', false)
      .maybeSingle()

    if (!invoice || invoice.status !== 'unpaid' || Number(invoice.amount_due) <= 0) return

    if (demo) {
      const prepared = await supabase.functions.invoke('demo-billing', {
        body: { organizationId, kind: 'event', invoiceId: invoice.id },
      })
      const transactionId = (prepared.data as { transactionId?: string } | null)?.transactionId
      if (prepared.error || !transactionId) return
      await supabase.functions.invoke('demo-billing', {
        body: { organizationId, kind: 'event_complete', invoiceId: invoice.id, transactionId },
      })
      return
    }

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
      existing.addEventListener('error', () =>
        reject(new Error(i18n.t('admin:billing.paddleScriptLoadFailed'))),
      )
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(i18n.t('admin:billing.paddleScriptLoadFailed')))
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

function openDemoOverlay({
  title,
  body,
  confirmLabel,
  allowCancel = true,
}: {
  title: string
  body: string
  confirmLabel: string
  allowCancel?: boolean
}): Promise<PaddleCheckoutResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4'

    const panel = document.createElement('div')
    panel.className = 'w-full max-w-md rounded-xl border border-white/10 bg-[#171717] p-6 text-white shadow-2xl'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')

    const eyebrow = document.createElement('p')
    eyebrow.className = 'mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#ffcb03]'
    eyebrow.textContent = i18n.t('admin:billing.demo.eyebrow')

    const heading = document.createElement('h2')
    heading.className = 'text-xl font-semibold'
    heading.textContent = title

    const copy = document.createElement('p')
    copy.className = 'mt-3 text-sm leading-6 text-white/65'
    copy.textContent = body

    const secure = document.createElement('div')
    secure.className = 'mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-sm'
    secure.textContent = i18n.t('admin:billing.demo.card')

    const actions = document.createElement('div')
    actions.className = 'mt-6 flex justify-end gap-2'

    const finish = (result: PaddleCheckoutResult) => {
      overlay.remove()
      resolve(result)
    }

    if (allowCancel) {
      const cancel = document.createElement('button')
      cancel.className = 'rounded-md px-4 py-2 text-sm text-white/70 hover:bg-white/10'
      cancel.textContent = i18n.t('common:cancel')
      cancel.onclick = () => finish('closed')
      actions.append(cancel)
    }

    const confirm = document.createElement('button')
    confirm.className = 'rounded-md bg-[#ffcb03] px-4 py-2 text-sm font-semibold text-[#171717] hover:bg-[#ffd633]'
    confirm.textContent = confirmLabel
    confirm.onclick = () => finish('completed')
    actions.append(confirm)

    panel.append(eyebrow, heading, copy, secure, actions)
    overlay.append(panel)
    document.body.append(overlay)
    confirm.focus()
  })
}

/**
 * Opens the Paddle overlay checkout for a transaction already created
 * server-side, and resolves once the customer completes, closes, or the
 * checkout errors. Does not itself refetch anything — the caller decides what
 * to refresh on 'completed' (the webhook is still the source of truth for
 * actually marking things paid; this is just for immediate UI feedback).
 */
export async function payWithPaddle(transactionId: string): Promise<PaddleCheckoutResult> {
  if (transactionId.startsWith('demo_')) {
    return openDemoOverlay({
      title: i18n.t('admin:billing.demo.checkoutTitle'),
      body: i18n.t('admin:billing.demo.checkoutBody'),
      confirmLabel: i18n.t('admin:billing.demo.checkoutConfirm'),
    })
  }
  await ensurePaddleInitialized()
  if (!window.Paddle) throw new Error(i18n.t('admin:billing.paddleLoadFailed'))

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
