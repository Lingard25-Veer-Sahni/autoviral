import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import 'dotenv/config'

// OAuth access/refresh tokens are encrypted at rest in `social_accounts` using
// AES-256-GCM, keyed off TOKEN_ENCRYPTION_KEY (any long random string in .env).
// We hash the raw env value down to a 32-byte key so any length secret works.
const rawKey = process.env.TOKEN_ENCRYPTION_KEY || 'insecure-dev-only-key-change-me'
const key = createHash('sha256').update(rawKey).digest()

const ALGO = 'aes-256-gcm'

/** Encrypts a plaintext token, returning a single self-contained string: iv.authTag.ciphertext (all base64url). */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

/** Decrypts a string produced by encryptToken(). Returns null if malformed or the key doesn't match. */
export function decryptToken(payload: string | null | undefined): string | null {
  if (!payload) return null
  const parts = payload.split('.')
  if (parts.length !== 3) return null
  try {
    const [ivB64, tagB64, dataB64] = parts
    const iv = Buffer.from(ivB64, 'base64url')
    const authTag = Buffer.from(tagB64, 'base64url')
    const data = Buffer.from(dataB64, 'base64url')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}
