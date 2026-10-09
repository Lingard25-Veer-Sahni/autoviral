import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Autoviral] Supabase env vars are missing. Copy web/.env.example to web/.env.local and fill in your project URL + anon key. Auth/data features are disabled until then.'
  )
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)
