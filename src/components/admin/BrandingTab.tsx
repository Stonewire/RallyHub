import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useOrganization,
  useSaveOrganizationBranding,
} from '@/hooks/use-organization-settings'
import { useNotification } from '@/contexts/notification-context'
import { uploadAsset } from '@/lib/storage'

/** Item 7: client branding — logos, colors, fonts. Each field documents what it affects. */
export function BrandingTab({ organizationId }: { organizationId: string }) {
  const orgQuery = useOrganization(organizationId)
  const save = useSaveOrganizationBranding(organizationId)
  const { notify } = useNotification()
  const org = orgQuery.data

  const [primary, setPrimary] = useState('#000000')
  const [secondary, setSecondary] = useState('#000000')
  const [accent, setAccent] = useState('#000000')
  const [headingFont, setHeadingFont] = useState('')
  const [bodyFont, setBodyFont] = useState('')
  const [hideBranding, setHideBranding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const lightRef = useRef<HTMLInputElement>(null)
  const darkRef = useRef<HTMLInputElement>(null)
  const headingFontRef = useRef<HTMLInputElement>(null)
  const bodyFontRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!org) return
    setPrimary(org.primary_color)
    setSecondary(org.secondary_color)
    setAccent(org.accent_color)
    setHeadingFont(org.brand_heading_font ?? '')
    setBodyFont(org.brand_body_font ?? '')
    setHideBranding(org.hide_platform_branding)
  }, [org])

  if (orgQuery.isLoading) return <QueryLoading rows={4} />
  if (orgQuery.isError) return <QueryError message={orgQuery.error.message} />
  if (!org) return <QueryError message="Organization not found" />

  const ext = (f: File) => f.name.split('.').pop()?.toLowerCase() || 'bin'

  async function uploadLogo(file: File | undefined, field: 'logo_light_url' | 'logo_dark_url') {
    if (!file) return
    setBusy(field)
    try {
      const url = await uploadAsset(
        'organization-logos',
        `${organizationId}/${field}-${Date.now()}.${ext(file)}`,
        file,
        { mediaKind: 'logo' },
      )
      await save.mutateAsync({ [field]: url })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }

  async function uploadFont(file: File | undefined, field: 'brand_heading_font_url' | 'brand_body_font_url') {
    if (!file) return
    setBusy(field)
    try {
      const url = await uploadAsset(
        'organization-logos',
        `${organizationId}/${field}-${Date.now()}.${ext(file)}`,
        file,
        { mediaKind: 'logo' },
      )
      await save.mutateAsync({ [field]: url })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }

  async function saveSettings() {
    setSaved(false)
    try {
      await save.mutateAsync({
        primary_color: primary,
        secondary_color: secondary,
        accent_color: accent,
        brand_heading_font: headingFont.trim() || null,
        brand_body_font: bodyFont.trim() || null,
        hide_platform_branding: hideBranding,
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save branding')
    }
  }

  return (
    <div className="space-y-8">
      {/* Logos */}
      <Card className="border-border/80 space-y-5 bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">Logos</h2>
          <p className="text-muted-foreground text-sm">
            Your logo replaces "RallyHub" on the display screen, player join pages, your admin
            panel, and report PDFs. Upload two versions so it stays visible on any background.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <LogoUploadField
            label="Light logo (for dark backgrounds)"
            hint="Used on dark display screens and dark mode. Light-coloured / white logo, PNG or SVG with transparency."
            url={org.logo_light_url}
            busy={busy === 'logo_light_url'}
            inputRef={lightRef}
            onPick={(f) => void uploadLogo(f, 'logo_light_url')}
          />
          <LogoUploadField
            label="Dark logo (for light backgrounds)"
            hint="Used on light screens and light mode. Dark-coloured logo, PNG or SVG with transparency."
            url={org.logo_dark_url}
            busy={busy === 'logo_dark_url'}
            inputRef={darkRef}
            onPick={(f) => void uploadLogo(f, 'logo_dark_url')}
          />
        </div>
      </Card>

      {/* Colors */}
      <Card className="border-border/80 space-y-5 bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">Colours</h2>
          <p className="text-muted-foreground text-sm">
            These drive the animated background and accents on live event screens (display + player).
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <ColorField label="Primary" hint="Main background glow on live screens." value={primary} onChange={setPrimary} />
          <ColorField label="Secondary" hint="Supporting tone in the background blend." value={secondary} onChange={setSecondary} />
          <ColorField label="Accent" hint="Highlights and the second background glow." value={accent} onChange={setAccent} />
        </div>
      </Card>

      {/* Fonts */}
      <Card className="border-border/80 space-y-5 bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">Fonts</h2>
          <p className="text-muted-foreground text-sm">
            Applied across the platform. For each, either type a Google Fonts family name, or upload
            a font file (.woff2 / .ttf) you're licensed to use. An uploaded file takes priority.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <FontField
            label="Heading font"
            hint="Titles and large headings (e.g. event name on the display)."
            value={headingFont}
            onChange={setHeadingFont}
            uploadedUrl={org.brand_heading_font_url}
            busy={busy === 'brand_heading_font_url'}
            inputRef={headingFontRef}
            onPick={(f) => void uploadFont(f, 'brand_heading_font_url')}
            onClearUpload={() => void save.mutateAsync({ brand_heading_font_url: null })}
          />
          <FontField
            label="Body font"
            hint="All other text across the app."
            value={bodyFont}
            onChange={setBodyFont}
            uploadedUrl={org.brand_body_font_url}
            busy={busy === 'brand_body_font_url'}
            inputRef={bodyFontRef}
            onPick={(f) => void uploadFont(f, 'brand_body_font_url')}
            onClearUpload={() => void save.mutateAsync({ brand_body_font_url: null })}
          />
        </div>
      </Card>

      {/* RallyHub watermark */}
      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold">RallyHub watermark</h2>
          <p className="text-muted-foreground text-sm">
            The small "Powered by RallyHub" mark on live event screens.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideBranding}
            onChange={(e) => setHideBranding(e.target.checked)}
          />
          Hide the "Powered by RallyHub" watermark on my event screens
        </label>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-green-600">Saved!</span> : null}
        <NeoButton
          type="button"
          variant="primary"
          disabled={save.isPending}
          onClick={() => void saveSettings()}
        >
          {save.isPending ? 'Saving…' : 'Save branding'}
        </NeoButton>
      </div>
    </div>
  )
}

function LogoUploadField({
  label,
  hint,
  url,
  busy,
  inputRef,
  onPick,
}: {
  label: string
  hint: string
  url: string | null
  busy: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (f: File | undefined) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <div className="bg-muted/30 flex h-20 items-center justify-center rounded-lg p-2">
        {url ? (
          <img src={url} alt={label} className="max-h-16 w-auto" />
        ) : (
          <span className="text-muted-foreground text-xs">No logo yet</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        {busy ? 'Uploading…' : 'Upload'}
      </Button>
    </div>
  )
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border"
          aria-label={`${label} colour`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-background font-mono" />
      </div>
    </div>
  )
}

function FontField({
  label,
  hint,
  value,
  onChange,
  uploadedUrl,
  busy,
  inputRef,
  onPick,
  onClearUpload,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  uploadedUrl: string | null
  busy: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onPick: (f: File | undefined) => void
  onClearUpload: () => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Poppins (Google Fonts)"
        className="bg-background"
      />
      <input
        ref={inputRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf,font/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" />
          {busy ? 'Uploading…' : uploadedUrl ? 'Replace file' : 'Upload file'}
        </Button>
        {uploadedUrl ? (
          <button type="button" className="text-destructive text-xs underline" onClick={onClearUpload}>
            Remove uploaded font
          </button>
        ) : null}
      </div>
      {uploadedUrl ? (
        <p className="text-muted-foreground text-xs">Custom font file in use (overrides the name above).</p>
      ) : null}
    </div>
  )
}
