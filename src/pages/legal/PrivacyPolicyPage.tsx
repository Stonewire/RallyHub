{/*
  DRAFT — requires review by a qualified lawyer before production use.
*/}
import { Link } from 'react-router-dom'

import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_NAME,
} from '@/lib/legal-placeholders'

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How RallyHub collects, uses, and protects personal data under GDPR."
      path="/privacy"
    >
      <LegalSection title="1. Who we are">
        <p>
          {LEGAL_ENTITY_NAME} (&quot;RallyHub&quot;, &quot;we&quot;, &quot;us&quot;) provides a
          platform for live team events and games. Our registered address is {LEGAL_ENTITY_ADDRESS}.
        </p>
        <p>
          For privacy enquiries and to exercise your data protection rights, contact{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Roles under GDPR">
        <p>
          <strong>When you use RallyHub as an organization administrator or staff member</strong>,
          we act as the <strong>data controller</strong> for your account information and billing
          details.
        </p>
        <p>
          <strong>When your organization runs a live event</strong>, your organization is typically
          the data controller for participant and event content data. RallyHub acts as a{' '}
          <strong>data processor</strong> on the organization&apos;s instructions, providing hosting,
          authentication, storage, and event tooling.
        </p>
        <p>
          Event organizers are responsible for providing participants with their own privacy
          notices and lawful bases for processing.
        </p>
      </LegalSection>

      <LegalSection title="3. Data we collect">
        <ul>
          <li>
            <strong>Account data:</strong> name, email address, organization affiliation, role,
            authentication identifiers, and profile settings.
          </li>
          <li>
            <strong>Event data:</strong> event names, schedules, teams, facilitator actions, scores,
            and configuration chosen by your organization.
          </li>
          <li>
            <strong>Participant submissions:</strong> photos, videos, quiz answers, bingo
            interactions, display names, and other content submitted during events.
          </li>
          <li>
            <strong>Usage and technical data:</strong> log data, device/browser type, IP address,
            timestamps, and error diagnostics needed to operate and secure the service.
          </li>
          <li>
            <strong>Billing data:</strong> plan selection, per-event billing records, and invoicing
            information where applicable.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Legal bases for processing">
        <p>We process personal data on the following bases, depending on context:</p>
        <ul>
          <li>
            <strong>Contract:</strong> to provide the RallyHub service, manage accounts, and
            deliver events you configure.
          </li>
          <li>
            <strong>Legitimate interests:</strong> to secure the platform, prevent abuse, improve
            reliability, and support customers — balanced against your rights.
          </li>
          <li>
            <strong>Legal obligation:</strong> where required by applicable law, including tax and
            accounting rules.
          </li>
          <li>
            <strong>Consent:</strong> for optional cookies and similar technologies where required.
            See our <Link to="/cookies">Cookie Policy</Link>.
          </li>
        </ul>
        <p>
          Organizations running events must establish their own lawful basis for participant data
          they collect through RallyHub.
        </p>
      </LegalSection>

      <LegalSection title="5. How we use data">
        <ul>
          <li>Authenticate users and maintain sessions.</li>
          <li>Host, synchronize, and display live event experiences.</li>
          <li>Store game assets, submissions, and event outputs.</li>
          <li>Provide admin dashboards, billing, and customer support.</li>
          <li>Monitor performance, troubleshoot issues, and protect against misuse.</li>
          <li>Comply with legal requests and enforce our Terms of Service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Processors and sharing">
        <p>
          We use trusted service providers who process data on our instructions under appropriate
          agreements:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication, file storage, and related
            infrastructure.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and content delivery.
          </li>
        </ul>
        <p>
          We do not sell personal data. We may disclose information if required by law, to protect
          rights and safety, or in connection with a merger or acquisition subject to appropriate
          safeguards.
        </p>
      </LegalSection>

      <LegalSection title="7. International transfers">
        <p>
          Our processors may store or process data outside the European Economic Area. Where this
          occurs, we rely on appropriate safeguards such as Standard Contractual Clauses or
          equivalent mechanisms approved under GDPR.
        </p>
      </LegalSection>

      <LegalSection title="8. Retention">
        <p>
          We retain account and billing data for as long as your organization maintains an active
          relationship with RallyHub and as required thereafter for legal, tax, and dispute
          resolution purposes.
        </p>
        <p>
          Event and participant content is retained according to your organization&apos;s settings
          and instructions, and deleted when no longer needed for the purpose collected or upon
          verified deletion requests where we act as processor.
        </p>
        <p>
          Security logs and essential operational records may be kept for a limited period consistent
          with security and compliance needs.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>
          If GDPR applies to you, you may have the right to access, rectify, erase, restrict,
          object to processing, and receive a portable copy of your personal data. Where processing
          is based on consent, you may withdraw consent at any time without affecting prior lawful
          processing.
        </p>
        <p>
          To exercise rights relating to your RallyHub account, email{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. For participant data
          processed during an event, contact the organizing organization first; we will assist them
          as processor where applicable.
        </p>
        <p>
          You may lodge a complaint with your local supervisory authority. In Malta, this is the
          Office of the Information and Data Protection Commissioner (IDPC).
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          We implement technical and organizational measures appropriate to the risk, including
          access controls, encryption in transit, and role-based permissions. No method of
          transmission or storage is completely secure.
        </p>
      </LegalSection>

      <LegalSection title="11. Children">
        <p>
          RallyHub is intended for organizational use. Organizations must not use the service to
          knowingly collect personal data from children without appropriate authority and safeguards.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be posted on
          this page with an updated date.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
