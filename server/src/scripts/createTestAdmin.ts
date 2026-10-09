import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { supabaseAdmin, supabaseConfigured } from '../supabaseAdmin.js'

// One-off script: creates a real, working test admin account via Supabase's
// Admin Auth API (service-role only — bypasses email confirmation), then
// promotes the resulting profiles row to role='admin'. Prints the generated
// credentials so they can be handed to the user. Run with:
//   npx tsx src/scripts/createTestAdmin.ts

const EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@autoviral.test'
const PASSWORD = process.env.TEST_ADMIN_PASSWORD || `Av-${randomBytes(6).toString('hex')}!1`

async function main() {
  if (!supabaseConfigured) {
    throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).')
  }

  console.log(`[createTestAdmin] Creating auth user ${EMAIL} ...`)
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Autoviral Test Admin' },
  })

  let userId: string
  if (createErr) {
    // If it already exists (re-running this script), look it up instead of failing.
    if (createErr.message.toLowerCase().includes('already') || createErr.status === 422) {
      console.log(`[createTestAdmin] User already exists, looking it up...`)
      const listResult = await supabaseAdmin.auth.admin.listUsers()
      if (listResult.error) throw listResult.error
      const users = listResult.data.users as Array<{ id: string; email?: string }>
      const existing = users.find((u) => u.email === EMAIL)
      if (!existing) throw new Error(`Create failed and no existing user found for ${EMAIL}: ${createErr.message}`)
      userId = existing.id
      // Reset password to the one we're about to print, so it's guaranteed to work.
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: PASSWORD })
      if (updateErr) throw updateErr
    } else {
      throw createErr
    }
  } else {
    userId = created.user.id
  }

  console.log(`[createTestAdmin] Auth user id: ${userId}`)

  // The 0001_init.sql trigger auto-creates a profiles row on auth.users insert.
  // Give it a brief moment, then promote to admin.
  await new Promise((r) => setTimeout(r, 500))

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({ role: 'admin', credits: 999_999_999 })
    .eq('id', userId)
    .select()
    .single()

  if (profileErr) {
    throw new Error(`Failed to promote profile to admin: ${profileErr.message}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: EMAIL,
        password: PASSWORD,
        userId,
        role: profile.role,
        credits: profile.credits,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('createTestAdmin FAILED:', err)
  process.exit(1)
})
