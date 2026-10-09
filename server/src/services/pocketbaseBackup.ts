// Independent, best-effort backup copy of every uploaded video file to a
// self-hosted PocketBase instance -- deliberately NOT part of the
// primary/fallback storage chain in storage.ts (Filebase/B2/R2 -> Appwrite ->
// Supabase). This is an *extra* safety copy: if it fails, the real upload
// that the user actually needs (the one whose URL gets stored on the video
// row) has already succeeded, so we only log a warning here and never throw.
//
// Requires a PocketBase instance reachable at POCKETBASE_URL with a
// "video_backups" collection containing a required "path" text field and a
// required "file" file field (see server/POCKETBASE_SETUP.md or just ask the
// human running this -- it was created once via the admin API).
const POCKETBASE_URL = process.env.POCKETBASE_URL?.trim()?.replace(/\/$/, '')
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL?.trim()
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD?.trim()
const COLLECTION = process.env.POCKETBASE_COLLECTION?.trim() || 'video_backups'

export const pocketbaseConfigured = Boolean(POCKETBASE_URL && ADMIN_EMAIL && ADMIN_PASSWORD)

let cachedToken: string | null = null

async function authenticate(): Promise<string> {
  const res = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (!res.ok) {
    throw new Error(`PocketBase auth failed: ${res.status} ${await res.text().catch(() => '')}`)
  }
  const json = (await res.json()) as { token: string }
  cachedToken = json.token
  return json.token
}

async function uploadRecord(path: string, data: Buffer, contentType: string, token: string): Promise<Response> {
  const form = new FormData()
  form.append('path', path)
  form.append(
    'file',
    new Blob([new Uint8Array(data)], { type: contentType }),
    path.split('/').pop() || 'video.mp4'
  )
  return fetch(`${POCKETBASE_URL}/api/collections/${COLLECTION}/records`, {
    method: 'POST',
    headers: { Authorization: token },
    body: form,
  })
}

/**
 * Fire-and-forget: uploads a copy of the file to the local PocketBase
 * instance for redundancy. Never throws -- logs and swallows any failure
 * (auth issues, PocketBase being down, network errors) since this is purely
 * an extra safety net, not something that should ever block or fail a video.
 */
export function backupToPocketBase(path: string, data: Buffer, contentType: string): void {
  if (!pocketbaseConfigured) return

  void (async () => {
    try {
      let token = cachedToken ?? (await authenticate())
      let res = await uploadRecord(path, data, contentType, token)
      if (res.status === 401 || res.status === 403) {
        // Cached token expired/invalid -- re-authenticate once and retry.
        token = await authenticate()
        res = await uploadRecord(path, data, contentType, token)
      }
      if (!res.ok) {
        console.warn(`[pocketbase-backup] failed to back up ${path}: ${res.status} ${await res.text().catch(() => '')}`)
      }
    } catch (err) {
      console.warn(`[pocketbase-backup] failed to back up ${path}:`, err instanceof Error ? err.message : err)
    }
  })()
}
