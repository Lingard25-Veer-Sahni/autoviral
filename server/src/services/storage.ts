import { supabaseAdmin } from '../supabaseAdmin.js'
import { uploadToB2, b2Configured } from './b2Storage.js'
import { uploadToAppwrite, appwriteConfigured, deleteFromAppwrite, isAppwriteUrl } from './appwriteStorage.js'
import { backupToPocketBase } from './pocketbaseBackup.js'

export type StorageBucket = 'videos' | 'thumbnails'

/**
 * Uploads a buffer and returns its public URL.
 *
 * Thumbnails always go to Supabase Storage (both buckets are public-read,
 * see supabase/migrations/0001_init.sql) -- they're small PNGs, comfortably
 * under Supabase's default per-object size cap.
 *
 * Videos go to Cloudflare R2 first when configured -- via the generic
 * S3-compatible uploader in b2Storage.ts (despite the "B2" naming, it's a
 * plain S3 client that works unmodified with R2). R2 is genuinely pay-per-use
 * past its free 10GB/month tier, has zero egress fees, and -- unlike the
 * providers below -- isn't currently locked out by a billing-quota violation.
 * If that upload throws for any reason (quota exhausted, outage, transient
 * network error), falls back to Appwrite Storage, then Supabase Storage.
 *
 * HISTORICAL NOTE: Appwrite used to be primary here (free Cloud tier with
 * real public-read permissions, no card required) because every S3-compatible
 * provider tried before R2 (Backblaze B2, Filebase, IDrive e2) required a card
 * or paid upgrade for a plain public URL. Both Appwrite and Supabase Storage
 * have since hit `exceed_storage_size_quota` 402 lockouts project-wide, so
 * they're now kept only as last-resort fallbacks behind R2.
 *
 * Independently of all of the above, every successful video upload also
 * fires a best-effort, non-blocking copy to a self-hosted PocketBase
 * instance (see pocketbaseBackup.ts) -- a second, completely independent
 * backup that doesn't share infrastructure with any of the providers above.
 * Failure there is logged only; it never affects the returned URL or throws.
 */
export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  if (bucket === 'videos' && b2Configured) {
    try {
      const url = await uploadToB2(path, data, contentType)
      backupToPocketBase(path, data, contentType)
      return url
    } catch (err) {
      console.warn(
        `[storage] primary video upload (R2) failed for ${path}, falling back to Appwrite/Supabase:`,
        err instanceof Error ? err.message : err
      )
    }
  }
  if (bucket === 'videos' && appwriteConfigured) {
    try {
      const url = await uploadToAppwrite(path, data, contentType)
      backupToPocketBase(path, data, contentType)
      return url
    } catch (err) {
      console.warn(
        `[storage] fallback video upload (Appwrite) failed for ${path}, falling back to Supabase Storage:`,
        err instanceof Error ? err.message : err
      )
      return uploadToSupabaseStorage(bucket, path, data, contentType)
    }
  }

  return uploadToSupabaseStorage(bucket, path, data, contentType)
}

async function uploadToSupabaseStorage(
  bucket: StorageBucket,
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) {
    throw new Error(`Failed to upload to ${bucket}/${path}: ${error.message}`)
  }

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
  if (bucket === 'videos') backupToPocketBase(path, data, contentType)
  return pub.publicUrl
}

/**
 * Best-effort delete of a previously-uploaded file, given its stored public
 * URL. Used by the automatic storage-cleanup feature in videoPipeline.ts
 * (see maybeRunStorageCleanup) to actually free bucket space when pruning a
 * user's oldest videos -- never throws, since we still want the DB row
 * deleted and the user notified even if the underlying file is already gone
 * or belongs to a provider we can't reverse-engineer a delete call for
 * (e.g. old Supabase Storage / B2 / IDrive URLs from before Appwrite became
 * primary -- those are skipped rather than guessed at).
 */
export async function deleteFromStorage(url: string | null | undefined): Promise<void> {
  if (!url) return
  try {
    if (isAppwriteUrl(url)) {
      await deleteFromAppwrite(url)
      return
    }
    // Supabase Storage URLs are the one other pattern we can reliably parse
    // and act on (public URL always contains "/storage/v1/object/public/<bucket>/<path>").
    const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (supabaseMatch) {
      const [, bucket, path] = supabaseMatch
      await supabaseAdmin.storage.from(bucket).remove([decodeURIComponent(path)])
      return
    }
    // Anything else (old B2/IDrive/Filebase URLs) -- no reliable, reversible
    // delete path for those providers today; leave it and move on.
  } catch (err) {
    console.warn(`[storage] cleanup delete failed for ${url}:`, err instanceof Error ? err.message : err)
  }
}
