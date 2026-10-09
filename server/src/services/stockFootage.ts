import axios from 'axios'
import type { AspectRatio } from './render.js'
import { findPixabayClip } from './pixabay.js'

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''

export const pexelsConfigured = Boolean(PEXELS_API_KEY)

const pexelsClient = axios.create({
  baseURL: 'https://api.pexels.com/videos',
  headers: PEXELS_API_KEY ? { Authorization: PEXELS_API_KEY } : {},
  timeout: 20_000,
})

interface PexelsVideoFile {
  id: number
  quality: string // 'hd' | 'sd' | 'hls'
  file_type: string
  width: number | null
  height: number | null
  link: string
}

interface PexelsVideo {
  id: number
  width: number
  height: number
  duration: number
  video_files: PexelsVideoFile[]
}

interface PexelsSearchResponse {
  videos: PexelsVideo[]
}

// Orientation Pexels expects for its search filter, derived from our aspect ratio.
function orientationFor(aspectRatio: AspectRatio): 'portrait' | 'landscape' | 'square' {
  if (aspectRatio === '9:16') return 'portrait'
  if (aspectRatio === '16:9') return 'landscape'
  return 'square'
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'with', 'is', 'are',
  'this', 'that', 'it', 'as', 'by', 'be', 'shows', 'showing', 'show', 'scene', 'shot', 'close',
  'up', 'wide', 'view', 'camera', 'footage', 'video', 'over', 'while', 'their', 'his', 'her',
])

/** Turns a scene's rich `visual_prompt` into a short, high-signal Pexels search query. */
export function buildSearchQuery(visualPrompt: string): string {
  const words = visualPrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

  // Keep it short — Pexels' relevance ranking degrades with long, sentence-like queries.
  const keywords = words.slice(0, 5)
  return keywords.length ? keywords.join(' ') : 'abstract background'
}

/** Picks the best-matching video file for our target aspect ratio (prefers HD, closest orientation). */
function pickBestFile(video: PexelsVideo, aspectRatio: AspectRatio): PexelsVideoFile | null {
  const mp4Files = video.video_files.filter((f) => f.file_type === 'video/mp4' && f.width && f.height)
  if (!mp4Files.length) return null

  const targetRatio = aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '16:9' ? 16 / 9 : 1

  const scored = mp4Files.map((f) => {
    const ratio = (f.width || 1) / (f.height || 1)
    const ratioDiff = Math.abs(ratio - targetRatio)
    // Prefer HD quality, then closest orientation match, then larger resolution (sharper source).
    const qualityScore = f.quality === 'hd' ? 0 : f.quality === 'sd' ? 1 : 2
    const resScore = -(f.width || 0)
    return { file: f, ratioDiff, qualityScore, resScore }
  })

  scored.sort((a, b) => a.ratioDiff - b.ratioDiff || a.qualityScore - b.qualityScore || a.resScore - b.resScore)
  return scored[0]?.file || null
}

export interface StockClip {
  downloadUrl: string
  width: number
  height: number
  durationSeconds: number
}

async function findPexelsClip(query: string, aspectRatio: AspectRatio): Promise<StockClip | null> {
  if (!pexelsConfigured) return null
  try {
    const { data } = await pexelsClient.get<PexelsSearchResponse>('/search', {
      params: {
        query,
        orientation: orientationFor(aspectRatio),
        size: 'medium',
        per_page: 8,
      },
    })

    for (const video of data.videos || []) {
      const file = pickBestFile(video, aspectRatio)
      if (file) {
        return { downloadUrl: file.link, width: file.width || video.width, height: file.height || video.height, durationSeconds: video.duration }
      }
    }
    return null
  } catch (err) {
    console.error(`[stockFootage] Pexels search failed for "${query}":`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Searches Pexels' free stock video library for a clip matching the scene's
 * visual_prompt, falling back to Pixabay's free video library (a second,
 * independent source) on a miss — widens real-result coverage per query
 * rather than relying on a single provider. Returns null (never throws) if
 * both come up empty/unconfigured, so the caller can fall back to the
 * branded canvas background.
 */
export async function findStockClip(visualPrompt: string, aspectRatio: AspectRatio): Promise<StockClip | null> {
  const query = buildSearchQuery(visualPrompt)

  const pexelsResult = await findPexelsClip(query, aspectRatio)
  if (pexelsResult) return pexelsResult

  return findPixabayClip(query, aspectRatio)
}

/** Downloads a stock clip to a local file (streamed, no full-buffer memory spike). */
export async function downloadStockClip(url: string, destPath: string): Promise<void> {
  const res = await axios.get<NodeJS.ReadableStream>(url, { responseType: 'stream', timeout: 30_000 })
  const { createWriteStream } = await import('node:fs')
  const { pipeline } = await import('node:stream/promises')
  await pipeline(res.data, createWriteStream(destPath))
}
