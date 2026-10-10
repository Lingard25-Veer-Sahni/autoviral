import { Router } from 'express'
import { sendEmail, wrapEmailHtml } from '../services/email.js'

const router = Router()

// Website URL the welcome email's button links back to.
const SITE_URL = process.env.CLIENT_URL || 'https://auto-viral.online'

/**
 * POST /api/auth/welcome-email - fired once by web/src/pages/Signup.tsx
 * right after a successful supabase.auth.signUp() call. Intentionally not
 * behind requireAuth: at this exact moment the new user's session may not
 * be confirmed/active yet (email-confirmation flows), and this endpoint
 * only ever sends a fixed, non-sensitive thank-you email, it can't be used
 * to read or modify any account data. Best-effort: a failed send here
 * should never block or error out the signup flow itself.
 */
router.post('/welcome-email', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' })
  }

  await sendEmail({
    to: email,
    subject: 'Welcome to Autoviral',
    html: wrapEmailHtml(
      `Welcome${name ? `, ${name}` : ''}!`,
      `
        <p>Thanks for signing up for Autoviral. Your account is ready, buy a credit pack and generate your first AI video in minutes.</p>
        <p style="margin-top: 24px;">
          <a href="${SITE_URL}" style="display: inline-block; background: #ffb800; color: #1a1a1a; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            Go to Autoviral
          </a>
        </p>
      `
    ),
  })

  res.json({ ok: true })
})

export default router
