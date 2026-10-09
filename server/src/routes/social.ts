import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabaseAdmin.js'
import { createOAuthState, verifyOAuthState } from '../services/oauthState.js'
import { encryptToken } from '../services/tokenCrypto.js'
import {
  youtubeConfigured,
  getYoutubeAuthUrl,
  exchangeYoutubeCode,
  getYoutubeChannel,
} from '../services/youtube.js'
import { instagramConfigured, getInstagramAuthUrl, completeInstagramLink } from '../services/instagram.js'

const router = Router()

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

function isPlatform(value: unknown): value is 'youtube' | 'instagram' {
  return value === 'youtube' || value === 'instagram'
}

// GET /api/social/status, which platforms this user has connected. Used by Accounts.tsx.
router.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  const { data } = await supabaseAdmin
    .from('social_accounts')
    .select('platform, connected')
    .eq('user_id', req.userId)

  const status = { youtube: false, instagram: false }
  for (const row of data || []) {
    if (row.platform === 'youtube') status.youtube = row.connected
    if (row.platform === 'instagram') status.instagram = row.connected
  }
  res.json(status)
})

// GET /api/social/:platform/oauth-url, kicks off the real OAuth dance.
router.get('/:platform/oauth-url', requireAuth, async (req: AuthedRequest, res) => {
  const { platform } = req.params
  if (!isPlatform(platform)) {
    return res.status(400).json({ error: 'Unknown platform' })
  }

  const configured = platform === 'youtube' ? youtubeConfigured : instagramConfigured
  if (!configured) {
    return res.json({
      configured: false,
      message: `${platform === 'youtube' ? 'YouTube' : 'Instagram'} isn't configured on the server yet. See SETUP.md for how to add credentials.`,
    })
  }

  const state = createOAuthState({ userId: req.userId!, platform })
  const url = platform === 'youtube' ? getYoutubeAuthUrl(state) : getInstagramAuthUrl(state)
  res.json({ configured: true, url })
})

// GET /api/social/:platform/callback, hit directly by Google/Meta's redirect (no auth header).
router.get('/:platform/callback', async (req, res) => {
  const { platform } = req.params
  const { code, state, error: oauthError } = req.query as Record<string, string | undefined>

  const fail = (message: string) =>
    res.redirect(`${CLIENT_URL}/app/accounts?error=${encodeURIComponent(message)}`)

  if (!isPlatform(platform)) return fail('Unknown platform')
  if (oauthError) return fail(`${platform} authorization was cancelled or denied.`)
  if (!code) return fail('Missing authorization code.')

  const statePayload = verifyOAuthState(state)
  if (!statePayload || statePayload.platform !== platform) {
    return fail('This authorization link expired or is invalid. Please try connecting again.')
  }

  try {
    if (platform === 'youtube') {
      const tokens = await exchangeYoutubeCode(code)
      const channel = await getYoutubeChannel(tokens.accessToken)

      await supabaseAdmin.from('social_accounts').upsert(
        {
          user_id: statePayload.userId,
          platform: 'youtube',
          account_name: channel.name,
          avatar_url: channel.avatarUrl,
          access_token: encryptToken(tokens.accessToken),
          refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
          expires_at: tokens.expiryDate ? new Date(tokens.expiryDate).toISOString() : null,
          scopes: tokens.scope ? tokens.scope.split(' ') : null,
          connected: true,
        },
        { onConflict: 'user_id,platform' }
      )
    } else {
      const link = await completeInstagramLink(code)
      await supabaseAdmin.from('social_accounts').upsert(
        {
          user_id: statePayload.userId,
          platform: 'instagram',
          account_name: link.username,
          avatar_url: link.avatarUrl,
          access_token: encryptToken(link.pageAccessToken),
          refresh_token: null,
          platform_account_id: link.igUserId,
          connected: true,
        },
        { onConflict: 'user_id,platform' }
      )
    }

    return res.redirect(`${CLIENT_URL}/app/accounts?connected=${platform}`)
  } catch (err) {
    console.error(`[social/${platform}/callback]`, err)
    return fail(err instanceof Error ? err.message : 'Failed to complete the connection.')
  }
})

// POST /api/social/:platform/disconnect
router.post('/:platform/disconnect', requireAuth, async (req: AuthedRequest, res) => {
  const { platform } = req.params
  if (!isPlatform(platform)) {
    return res.status(400).json({ error: 'Unknown platform' })
  }
  await supabaseAdmin.from('social_accounts').delete().eq('user_id', req.userId).eq('platform', platform)
  res.json({ ok: true })
})

export default router
