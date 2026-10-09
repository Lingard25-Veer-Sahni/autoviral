import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import 'dotenv/config'

// The OAuth callback endpoints are hit directly by Google/Meta's redirect (no
// Authorization header available), so we thread the authenticated user's id
// through the `state` query param. To stop that from being forged/tampered
// with, state is HMAC-signed and includes an expiry.
const secret = process.env.TOKEN_ENCRYPTION_KEY || 'insecure-dev-only-key-change-me'
const MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes to complete the OAuth dance

export interface OAuthStatePayload {
  userId: string
  platform: 'youtube' | 'instagram'
}

function sign(data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

export function createOAuthState(payload: OAuthStatePayload): string {
  const body = JSON.stringify({ ...payload, ts: Date.now(), nonce: randomBytes(6).toString('hex') })
  const bodyB64 = Buffer.from(body, 'utf8').toString('base64url')
  const signature = sign(bodyB64)
  return `${bodyB64}.${signature}`
}

export function verifyOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null
  const [bodyB64, signature] = state.split('.')
  if (!bodyB64 || !signature) return null

  const expected = sign(bodyB64)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const body = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'))
    if (Date.now() - body.ts > MAX_AGE_MS) return null
    if (!body.userId || !body.platform) return null
    return { userId: body.userId, platform: body.platform }
  } catch {
    return null
  }
}
