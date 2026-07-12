import { ArrowRight, Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton, NeoInput, NeoLabel, NeoSelect, NeoTextarea } from '@/components/neo-minimal'

import { Reveal } from './Reveal'

/**
 * Contact/demo destination. There is no approved server-side contact workflow
 * yet, so the form composes a prefilled email through the visitor's own mail
 * client (no data leaves the browser to any third party). Swap this for a real
 * edge-function endpoint once a destination is approved (see TRACKER CONTACT-1).
 */
const CONTACT_EMAIL = 'hello@rallyhubapp.com'

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
  const [company2, setCompany2] = useState('') // honeypot

  function update(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field as keyof Errors]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (company2) return // silent drop for bots
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      const first = document.getElementById(`demo-${Object.keys(found)[0]}`)
      first?.focus()
      return
    }

    const subject = `RallyHub demo request — ${values.company.trim()}`
    const body = [
      `Name: ${values.name.trim()}`,
      `Email: ${values.email.trim()}`,
      `Organisation: ${values.company.trim()}`,
      `Planning: ${values.eventType}`,
      '',
      values.message.trim() || '(no extra details)',
    ].join('\n')
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`
    setSubmitted(true)
  }

  const firstName = values.name.trim().split(' ')[0]

  return (
    <section id="contact" className="mkt-show scroll-mt-20">
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:px-12 lg:py-24">
        <Reveal>
          <p className="mkt-eyebrow-light text-xs font-bold uppercase tracking-[0.05em]">
            Book a walkthrough
          </p>
          <h2 className="font-display mt-3 text-3xl font-normal leading-[1.12] tracking-tight sm:text-4xl">
            Show us the event you want to run.
          </h2>
          <p className="text-[color:var(--mkt-show-muted)] mt-4 max-w-md text-lg leading-relaxed">
            Tell us the shape of your event and we will show you how RallyHub brings the whole
            experience together.
          </p>
          <div className="mt-8 rounded-2xl border border-[var(--mkt-show-border)] bg-[var(--mkt-show-elev)] p-6">
            <p className="text-[color:var(--mkt-show-muted)] text-sm">
              Already know what you want? Open an account and explore the builder.
            </p>
            <NeoButton variant="accent" asChild className="mt-4">
              <Link to="/register">
                Create your account
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </NeoButton>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="rounded-2xl border border-[var(--mkt-show-border)] bg-[var(--nm-bg-elevated)] p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-foreground text-lg font-bold">Book your RallyHub demo</h3>
              <span className="text-muted-foreground text-xs">About 30 minutes</span>
            </div>

            {submitted ? (
              <div role="status" className="space-y-3 py-6 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--nm-yellow)_30%,transparent)]">
                  <Check className="size-6 text-[var(--nm-charcoal)]" aria-hidden />
                </span>
                <p className="text-foreground font-semibold">
                  Thanks{firstName ? `, ${firstName}` : ''}. Your email is ready to send.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We opened a pre-filled message to {CONTACT_EMAIL} in your mail app. If it did not
                  open, email us there directly and we will set up your walkthrough.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="demo-name"
                    label="Your name"
                    error={errors.name}
                    input={
                      <NeoInput
                        id="demo-name"
                        name="name"
                        autoComplete="name"
                        placeholder="Alex Morgan"
                        value={values.name}
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'demo-name-err' : undefined}
                        onChange={(e) => update('name', e.target.value)}
                      />
                    }
                  />
                  <Field
                    id="demo-email"
                    label="Work email"
                    error={errors.email}
                    input={
                      <NeoInput
                        id="demo-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="alex@company.com"
                        value={values.email}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'demo-email-err' : undefined}
                        onChange={(e) => update('email', e.target.value)}
                      />
                    }
                  />
                  <Field
                    id="demo-company"
                    label="Organisation"
                    error={errors.company}
                    input={
                      <NeoInput
                        id="demo-company"
                        name="company"
                        autoComplete="organization"
                        placeholder="Your company"
                        value={values.company}
                        aria-invalid={!!errors.company}
                        aria-describedby={errors.company ? 'demo-company-err' : undefined}
                        onChange={(e) => update('company', e.target.value)}
                      />
                    }
                  />
                  <Field
                    id="demo-eventType"
                    label="What are you planning?"
                    error={errors.eventType}
                    input={
                      <NeoSelect
                        id="demo-eventType"
                        name="eventType"
                        value={values.eventType}
                        aria-invalid={!!errors.eventType}
                        aria-describedby={errors.eventType ? 'demo-eventType-err' : undefined}
                        onChange={(e) => update('eventType', e.target.value)}
                      >
                        <option value="">Choose one</option>
                        {EVENT_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </NeoSelect>
                    }
                  />
                </div>
                <Field
                  id="demo-message"
                  label="Tell us a little more"
                  input={
                    <NeoTextarea
                      id="demo-message"
                      name="message"
                      rows={3}
                      placeholder="Team size, timing, game ideas, or anything you want the event to feel like."
                      value={values.message}
                      onChange={(e) => update('message', e.target.value)}
                    />
                  }
                />

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

                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-xs">
                    Opens a pre-filled email in your mail app. No data is sent anywhere else.
                  </p>
                  <NeoButton variant="primary" type="submit">
                    Book my demo
                    <ArrowRight className="size-4" aria-hidden />
                  </NeoButton>
                </div>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Field({
  id,
  label,
  error,
  input,
}: {
  id: string
  label: string
  error?: string
  input: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <NeoLabel htmlFor={id}>{label}</NeoLabel>
      {input}
      {error ? (
        <p id={`${id}-err`} className="text-xs font-medium text-[#c0574f]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
