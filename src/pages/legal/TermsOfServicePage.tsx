{/*
  DRAFT — requires review by a qualified lawyer before production use.
*/}
import { Link } from 'react-router-dom'

import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DSA_CONTACT_EMAIL,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_NAME,
} from '@/lib/legal-placeholders'

export function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="Terms governing use of the RallyHub platform."
      path="/terms"
    >
      <LegalSection title="1. Agreement">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of RallyHub, operated
          by {LEGAL_ENTITY_NAME} ({LEGAL_ENTITY_ADDRESS}). By creating an account or using the
          service, you agree to these Terms.
        </p>
      </LegalSection>

      <LegalSection title="2. The service">
        <p>
          RallyHub is a software platform that enables organizations to configure and run live team
          games and events, including facilitator tools, participant views, and content management.
          Features may change over time as we improve the product.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <ul>
          <li>You must provide accurate registration information and keep credentials secure.</li>
          <li>You are responsible for activity under your account and for users you authorize.</li>
          <li>
            We may suspend or terminate accounts that violate these Terms or pose a security or legal
            risk.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use RallyHub for unlawful, harmful, or deceptive purposes.</li>
          <li>Upload content that infringes intellectual property or privacy rights of others.</li>
          <li>Attempt to bypass security, probe systems, or disrupt events or infrastructure.</li>
          <li>Reverse engineer or resell the service except as expressly permitted.</li>
          <li>Use the platform to send spam or unsolicited marketing to participants.</li>
        </ul>
        <p>
          Organizations are responsible for content they and their participants submit during
          events, and for obtaining necessary consents and permissions.
        </p>
      </LegalSection>

      <LegalSection title="5. Billing and plans">
        <p>
          RallyHub may offer subscription plans and <strong>per-event billing</strong>. Fees, plan
          limits, and invoicing terms are described at purchase or in your organization settings.
        </p>
        <ul>
          <li>Prices are shown before you incur charges unless otherwise agreed in writing.</li>
          <li>Per-event fees apply when you activate chargeable events under your plan.</li>
          <li>Taxes may apply depending on your jurisdiction.</li>
          <li>Failure to pay may result in suspension of paid features.</li>
        </ul>
        <p>
          Unless required by law, fees already incurred for completed or activated events are
          non-refundable. Plan-specific refund or cancellation terms, if any, are stated at checkout
          or in your agreement.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          RallyHub, its software, branding, and documentation remain our property or that of our
          licensors. You retain ownership of content you upload. You grant us a limited license to
          host, process, and display that content solely to provide the service.
        </p>
      </LegalSection>

      <LegalSection title="7. Availability and support">
        <p>
          We aim for reliable uptime but do not guarantee uninterrupted access. Maintenance, third-
          party outages, or force majeure may affect availability. Support channels and response
          times depend on your plan.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; TO THE MAXIMUM
          EXTENT PERMITTED BY LAW. WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT EVENTS WILL MEET EVERY
          ORGANIZATIONAL REQUIREMENT OR THAT USER-GENERATED CONTENT IS ACCURATE.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {LEGAL_ENTITY_NAME.toUpperCase()} AND
          ITS AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR GOODWILL.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR CLAIMS ARISING FROM OR RELATED TO THE SERVICE IN ANY TWELVE-MONTH
          PERIOD IS LIMITED TO THE GREATER OF (A) AMOUNTS YOU PAID US FOR THE SERVICE IN THAT PERIOD
          OR (B) ONE HUNDRED EUROS (€100), EXCEPT WHERE LIABILITY CANNOT BE LIMITED UNDER EU OR
          MALTESE CONSUMER LAW.
        </p>
      </LegalSection>

      <LegalSection title="10. Digital Services Act (DSA)">
        <p>
          RallyHub is an online platform within the meaning of the EU Digital Services Act (Regulation
          (EU) 2022/2065). In line with transparency and accountability obligations:
        </p>
        <ul>
          <li>
            These Terms explain the main rules governing use of our service and restrictions we
            apply.
          </li>
          <li>
            Our single point of contact for DSA-related enquiries (including illegal content notices
            where applicable) is{' '}
            <a href={`mailto:${LEGAL_DSA_CONTACT_EMAIL}`}>{LEGAL_DSA_CONTACT_EMAIL}</a>.
          </li>
          <li>
            We may provide information about content moderation measures, reporting mechanisms, and
            complaint handling in separate notices as required by the DSA and our role in the
            service chain.
          </li>
        </ul>
        <p>
          Organizations using RallyHub for their own events remain responsible for content and
          activities they control within their events, subject to their agreements with us and
          applicable law.
        </p>
      </LegalSection>

      <LegalSection title="11. Privacy">
        <p>
          Our processing of personal data is described in the{' '}
          <Link to="/privacy">Privacy Policy</Link>. Cookie use is described in the{' '}
          <Link to="/cookies">Cookie Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          These Terms are governed by the laws of <strong>Malta</strong>, without regard to conflict-
          of-law rules. Where you qualify as a consumer in the European Union, mandatory consumer
          protection laws of your country of residence may also apply.
        </p>
        <p>
          Courts in Malta shall have jurisdiction for disputes arising from these Terms, subject to
          mandatory consumer jurisdiction rules.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these Terms:{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes">
        <p>
          We may update these Terms. Continued use after the effective date of changes constitutes
          acceptance where permitted by law. Material changes will be communicated through the
          service or by email where appropriate.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
