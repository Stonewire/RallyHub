/**
 * Item 7: applies a client's brand fonts across the platform by overriding the
 * app's font CSS variables (--font-sans / --font-display / --font-heading).
 * Uploaded font files win over a Google Fonts family name. Mount once per page
 * tree (admin layout + each live surface); it renders nothing visible.
 */
type BrandingFonts = {
  brand_heading_font: string | null
  brand_body_font: string | null
  brand_heading_font_url: string | null
  brand_body_font_url: string | null
} | null

function googleHref(families: string[]): string {
  const q = families
    .map((f) => `family=${encodeURIComponent(f.trim()).replace(/%20/g, '+')}`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${q}&display=swap`
}

export function ClientBrandingStyle({ org }: { org: BrandingFonts }) {
  if (!org) return null

  const headingUpload = org.brand_heading_font_url
  const bodyUpload = org.brand_body_font_url
  const headingName = org.brand_heading_font?.trim() || null
  const bodyName = org.brand_body_font?.trim() || null

  const headingFamily = headingUpload ? 'ClientHeading' : headingName
  const bodyFamily = bodyUpload ? 'ClientBody' : bodyName

  if (!headingFamily && !bodyFamily) return null

  const googleFamilies = [
    !headingUpload && headingName ? headingName : null,
    !bodyUpload && bodyName ? bodyName : null,
  ].filter((f): f is string => Boolean(f))

  const css = [
    headingUpload
      ? `@font-face{font-family:'ClientHeading';src:url('${headingUpload}');font-display:swap;}`
      : '',
    bodyUpload
      ? `@font-face{font-family:'ClientBody';src:url('${bodyUpload}');font-display:swap;}`
      : '',
    `:root{${[
      bodyFamily ? `--font-sans:'${bodyFamily}',system-ui,-apple-system,sans-serif;` : '',
      headingFamily
        ? `--font-display:'${headingFamily}',Georgia,serif;--font-heading:'${headingFamily}',system-ui,sans-serif;`
        : '',
    ].join('')}}`,
  ].join('')

  return (
    <>
      {googleFamilies.length > 0 ? (
        <link rel="stylesheet" href={googleHref(googleFamilies)} />
      ) : null}
      <style>{css}</style>
    </>
  )
}
