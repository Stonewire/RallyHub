import { useEffect } from 'react'

type PageHeadProps = {
  title: string
  description: string
  path?: string
  ogImage?: string
}

const SITE_NAME = 'RallyHub'
const DEFAULT_OG_IMAGE = '/og-image.jpg'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Sets document title and core SEO / Open Graph tags for marketing pages. */
export function PageHead({
  title,
  description,
  path = '/',
  ogImage = DEFAULT_OG_IMAGE,
}: PageHeadProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`
    document.title = fullTitle

    upsertMeta('name', 'description', description)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}${path}`
    const image = ogImage.startsWith('http') ? ogImage : `${origin}${ogImage}`

    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', image)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', image)
  }, [title, description, path, ogImage])

  return null
}
