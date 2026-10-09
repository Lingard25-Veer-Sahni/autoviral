import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseConfigured = Boolean(url && serviceKey)

if (!supabaseConfigured) {
  console.warn(
    '[Autoviral server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing from server/.env, ' +
      'database-backed routes will fail until configured. See SETUP.md.'
  )
}

// Service-role client: bypasses RLS. Only ever used server-side.
export const supabaseAdmin = createClient(
  url || 'https://placeholder.supabase.co',
  serviceKey || 'placeholder-service-key',
  { auth: { persistSession: false } }
)
