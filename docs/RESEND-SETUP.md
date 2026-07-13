# Resend setup: contact form + auth emails

This covers the two email pieces:

- **CONTACT-1** — the marketing demo form (`submit-contact` Edge Function). Code
  is deployed and already stores every lead. It also emails you the lead once
  you add a Resend API key.
- **EMAIL-1** — Supabase Auth emails (signup confirm, password reset, invite,
  etc.) sent from your own domain via Resend, with RallyHub-branded templates.

Both share one Resend account and one verified sending domain, so do Step 1 once.

---

## Step 1 — Resend account + verified domain (do once)

1. Create an account at https://resend.com.
2. Add your domain **rallyhub.games** under **Domains → Add Domain**.
3. Resend shows a set of DNS records (SPF, DKIM, and a return-path/MX). Add them
   at your DNS provider for rallyhub.games. Wait for Resend to show the domain as
   **Verified** (usually minutes, sometimes up to an hour).
4. Create an API key under **API Keys → Create** (give it send access). Copy it,
   you will paste it in the next steps. Treat it like a password.

Sender addresses used below (`noreply@rallyhub.games`, `hello@rallyhub.games`)
must be on this verified domain. You do not need real inboxes for the *from*
address, but `hello@rallyhub.games` (where leads are sent) should be a mailbox
you actually read, or an alias that forwards to one.

---

## Step 2 — CONTACT-1: make the demo form email you

The `submit-contact` function is already deployed. It saves every submission to
the `contact_submissions` table regardless, so no lead is lost. To also get an
email, set these Edge Function secrets:

Dashboard → **Project Settings → Edge Functions → Add new secret**
(https://supabase.com/dashboard/project/rlnnhgnuprtatmhqxirb/settings/functions):

| Secret | Value | Required |
| --- | --- | --- |
| `RESEND_API_KEY` | the key from Step 1 | yes |
| `CONTACT_TO_EMAIL` | where leads go, e.g. `hello@rallyhub.games` | optional (defaults to `hello@rallyhub.games`) |
| `CONTACT_FROM_EMAIL` | verified sender, e.g. `RallyHub <noreply@rallyhub.games>` | optional (has that default) |

Save. No redeploy needed. Test by submitting the form on rallyhub.games, you
should receive the email, and the row's `emailed` column flips to `true`. The
reply-to is set to the visitor's email, so you can reply straight from your inbox.

You can also read leads any time in SQL / the table editor (`contact_submissions`,
super-admin readable), so the form works even before this step.

---

## Step 3 — EMAIL-1: send Supabase Auth emails from your domain

Supabase's built-in email sender is test-only (heavily rate limited, sends from a
Supabase address, lands in spam). Point Auth at Resend instead.

### 3a. Custom SMTP

Dashboard → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**
and enter Resend's SMTP details:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` |
| Password | your Resend API key (from Step 1) |
| Sender email | `noreply@rallyhub.games` |
| Sender name | `RallyHub` |

Save. Raise the auth email rate limits if needed under the same Auth settings.

### 3b. Branded templates

Dashboard → **Authentication → Emails → Templates**. For each template, set the
subject and paste the matching HTML block from
[`docs/email/rallyhub-auth-templates.html`](email/rallyhub-auth-templates.html):

| Supabase template | Subject | Block in the file |
| --- | --- | --- |
| Confirm signup | Confirm your RallyHub account | CONFIRM SIGNUP |
| Reset password | Reset your RallyHub password | RESET PASSWORD |
| Magic link | Your RallyHub sign-in link | MAGIC LINK |
| Invite user | You have been invited to RallyHub | INVITE USER |
| Change email | Confirm your new RallyHub email | CHANGE EMAIL |

The templates use Supabase's own `{{ .ConfirmationURL }}` variable, so the links
work as-is. Send yourself a password reset from the app to confirm delivery and
branding.

> Note: current signup auto-confirms email (the `register-client` function sets
> `email_confirm: true`), so the "Confirm signup" template only sends if you later
> switch to real email verification. Password reset is the one to test first.

---

## What is already done in code

- `submit-contact` Edge Function: deployed, `verify_jwt` on, validates input,
  honeypot, per-IP rate limit (10/hour), stores the lead, emails via Resend when
  the key is present.
- `contact_submissions` table + RLS (super-admin read only; writes via the
  function's service role).
- Marketing demo form calls the function with loading / success / error states
  and a mailto fallback shown on error.
- Branded auth email templates in `docs/email/rallyhub-auth-templates.html`.

Only the dashboard configuration above is left, and it is all yours to do
because it needs your Resend credentials.
