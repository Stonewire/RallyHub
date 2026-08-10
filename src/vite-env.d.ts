/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PLATFORM_HOST?: string
  readonly VITE_ADMIN_HOST?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_PLATFORM_ORG_ID?: string
  readonly VITE_TENANT_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
