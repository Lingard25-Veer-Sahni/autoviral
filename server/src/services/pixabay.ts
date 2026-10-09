import axios from 'axios'
import type { AspectRatio } from './render.js'

// Real Pixabay search — a second, fully-free stock media source layered
// alongside Pexels (imageSearch.ts / stockFootage.ts) purely to widen the
// pool of real results per query, since Pexels alone sometimes has thin
// coverage for a given keyword. Optional: no key means these functions
// just return empty/null and callers silently keep using Pexels only.
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || ''

export const pixabayConfigured = Boolean(PIXABAY_API_KEY)

const pixabayClient = axios.create({
  baseURL: 'https://pixabay.com/api',
  timeout: 20_000,
})

interface PixabayImageHit {
  id: number
  webformatURL: string
  webformatWidth: number
  webformatHeight: number
  largeImageURL: string
  imageWidth: number
  imageHeight: number
  user: string
  tags: string
}

interface PixabayImageSearchResponse {
  hits: PixabayImageHit[]
}

export interface PixabayImageResult {
  /** Source-prefixed (e.g. "pixabay-123") so IDs never collide when merged with other providers. */
  id: string
  width: number
  height: number
  photographer: string
  alt: string
  thumbnailUrl: string
  fullUrl: string
}

/** Searches Pixabay's free photo library. Returns [] (never throws) on no key / no match / any API error. */
export async function searchPixabayImages(query: string, perPage = 16): Promise<PixabayImageResult[]> {
  if (!pixabayConfigured) return []
  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    const { data } = await pixabayClient.get<PixabayImageSearchResponse>('/', {
      params: {
        key: PIXABAY_API_KEY,
        q: trimmed,
        image_type: 'photo',
        safesearch: true,
        per_page: Math.min(Math.max(perPage, 3), 50),
      },
    })

    return (data.hits || []).map((hit) => ({
      id: `pixabay-${hit.id}`,
      width: hit.imageWidth,
      height: hit.imageHeight,
      photographer: hit.user,
      alt: hit.tags || trimmed,
      thumbnailUrl: hit.webformatURL,
      fullUrl: hit.largeImageURL || hit.webformatURL,
    }))
  } catch (err) {
    console.error(`[pixabay] image search failed for "${trimmed}":`, err instanceof Error ? err.message : err)
    return []
  }
}

interface PixabayVideoRendition {
  url: string
  width: number
  height: number
}

interface PixabayVideoHit {
  id: number
  duration: number
  videos: {
    large: PixabayVideoRendition
    medium: PixabayVideoRendition
    small: PixabayVideoRendition
    tiny: PixabayVideoRendition
  }
}

interface PixabayVideoSearchResponse {
  hits: PixabayVideoHit[]
}

export interface PixabayClip {
  downloadUrl: string
  width: number
  height: number
  durationSeconds: number
}

/** Picks the rendition closest to the target aspect ratio, preferring higher resolution. */
function pickBestRendition(hit: PixabayVideoHit, aspectRatio: AspectRatio): PixabayVideoRendition | null {
  const targetRatio = aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '16:9' ? 16 / 9 : 1
  const candidates = [hit.videos.large, hit.videos.medium, hit.videos.small, hit.videos.tiny].filter(
    (r) => r && r.url && r.width && r.height
  )
  if (!candidates.length) return null

  candidates.sort((a, b) => {
    const diffA = Math.abs(a.width / a.height - targetRatio)
    const diffB = Math.abs(b.width / b.height - targetRatio)
    if (diffA !== diffB) return diffA - diffB
    return b.width - a.width
  })
  return candidates[0]
}

/** Searches Pixabay's free stock video library. Returns null (never throws) on no-match/no-key/any error. */
export async function findPixabayClip(query: string, aspectRatio: AspectRatio): Promise<PixabayClip | null> {
  if (!pixabayConfigured) return null
  const trimmed = query.trim()
  if (!trimmed) return null

  try {
    const { data } = await pixabayClient.get<PixabayVideoSearchResponse>('/videos/', {
      params: { key: PIXABAY_API_KEY, q: trimmed, safesearch: true, per_page: 8 },
    })

    for (const hit of data.hits || []) {
      const rendition = pickBestRendition(hit, aspectRatio)
      if (rendition) {
        return { downloadUrl: rendition.url, width: rendition.width, height: rendition.height, durationSeconds: hit.duration }
      }
    }
    return null
  } catch (err) {
    console.error(`[pixabay] video search failed for "${trimmed}":`, err instanceof Error ? err.message : err)
    return null
  }
}
