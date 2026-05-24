import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url?.trim() || !anonKey?.trim()) {
  console.warn(
    '[RallyHub] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env',
  )
}

export const supabase = createClient<Database>(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
)
