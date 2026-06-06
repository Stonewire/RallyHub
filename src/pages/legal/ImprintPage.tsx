{/*
  DRAFT — requires review by a qualified lawyer before production use.
*/}
import { LegalPageLayout, LegalSection } from '@/components/legal/LegalPageLayout'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_REGISTRATION,
  LEGAL_ENTITY_VAT,
} from '@/lib/legal-placeholders'

export function ImprintPage() {
  return (
    <LegalPageLayout
      title="Imprint"
      description="Legal notice and provider information for RallyHub."
      path="/imprint"
    >
      <LegalSection title="Service provider">
        <p>
          <strong>{LEGAL_ENTITY_NAME}</strong>
          <br />
          {LEGAL_ENTITY_ADDRESS}
        </p>
      </LegalSection>

      <LegalSection title="Registration">
        <p>
          Company registration: {LEGAL_ENTITY_REGISTRATION}
          <br />
          VAT identification: {LEGAL_ENTITY_VAT}
        </p>
        <p>
          Register court / trade register details: [Trade Register Placeholder, Malta]
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
          <br />
          Phone: [Phone Number Placeholder]
        </p>
      </LegalSection>

      <LegalSection title="Represented by">
        <p>Managing director / authorized representative: [Name Placeholder]</p>
      </LegalSection>

      <LegalSection title="Responsible for content">
        <p>
          Responsible person under § 18 Abs. 2 MStV (where applicable) / editorial responsibility:{' '}
          [Name and Address Placeholder]
        </p>
      </LegalSection>

      <LegalSection title="EU dispute resolution">
        <p>
          The European Commission provides an online dispute resolution platform at{' '}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ec.europa.eu/consumers/odr
          </a>
          . We are not obliged or willing to participate in dispute resolution proceedings before a
          consumer arbitration board unless required by law.
        </p>
      </LegalSection>

      <LegalSection title="Liability for links">
        <p>
          Our site may contain links to external websites. We have no control over their content and
          assume no liability. The respective provider is responsible for linked pages.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
