import { useSyncExternalStore } from 'react'

import { useOptionalTenant } from '@/contexts/tenant-context'
import { i18n } from '@/lib/i18n'

/** What the product calls itself for everyone who has not white-labelled it. */
export const DEFAULT_PLATFORM_BRAND = 'RallyHub'

type BrandingOrg =
  | { name: string; hide_platform_branding: boolean }
  | null
  | undefined

/**
 * R2.9 white label: a client with `hide_platform_branding` sees their own name
 * where ours would be. Everyone else, and anyone we cannot resolve an org for,
 * sees ours.
 */
export function platformBrandName(org: BrandingOrg): string {
  const own = org?.name.trim()
  return org?.hide_platform_branding && own ? own : DEFAULT_PLATFORM_BRAND
}

/**
 * Copy that names the product writes `{{brand}}` rather than "RallyHub", and
 * i18next fills it in from here. One key per string instead of a white-label
 * duplicate of each; a call site only passes `brand` itself when it knows
 * better than the app-wide answer.
 *
 * Written during render rather than from an effect on purpose: an effect lands
 * after the layout's children have already interpolated their strings, so a
 * white-labelled panel would show "RallyHub" until something re-rendered. The
 * write is idempotent and cheap.
 */
function publishBrand(brand: string): void {
  i18n.options.interpolation ??= {}
  const interpolation = i18n.options.interpolation
  if (interpolation.defaultVariables?.brand === brand) return
  interpolation.defaultVariables = { ...interpolation.defaultVariables, brand }
}

// Set at module load so a string interpolated before React has resolved
// anything still reads "RallyHub" rather than a raw placeholder.
publishBrand(DEFAULT_PLATFORM_BRAND)

let liveBrand = DEFAULT_PLATFORM_BRAND
const liveBrandListeners = new Set<() => void>()

/**
 * Live surfaces (join, display, facilitator, tablet) never sit under a
 * TenantProvider: they resolve their organisation from the event bundle
 * instead. They hand it over here so the same white-label answer reaches
 * everything they render, tab title included. Pass null on unmount so the next
 * surface in the tab does not inherit it.
 */
export function setLivePlatformBrandOrg(org: BrandingOrg): void {
  const next = platformBrandName(org)
  if (next === liveBrand) return
  liveBrand = next
  for (const listener of liveBrandListeners) listener()
}

function subscribeLiveBrand(listener: () => void): () => void {
  liveBrandListeners.add(listener)
  return () => {
    liveBrandListeners.delete(listener)
  }
}

function liveBrandSnapshot(): string {
  return liveBrand
}

/** The name this viewer should see the product called. */
export function usePlatformBrand(): string {
  const tenant = useOptionalTenant()
  const live = useSyncExternalStore(subscribeLiveBrand, liveBrandSnapshot, liveBrandSnapshot)
  // A TenantProvider above is the authority: it already knows whether this is a
  // client panel or the platform. Without one we are on a live surface, where
  // the event bundle is the only source there is.
  const brand = tenant ? platformBrandName(tenant.tenantOrg) : live
  publishBrand(brand)
  return brand
}
