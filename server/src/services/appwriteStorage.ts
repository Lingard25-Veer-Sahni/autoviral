import { Client, Storage, ID, Permission, Role } from 'node-appwrite'
import { InputFile } from 'node-appwrite/file'

// Automatic fallback for video uploads if the primary provider (Filebase/B2,
// see b2Storage.ts) throws -- e.g. quota exhausted, outage, transient network
// error. See storage.ts for the try/catch chain that decides when this gets
// used. Appwrite's free Cloud tier is currently 2GB storage, no credit card
// required.
const ENDPOINT = process.env.APPWRITE_ENDPOINT?.trim() // e.g. "https://fra.cloud.appwrite.io/v1"
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID?.trim()
const API_KEY = process.env.APPWRITE_API_KEY?.trim()
// A single bucket reused for every upload -- created on first use if it
// doesn't exist yet (see ensureBucket below).
const BUCKET_ID = (process.env.APPWRITE_BUCKET_ID?.trim() || 'autoviral-videos').replace(/[^a-zA-Z0-9._-]/g, '-')

export const appwriteConfigured = Boolean(ENDPOINT && PROJECT_ID && API_KEY)

const client = appwriteConfigured
  ? new Client().setEndpoint(ENDPOINT!).setProject(PROJECT_ID!).setKey(API_KEY!)
  : null

const storage = client ? new Storage(client) : null

let bucketReady: Promise<void> | null = null

// Appwrite buckets need to exist before you can upload into them (unlike
// S3-style providers, which happily take a bucket name as just a string on
// PutObject). Create it lazily, once, the first time an upload happens --
// idempotent, since Appwrite errors with 409 if it already exists and we
// just swallow that specific case.
//
// IMPORTANT: bucketReady must only ever be cached on *success*. Caching a
// failed attempt (e.g. a transient race against another process also trying
// to create the same bucket, or a quota hiccup) would otherwise poison every
// upload for the rest of this process's lifetime, since every call after the
// first would just re-await the same permanently-rejected promise instead of
// getting a fresh chance to notice the bucket now exists. Confirmed as a real
// bug in production: one bad first attempt broke Appwrite uploads process-wide
// until the next restart, even though the bucket existed and worked fine.
async function ensureBucket(): Promise<void> {
  if (!storage) return
  if (bucketReady) {
    await bucketReady
    return
  }
  const attempt = (async () => {
    // Check first rather than racing straight into createBucket -- avoids
    // manufacturing spurious errors when the bucket already exists (e.g.
    // created by another process) and sidesteps provider-specific quirks in
    // how concurrent create-if-missing races get reported.
    try {
      await storage!.getBucket({ bucketId: BUCKET_ID })
      return
    } catch {
      // Not found (or transient lookup failure) -- fall through to create.
    }
    try {
      await storage!.createBucket({
        bucketId: BUCKET_ID,
        name: BUCKET_ID,
        // Public read so the resulting file URL works directly in <video>
        // tags and when handed to the YouTube/Instagram posting APIs,
        // mirroring how the B2/Filebase/R2 buckets are configured public.
        permissions: [Permission.read(Role.any())],
        fileSecurity: false,
        // Appwrite's documented ceiling is 5GB, but free/Cloud-tier projects
        // reject anything above 50,000,000 bytes (~47.7MB) with a 400 on
        // bucket creation -- discovered via a live smoke test against this
        // project. Use the largest value the free tier actually accepts;
        // upgrading the Appwrite plan later would allow raising this.
        maximumFileSize: 50_000_000,
      })
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code
      if (code !== 409) throw err // 409 = bucket already exists, fine
    }
  })()

  try {
    await attempt
    bucketReady = Promise.resolve() // only cache once we know it actually succeeded
  } catch (err) {
    bucketReady = null // let the next call retry from scratch instead of reusing this failure
    throw err
  }
}

/**
 * Uploads a buffer to Appwrite Storage and returns a plain public URL --
 * same contract as uploadToB2 (see b2Storage.ts), so storage.ts can swap
 * between them transparently as a fallback chain.
 */
export async function uploadToAppwrite(path: string, data: Buffer, contentType: string): Promise<string> {
  if (!storage || !ENDPOINT || !PROJECT_ID) {
    throw new Error(
      'Appwrite is not configured (set APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY in server/.env).'
    )
  }
  await ensureBucket()

  // Appwrite file IDs are restricted to a-z, A-Z, 0-9, period, hyphen,
  // underscore, max 36 chars, and can't start with a special char -- unlike
  // the "userId/videoId.mp4"-style paths used elsewhere in this codebase.
  // Derive a safe, still-unique-enough id instead of using the raw path.
  const safeId = path.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-36).replace(/^[.\-_]+/, '')
  const fileId = safeId || ID.unique()

  const file = InputFile.fromBuffer(data, path.split('/').pop() || fileId)

  const created = await storage.createFile({
    bucketId: BUCKET_ID,
    fileId,
    file,
    permissions: [Permission.read(Role.any())],
  })

  return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${created.$id}/view?project=${PROJECT_ID}`
}

// Matches the `.../storage/buckets/<bucketId>/files/<fileId>/view?project=...`
// shape returned by uploadToAppwrite above -- used to recover the fileId from
// a stored video_url/thumbnail_url so storage cleanup (see storage.ts) can
// delete the underlying file without having to separately persist the id.
const APPWRITE_FILE_URL_RE = /\/storage\/buckets\/([^/]+)\/files\/([^/]+)\/view/

export function isAppwriteUrl(url: string): boolean {
  return APPWRITE_FILE_URL_RE.test(url)
}

/**
 * Best-effort delete of a previously-uploaded Appwrite file, given the public
 * URL returned by uploadToAppwrite. Used by the storage-cleanup feature
 * (videoPipeline.ts) to actually free bucket space when pruning old videos --
 * never throws, since a failed cleanup delete shouldn't block the DB row
 * deletion or the user-facing notification.
 */
export async function deleteFromAppwrite(url: string): Promise<void> {
  if (!storage) return
  const match = url.match(APPWRITE_FILE_URL_RE)
  if (!match) return
  const [, bucketId, fileId] = match
  try {
    await storage.deleteFile({ bucketId, fileId })
  } catch (err) {
    console.warn(`[appwriteStorage] failed to delete file ${fileId} in bucket ${bucketId}:`, err instanceof Error ? err.message : err)
  }
}
