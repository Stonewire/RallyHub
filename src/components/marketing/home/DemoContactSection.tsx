import { RALLYHUB_BOOKING_URL, RALLYHUB_CONTACT_EMAIL } from '@/constants/contact'
import { ArrowRight, Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'

import { Reveal } from './Reveal'

/** Fallback contact address shown if the submission endpoint errors. */
const CONTACT_EMAIL = RALLYHUB_CONTACT_EMAIL

const EVENT_TYPES = [
  'Team building event',
  'Conference or away day',
  'Client event',
  'Recurring event programme',
  'Something else',
] as const

type Errors = Partial<Record<'name' | 'email' | 'company' | 'eventType', string>>

function validate(values: {
  name: string
  email: string
  company: string
  eventType: string
}): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = 'Please add your name.'
  if (!values.email.trim()) errors.email = 'Please add a work email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'That email does not look right.'
  if (!values.company.trim()) errors.company = 'Please add your organisation.'
  if (!values.eventType) errors.eventType = 'Please choose what you are planning.'
  return errors
}

export function DemoContactSection() {
  const [values, setValues] = useState({
    name: '',
    email: '',
    company: '',
    eventType: '',
    message: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [company2, setCompany2] = useState('') // honeypot

  function update(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field as keyof Errors]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    if (company2) return // silent drop for bots
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      document.getElementById(`demo-${Object.keys(found)[0]}`)?.focus()
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const { error } = await supabase.functions.invoke('submit-contact', {
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          company: values.company.trim(),
          eventType: values.eventType,
          message: values.message.trim(),
          company2,
        },
      })
      if (error) {
        let msg = 'Something went wrong. Please try again.'
        try {
          const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
            .context?.json?.()
          if (b?.error) msg = b.error
        } catch {
          /* ignore */
        }
        setSubmitError(msg)
        return
      }
      setSubmitted(true)
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const firstName = values.name.trim().split(' ')[0]

  return (
    <section id="contact" className="mk-dark scroll-mt-20">
      <div className="mk-wrap mk-section mk-form-grid">
        <Reveal>
          <h2 className="mk-h2">Contact us.</h2>
          <p className="mk-lead mk-muted" style={{ marginTop: '1.1rem' }}>
            Questions about pricing, a format you are not sure we cover, an event with an awkward
            shape to it? Tell us and a person will write back.
          </p>
          <p className="mk-muted mt-6 text-sm font-semibold">
            Ready to see it instead?{' '}
            <a href={RALLYHUB_BOOKING_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--mk-yellow)' }}>
              Book a demo
            </a>{' '}
            and pick a slot that suits you.
          </p>
          <p className="mk-muted mt-3 text-sm font-semibold">
            Already know what you want?{' '}
            <Link to="/register" style={{ color: 'var(--mk-yellow)' }}>
              Open an account
            </Link>{' '}
            and explore the builder.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div className="mk-form-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="mk-h3">Send us a message</h3>
              <span className="mk-chip mk-chip--ghost" style={{ color: 'var(--mk-mut-d)' }}>
                We reply same day
              </span>
            </div>

            {submitted ? (
              <div role="status" className="grid gap-3 py-8 text-center">
                <span
                  className="mx-auto grid size-12 place-items-center rounded-full"
                  style={{ background: 'var(--mk-yellow)', color: 'var(--mk-ink)' }}
                >
                  <Check className="size-6" aria-hidden />
                </span>
                <p className="font-extrabold">
                  Thanks{firstName ? `, ${firstName}` : ''}. Your request is in.
                </p>
                <p className="mk-muted text-sm leading-relaxed">
                  We have your message and will write back shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="mk-field">
                    <label htmlFor="demo-name">Your name</label>
                    <input
                      id="demo-name"
                      name="name"
                      className="mk-input"
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      value={values.name}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'demo-name-err' : undefined}
                      onChange={(e) => update('name', e.target.value)}
                    />
                    {errors.name ? (
                      <p id="demo-name-err" className="mk-error">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="mk-field">
                    <label htmlFor="demo-email">Work email</label>
                    <input
                      id="demo-email"
                      name="email"
                      type="email"
                      className="mk-input"
                      autoComplete="email"
                      placeholder="alex@company.com"
                      value={values.email}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'demo-email-err' : undefined}
                      onChange={(e) => update('email', e.target.value)}
                    />
                    {errors.email ? (
                      <p id="demo-email-err" className="mk-error">
                        {errors.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="mk-field">
                    <label htmlFor="demo-company">Organisation</label>
                    <input
                      id="demo-company"
                      name="company"
                      className="mk-input"
                      autoComplete="organization"
                      placeholder="Your company"
                      value={values.company}
                      aria-invalid={!!errors.company}
                      aria-describedby={errors.company ? 'demo-company-err' : undefined}
                      onChange={(e) => update('company', e.target.value)}
                    />
                    {errors.company ? (
                      <p id="demo-company-err" className="mk-error">
                        {errors.company}
                      </p>
                    ) : null}
                  </div>
                  <div className="mk-field">
                    <label htmlFor="demo-eventType">What are you planning?</label>
                    <select
                      id="demo-eventType"
                      name="eventType"
                      className="mk-select"
                      value={values.eventType}
                      aria-invalid={!!errors.eventType}
                      aria-describedby={errors.eventType ? 'demo-eventType-err' : undefined}
                      onChange={(e) => update('eventType', e.target.value)}
                    >
                      <option value="">Choose one</option>
                      {EVENT_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    {errors.eventType ? (
                      <p id="demo-eventType-err" className="mk-error">
                        {errors.eventType}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mk-field">
                  <label htmlFor="demo-message">Tell us a little more</label>
                  <textarea
                    id="demo-message"
                    name="message"
                    className="mk-textarea"
                    rows={3}
                    placeholder="Team size, timing, game ideas, or whatever you want to ask us."
                    value={values.message}
                    onChange={(e) => update('message', e.target.value)}
                  />
                </div>

                {/* Honeypot: hidden from users, catches bots. */}
                <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="demo-company2">Leave this empty</label>
                  <input
                    id="demo-company2"
                    name="company2"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company2}
                    onChange={(e) => setCompany2(e.target.value)}
                  />
                </div>

                {submitError ? (
                  <p role="alert" className="mk-error">
                    {submitError} You can also email us at{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
                      {CONTACT_EMAIL}
                    </a>
                    .
                  </p>
                ) : null}

                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="mk-muted text-xs font-semibold">
                    We will only use your details to reply to you.
                  </p>
                  <button className="mk-btn" type="submit" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send message'}
                    {submitting ? null : <ArrowRight aria-hidden />}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
