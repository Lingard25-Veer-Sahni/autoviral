import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// Backblaze B2's S3-compatible API, used as a drop-in replacement for
// Supabase Storage specifically for video files. Why: Supabase enforces a
// project-wide per-object size cap that can't be raised without upgrading to
// a paid plan, and rendered videos for the longer duration presets (5-10m,
// 10-30m, and sometimes even 3-5m) routinely exceed it -- the upload step
// then fails after all the real AI + render work already happened. B2's free
// tier (10GB storage, no small per-object cap, no credit card required)
// comfortably fits full-length renders. See services/storage.ts for the
// routing logic between B2 and Supabase Storage.
// Despite the "B2" naming (this started as a Backblaze-only integration),
// this is a generic S3-compatible uploader, it also works unmodified with
// Cloudflare R2 or any other S3-compatible provider, since they all speak
// the same PutObject API. Only the env var names stayed B2-flavored.

interface B2Config {
  configured: boolean
  client: S3Client | null
  bucketName: string | undefined
  publicUrlBase: string | undefined
  endpoint: string | undefined
  isFilebase: boolean
}

/**
 * Builds a config/client from a given env var prefix ("B2" for the main
 * shared account, "B2_ADMIN" for an optional second, fully separate
 * account). Two independent accounts means two independent free-tier quotas
 * -- admin's uploads never eat into (or get throttled/billed alongside)
 * paying users' storage, mirroring the same isolation pattern used for
 * OPENROUTER_ADMIN_API_KEY in aiOpenAICompatible.ts.
 */
function buildConfig(prefix: 'B2' | 'B2_ADMIN'): B2Config {
  const ENDPOINT = process.env[`${prefix}_ENDPOINT`]?.trim() // e.g. "s3.us-west-004.backblazeb2.com" or "<account>.r2.cloudflarestorage.com"
  const KEY_ID = process.env[`${prefix}_KEY_ID`]?.trim()
  const APPLICATION_KEY = process.env[`${prefix}_APPLICATION_KEY`]?.trim()
  const BUCKET_NAME = process.env[`${prefix}_BUCKET_NAME`]?.trim()
  // Optional override for the public URL base a browser/YouTube can
  // actually fetch from, needed for R2, where the S3 endpoint itself isn't
  // public (R2 public access is a separate r2.dev subdomain or custom domain,
  // not "<bucket>.<endpoint>" like B2). Leave unset for B2, which does resolve
  // via that pattern. e.g. "https://pub-xxxxxxxx.r2.dev".
  const PUBLIC_URL_BASE = process.env[`${prefix}_PUBLIC_URL_BASE`]?.trim()?.replace(/\/$/, '')

  const configured = Boolean(ENDPOINT && KEY_ID && APPLICATION_KEY && BUCKET_NAME)

  // The AWS SDK wants a bare region string separately from the endpoint host.
  // B2's S3-compatible endpoint embeds it (e.g. "s3.us-west-004.backblazeb2.com"
  // -> "us-west-004"); R2 doesn't use real regions at all and always wants the
  // literal string "auto".
  const isFilebase = Boolean(ENDPOINT?.includes('filebase'))

  const region = ENDPOINT?.includes('r2.cloudflarestorage.com') || isFilebase
    ? 'auto'
    : ENDPOINT?.match(/^s3\.([^.]+)\.backblazeb2\.com$/)?.[1] ||
      ENDPOINT?.match(/^s3\.([^.]+)\.idrivee2\.com$/)?.[1] ||
      'us-west-004'

  const client = configured
    ? new S3Client({
        endpoint: `https://${ENDPOINT}`,
        region,
        credentials: { accessKeyId: KEY_ID!, secretAccessKey: APPLICATION_KEY! },
      })
    : null

  return { configured, client, bucketName: BUCKET_NAME, publicUrlBase: PUBLIC_URL_BASE, endpoint: ENDPOINT, isFilebase }
}

const main = buildConfig('B2')
const admin = buildConfig('B2_ADMIN')

export const b2Configured = main.configured
// Whether a dedicated, isolated admin storage account (B2_ADMIN_*) is set up.
// Does NOT fall back to true just because the main account is configured --
// callers that care about genuine isolation (see uploadToB2 below) check this
// separately so they can tell the difference between "admin has its own free
// account" and "admin is silently sharing the paying users' bucket/quota".
export const b2AdminConfigured = admin.configured

/**
 * Uploads a buffer to the (public) B2 bucket and returns a plain public URL
 * -- callers use this exactly like Supabase Storage's getPublicUrl result
 * (embedded in <video> tags, downloaded, and handed to the YouTube
 * posting API). The bucket must be created with "Public" visibility in the
 * B2 dashboard for this URL to resolve without a signed request.
 *
 * When `isAdmin` is true and a dedicated B2_ADMIN_* account is configured,
 * uploads go there instead of the shared main bucket -- a fully separate
 * account means a fully separate free-tier quota, so admin's video storage
 * never eats into (or risks exhausting) paying users' storage headroom.
 * Falls back to the main account if no dedicated admin account is set up.
 */
export async function uploadToB2(path: string, data: Buffer, contentType: string, isAdmin?: boolean): Promise<string> {
  const config = isAdmin && admin.configured ? admin : main
  const { client, bucketName, publicUrlBase, endpoint, isFilebase } = config

  if (!client || !bucketName) {
    throw new Error(
      'Backblaze B2 is not configured (set B2_ENDPOINT / B2_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_NAME in server/.env).'
    )
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: data,
      ContentType: contentType,
    })
  )

  // Filebase is backed by IPFS under the hood -- the object isn't served from
  // "bucket.endpoint/path" like B2/R2. Instead, after upload, Filebase stamps
  // the resulting content's IPFS CID onto the object as an "x-amz-meta-cid"
  // header, retrievable via HeadObject, and public reads go through their
  // IPFS gateway keyed by that CID rather than the bucket/path.
  if (isFilebase) {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: path }))
    const cid = head.Metadata?.cid
    if (!cid) {
      throw new Error(`Filebase upload for ${path} did not return an IPFS CID (check Metadata.cid on the HeadObject response).`)
    }
    return `https://ipfs.filebase.io/ipfs/${cid}`
  }

  return publicUrlBase ? `${publicUrlBase}/${path}` : `https://${bucketName}.${endpoint}/${path}`
}
