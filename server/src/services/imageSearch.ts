import axios from 'axios'
import { searchPixabayImages } from './pixabay.js'

// Real Pexels Photos search (distinct from stockFootage.ts, which only hits
// Pexels' *video* search endpoint), backs the thumbnail image search
// dropdown. Same free API key (PEXELS_API_KEY), different base path.
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''

export const imageSearchConfigured = Boolean(PEXELS_API_KEY)

const pexelsPhotoClient = axios.create({
  baseURL: 'https://api.pexels.com/v1',
  headers: PEXELS_API_KEY ? { Authorization: PEXELS_API_KEY } : {},
  timeout: 20_000,
})

interface PexelsPhotoSrc {
  original: string
  large2x: string
  large: string
  medium: string
  small: string
  tiny: string
}

interface PexelsPhoto {
  id: number
  width: number
  height: number
  photographer: string
  src: PexelsPhotoSrc
  alt: string | null
}

interface PexelsPhotoSearchResponse {
  photos: PexelsPhoto[]
}

export interface ImageSearchResult {
  /** Source-prefixed (e.g. "pexels-123") so IDs from merged providers never collide. */
  id: string
  width: number
  height: number
  photographer: string
  alt: string
  /** Small preview for the search-result grid. */
  thumbnailUrl: string
  /** Larger resolution actually downloaded server-side and composited into the render. */
  fullUrl: string
}

async function searchPexelsImages(query: string, perPage: number): Promise<ImageSearchResult[]> {
  if (!imageSearchConfigured) return []
  try {
    const { data } = await pexelsPhotoClient.get<PexelsPhotoSearchResponse>('/search', {
      params: { query, per_page: Math.min(Math.max(perPage, 1), 24) },
    })

    return (data.photos || []).map((photo) => ({
      id: `pexels-${photo.id}`,
      width: photo.width,
      height: photo.height,
      photographer: photo.photographer,
      alt: photo.alt || query,
      thumbnailUrl: photo.src.medium,
      fullUrl: photo.src.large2x || photo.src.large || photo.src.original,
    }))
  } catch (err) {
    console.error(`[imageSearch] Pexels search failed for "${query}":`, err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Searches Pexels' and Pixabay's free stock photo libraries and merges the
 * results (Pexels first, then Pixabay), two independent free sources give
 * meaningfully more variety per query than either alone. Never throws, a
 * key missing or an API error on one source just means fewer merged
 * results, not a hard failure.
 */
export async function searchImages(query: string, perPage = 16): Promise<ImageSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const [pexelsResults, pixabayResults] = await Promise.all([
    searchPexelsImages(trimmed, perPage),
    searchPixabayImages(trimmed, perPage),
  ])

  return [...pexelsResults, ...pixabayResults]
}

/** Downloads an arbitrary image URL into an in-memory buffer, with its content-type. */
export async function downloadImageBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 20_000 })
  const contentType = typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : 'image/jpeg'
  return { buffer: Buffer.from(res.data), mimeType: contentType.split(';')[0].trim() || 'image/jpeg' }
}
