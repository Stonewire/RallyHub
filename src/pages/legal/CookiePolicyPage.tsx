{/*
  DRAFT — requires review by a qualified lawyer before production use.
*/}
import { Link } from 'react-router-dom'

import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal-placeholders'

export function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      description="How RallyHub uses cookies and similar technologies."
      path="/cookies"
    >
      <LegalSection title="1. What are cookies and local storage?">
        <p>
          Cookies are small text files stored on your device. Local storage is a similar browser
          mechanism that lets websites remember information between visits. Together, we refer to
          these as &quot;cookies and similar technologies.&quot;
        </p>
      </LegalSection>

      <LegalSection title="2. How RallyHub uses them">
        <p>We group technologies into the following categories:</p>
        <ul>
          <li>
            <strong>Essential (always active):</strong> authentication session tokens, security
            features, and storage of your cookie consent choice (key:{' '}
            <code className="text-foreground text-xs">{COOKIE_CONSENT_STORAGE_KEY}</code>).
            Without these, sign-in and core functionality would not work.
          </li>
          <li>
            <strong>Preferences (optional):</strong> optional UI settings beyond essential session
            data. Disabled unless you consent.
          </li>
          <li>
            <strong>Analytics (optional):</strong> help us understand product usage. RallyHub does
            not currently load third-party analytics scripts. If we introduce them in the future,
            they will only run after you consent.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Advertising cookies">
        <p>
          RallyHub does <strong>not</strong> use advertising or cross-site tracking cookies for
          marketing purposes.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-party cookies">
        <p>
          Essential authentication and storage may involve our infrastructure providers (for example
          Supabase) setting cookies or similar identifiers necessary to deliver the service. We do
          not permit optional third-party marketing cookies on RallyHub.
        </p>
      </LegalSection>

      <LegalSection title="5. Managing your choices">
        <p>
          On your first visit, we show a consent banner with equally prominent options to accept
          all, reject non-essential cookies, or manage preferences by category.
        </p>
        <p>
          You can change your choice at any time using the &quot;Cookie preferences&quot; link in
          our website footer or app footer. You can also clear cookies and local storage through
          your browser settings; doing so may sign you out or reset your preferences.
        </p>
        <p>
          For more about how we process personal data, see our{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="6. Legal basis">
        <p>
          Essential cookies are used based on our legitimate interest in providing a secure,
          functional service and, where required, to perform our contract with you. Optional
          categories rely on your consent under the ePrivacy Directive and GDPR, which you may
          withdraw at any time.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Questions about this Cookie Policy:{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
