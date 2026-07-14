{/*
  DRAFT — requires review by a qualified lawyer before production use.

  This is a GDPR Article 28 processor agreement. It is the document that makes it
  lawful for a customer (the controller) to put their participants' personal data
  into RallyHub (the processor). Article 28 requires it in writing; the sub-clauses
  below map to Art. 28(3)(a)–(h) and are not optional garnish.
*/}
import { Link } from 'react-router-dom'

import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_NAME,
  LEGAL_LAST_UPDATED,
} from '@/lib/legal-placeholders'

export function DataProcessingAgreementPage() {
  return (
    <LegalPageLayout
      title="Data Processing Agreement"
      description="GDPR Article 28 terms governing RallyHub's processing of personal data on behalf of customer organizations."
      path="/dpa"
    >
      <LegalSection title="1. Parties and scope">
        <p>
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the{' '}
          <Link to="/terms">Terms of Service</Link> between {LEGAL_ENTITY_NAME}{' '}
          (&quot;RallyHub&quot;, the <strong>processor</strong>), registered at{' '}
          {LEGAL_ENTITY_ADDRESS}, and the organization that has created a RallyHub account
          (the &quot;Customer&quot;, the <strong>controller</strong>).
        </p>
        <p>
          It applies whenever RallyHub processes personal data on the Customer&apos;s behalf, and
          is entered into under Article 28 of the General Data Protection Regulation (EU)
          2016/679 (&quot;GDPR&quot;). Where this DPA conflicts with the Terms of Service on a
          matter of data protection, this DPA prevails.
        </p>
      </LegalSection>

      <LegalSection title="2. Roles">
        <p>
          The Customer is the <strong>controller</strong>: it decides to run an event, decides
          which participants take part, and decides what challenges those participants respond
          to. RallyHub is the <strong>processor</strong>: it processes that data only to provide
          the service.
        </p>
        <p>
          The Customer is responsible for having a lawful basis for the processing, and for
          providing participants with the information required by Articles 13 and 14 GDPR
          before they take part.
        </p>
        <p>
          RallyHub acts as an independent controller for a limited set of data it decides on
          itself — account records, billing, security logs, and service communications. That
          processing is governed by the <Link to="/privacy">Privacy Policy</Link>, not this DPA.
        </p>
      </LegalSection>

      <LegalSection title="3. Subject matter, duration, nature and purpose">
        <ul>
          <li>
            <strong>Subject matter:</strong> provision of the RallyHub platform for running live
            team events, quests, quizzes and music bingo.
          </li>
          <li>
            <strong>Duration:</strong> for as long as the Customer has an active account, plus
            the retention period in section 10.
          </li>
          <li>
            <strong>Nature and purpose:</strong> hosting, storage, authentication, real-time
            event delivery, scoring, and making participant submissions available to the
            Customer.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Categories of data subject and personal data">
        <p>
          <strong>Data subjects:</strong> the Customer&apos;s staff (administrators, event
          managers, facilitators) and the participants who join its events.
        </p>
        <p>
          <strong>Categories of personal data:</strong>
        </p>
        <ul>
          <li>Staff: name, email address, role, authentication data.</li>
          <li>
            Participants: the team name and player name they enter, and the content they submit.
          </li>
          <li>
            <strong>Photos and videos submitted during an event.</strong> These will normally
            contain images of identifiable people, and are therefore personal data. The Customer
            decides what challenges it sets and is responsible for the consequences of that
            choice.
          </li>
        </ul>
        <p>
          RallyHub does not request, and the service is not designed to hold, special category
          data under Article 9 GDPR (health, biometric identification, political opinions, and so
          on). The Customer must not set challenges that solicit such data.
        </p>
        <p>
          <strong>Children.</strong> Where the Customer is a school or otherwise runs events for
          participants below the age of digital consent in their member state, the Customer is
          solely responsible for obtaining any parental or guardian consent required by Article 8
          GDPR before those participants take part.
        </p>
      </LegalSection>

      <LegalSection title="5. RallyHub's obligations (Art. 28(3))">
        <ul>
          <li>
            <strong>Documented instructions.</strong> RallyHub processes personal data only on the
            Customer&apos;s documented instructions, which include use of the platform through its
            normal features, unless required otherwise by EU or member state law.
          </li>
          <li>
            <strong>Confidentiality.</strong> Personnel authorised to process the data are bound by
            confidentiality obligations.
          </li>
          <li>
            <strong>Security.</strong> RallyHub implements appropriate technical and organisational
            measures under Article 32 (see section 7).
          </li>
          <li>
            <strong>Sub-processors.</strong> Engaged only under section 8.
          </li>
          <li>
            <strong>Assistance with data subject rights.</strong> RallyHub assists the Customer, so
            far as is reasonably possible, in responding to requests to exercise rights under
            Chapter III GDPR.
          </li>
          <li>
            <strong>Assistance with Articles 32–36.</strong> RallyHub assists the Customer with
            security, breach notification, and data protection impact assessments, taking into
            account the nature of the processing and the information available to it.
          </li>
          <li>
            <strong>Deletion or return.</strong> On termination, RallyHub deletes or returns the
            personal data as set out in section 10.
          </li>
          <li>
            <strong>Audit.</strong> RallyHub makes available the information necessary to
            demonstrate compliance with Article 28 and allows for audits as described in section 11.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Customer's obligations">
        <ul>
          <li>
            Ensure there is a lawful basis for the processing, and that participants have received
            the information required by Articles 13 and 14 before joining an event.
          </li>
          <li>
            Obtain any consent required — in particular parental consent for children under
            Article 8 GDPR.
          </li>
          <li>
            Not submit special category data, and not set challenges that solicit it.
          </li>
          <li>
            Manage its own users&apos; access, and remove staff accounts promptly when they leave.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Security measures (Art. 32)">
        <p>RallyHub maintains, at a minimum:</p>
        <ul>
          <li>Encryption in transit (TLS) and encryption at rest for stored data.</li>
          <li>
            Row-level security in the database, so one organization&apos;s data is not readable by
            another.
          </li>
          <li>
            Role-based access control (super admin, client admin, event manager, facilitator), with
            access limited to what each role needs.
          </li>
          <li>
            Short-lived, event-scoped tokens for anonymous participant access, rather than
            long-lived credentials.
          </li>
          <li>Restriction of uploaded file types, and isolation of uploaded content.</li>
          <li>Logging of administrative and event activity.</li>
          <li>Regular backups, with restore capability.</li>
        </ul>
        <p>
          These measures may be updated as the service evolves, provided the level of security is
          not reduced.
        </p>
      </LegalSection>

      <LegalSection title="8. Sub-processors">
        <p>
          The Customer gives general written authorisation for RallyHub to engage sub-processors.
          RallyHub remains fully liable to the Customer for their performance, and imposes on them
          data protection obligations no less protective than those in this DPA.
        </p>
        <p>Current sub-processors:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication, file storage, serverless
            functions. Hosting region: EU.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and content delivery.
          </li>
          <li>
            <strong>Paddle</strong> — payment processing and invoicing. Paddle acts as Merchant of
            Record and as an independent controller for payment data.
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery (account and service emails).
          </li>
        </ul>
        <p>
          RallyHub will give the Customer reasonable notice before adding or replacing a
          sub-processor, and the Customer may object on reasonable data protection grounds. If the
          parties cannot resolve the objection, the Customer may terminate the affected service.
        </p>
      </LegalSection>

      <LegalSection title="9. International transfers">
        <p>
          Personal data is hosted in the European Union wherever the service is configured to do
          so. Where a sub-processor transfers personal data outside the EEA, that transfer is made
          under an adequacy decision or the European Commission&apos;s Standard Contractual
          Clauses, together with any supplementary measures required.
        </p>
      </LegalSection>

      <LegalSection title="10. Retention, deletion and return">
        <ul>
          <li>
            <strong>Event content</strong> (photo, video and text submissions) is retained while the
            event exists. The Customer can reset an event&apos;s gameplay data, and can delete an
            event, which removes its submissions.
          </li>
          <li>
            <strong>On account termination</strong>, RallyHub deletes the Customer&apos;s personal
            data within 90 days, unless retention is required by law. Backups are purged on their
            ordinary rotation cycle.
          </li>
          <li>
            <strong>Billing and invoice records</strong> are retained for the period required by
            tax and accounting law, and are not deleted on request.
          </li>
          <li>
            The Customer may request an export of its data before termination.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="11. Audit">
        <p>
          On reasonable written request, and no more than once a year unless a supervisory
          authority requires otherwise or a personal data breach has occurred, RallyHub will make
          available the information necessary to demonstrate compliance with Article 28, and will
          contribute to audits conducted by the Customer or an auditor it mandates. Audits must be
          conducted during business hours, with reasonable notice, and without unreasonably
          disrupting the service.
        </p>
      </LegalSection>

      <LegalSection title="12. Personal data breach">
        <p>
          RallyHub notifies the Customer without undue delay, and in any event within 72 hours, of
          becoming aware of a personal data breach affecting the Customer&apos;s personal data, and
          provides the information reasonably available to it so the Customer can meet its own
          obligations under Articles 33 and 34.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Data protection enquiries, data subject requests and breach notifications:{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
        <p className="text-muted-foreground text-sm">Last updated: {LEGAL_LAST_UPDATED}</p>
      </LegalSection>
    </LegalPageLayout>
  )
}
