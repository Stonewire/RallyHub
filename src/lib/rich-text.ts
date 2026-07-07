// Minimal allowlist sanitizer for the game-description rich text editor.
// Only the tags/styles our own toolbar produces survive; everything else is
// unwrapped to plain text (never dropped silently, never executed as script).

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'FONT', 'BR'])
const ALLOWED_STYLE_PROPS = new Set(['color', 'font-size'])

export function sanitizeRichText(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  clean(doc.body)
  return doc.body.innerHTML
}

function clean(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType !== Node.ELEMENT_NODE) {
      node.removeChild(child)
      continue
    }
    const el = child as HTMLElement
    clean(el)
    if (!ALLOWED_TAGS.has(el.tagName)) {
      const parent = el.parentNode!
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'style') {
        const kept: string[] = []
        for (const prop of Array.from(el.style)) {
          if (ALLOWED_STYLE_PROPS.has(prop)) {
            kept.push(`${prop}: ${el.style.getPropertyValue(prop)}`)
          }
        }
        if (kept.length) el.setAttribute('style', kept.join('; '))
        else el.removeAttribute('style')
      } else if (el.tagName === 'FONT' && attr.name === 'size') {
        if (!/^[1-7]$/.test(attr.value)) el.removeAttribute('size')
      } else if (el.tagName === 'FONT' && attr.name === 'color') {
        // execCommand('foreColor', ...) writes a `color` attribute, not a
        // style prop -- keep it (hex only, matching what our color input
        // always produces) instead of silently dropping it on save.
        if (!/^#[0-9a-fA-F]{3,8}$/.test(attr.value)) el.removeAttribute('color')
      } else {
        el.removeAttribute(attr.name)
      }
    }
  }
}
