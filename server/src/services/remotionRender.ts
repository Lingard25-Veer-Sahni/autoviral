import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GeneratedVideoContent } from '../types.js'
import {
  ASPECT_SIZES,
  BRAND,
  type AspectRatio,
  pickVoice,
  synthesizeNarration,
  getAudioDurationSeconds,
  renderVideoThumbnail,
} from './render.js'
import { findStockClip, downloadStockClip } from './stockFootage.js'
import { renderFallbackBackground } from './stockRender.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/src/services/remotionRender.ts -> server/remotion/src/index.ts
const REMOTION_ENTRY = path.resolve(__dirname, '../../remotion/src/index.ts')
// Fixed publicDir the Remotion bundle is built against once and reused for
// every render — per-render assets live in a unique subfolder underneath it
// (see `renderRemotionVideo`) so we never have to re-bundle per video.
const PUBLIC_DIR = path.resolve(__dirname, '../../remotion/public')

const FPS = 30
const COMPOSITION_ID = 'AutoviralVideo'

// Mirrors `RemotionScene`/`RemotionVideoProps` in remotion/src/VideoComposition.tsx.
// Kept as a separate, duplicated type here (rather than importing across the
// server/remotion boundary) since the two are compiled by entirely different
// toolchains — the server via tsc/tsx, the Remotion project via its own
// webpack-based bundler — and only agree on this JSON-serializable shape.
interface RemotionSceneInput {
  narrationFile: string
  durationInFrames: number
  /** How many of `durationInFrames` are actually real speech (excludes the trailing pad
   * added below) -- captions are timed against this, not the padded total, so they finish
   * advancing exactly as the narration audio does instead of lagging into the pause. */
  narrationDurationInFrames: number
  /** Real narration text for this scene -- captions are built from this (chunked + timed
   * to advance with the audio) rather than the short static onScreenText blurb, so the
   * on-screen text actually tracks what's being spoken instead of sitting still for an
   * entire multi-sentence scene. */
  narration: string
  onScreenText: string
  backgroundType: 'video' | 'image'
  backgroundFile: string
}

interface RemotionVideoInputProps {
  scenes: RemotionSceneInput[]
  width: number
  height: number
  fps: number
  brandYellow: string
  // Remotion's `selectComposition`/`renderMedia` type inputProps as
  // `Record<string, unknown>` — this index signature keeps the props object
  // assignable there while still catching typos on the named fields above.
  [key: string]: unknown
}

export interface RenderRemotionVideoInput {
  content: GeneratedVideoContent
  aspectRatio?: AspectRatio
  voiceStyle?: string
  /** A user's own cloned voice (see voiceboxTts.ts) to narrate with instead of the preset voiceStyle chain. */
  voiceProfileId?: string | null
  /**
   * Real (non-simulated) progress hook covering this render function's own
   * work end-to-end: fires with a 0..1 fraction (0-0.6 = per-scene asset
   * prep -- narration synthesis + stock/image sourcing; 0.6-1.0 = Remotion's
   * own native `renderMedia` composite/encode progress) plus a
   * human-readable stage label.
   */
  onProgress?: (fraction: number, label: string) => void | Promise<void>
}

export interface RenderRemotionVideoOutput {
  videoBuffer: Buffer
  thumbnailBuffer: Buffer
  durationSeconds: number
  /** How many scenes actually used real stock footage vs. the Ken Burns fallback background. */
  stockFootageScenes: number
  totalScenes: number
}

// Bundling is the slow part (webpack) — do it once per process and reuse the
// resulting serveUrl for every subsequent render, since PUBLIC_DIR itself
// never changes (only its per-render subfolders do, at render time).
//
// symlinkPublicDir: true is load-bearing, not an optimization. Without it,
// bundle() one-time COPIES publicDir's contents into its build output the
// moment it runs (see @remotion/bundler/dist/bundle.js) instead of
// referencing the live directory. Every render below creates a brand-new
// per-render subfolder under PUBLIC_DIR *after* that copy already happened,
// so its narration/clip files were 100% invisible to the renderer -- every
// single render 404'd on its own assets and silently fell back to the
// ffmpeg "stock" engine. Symlinking instead of copying makes the bundle
// output always see the live directory, so newly written per-render
// subfolders are actually found.
let bundlePromise: Promise<string> | null = null
async function getServeUrl(): Promise<string> {
  // The bundle output lives under the OS temp dir (e.g. macOS's
  // /var/folders/.../T/remotion-webpack-bundle-*), which the OS periodically
  // sweeps on its own schedule -- independent of this process's lifetime.
  // Caching bundlePromise forever (as this used to do) meant that once the OS
  // deleted that directory out from under a long-running `tsx watch` process,
  // every render thereafter would fail with "does not exist" and silently
  // fall through to the ffmpeg fallback engine (no bitrate cap, worse
  // captions) with no way to recover short of a full server restart. Same
  // class of bug as the ensureBucket() caching issue in appwriteStorage.ts --
  // verify the cached result is still actually usable before trusting it.
  if (bundlePromise) {
    try {
      const serveUrl = await bundlePromise
      await stat(path.join(serveUrl, 'index.html'))
      return serveUrl
    } catch {
      // Cached bundle dir vanished (or never resolved) -- fall through and rebuild.
      bundlePromise = null
    }
  }
  bundlePromise = (async () => {
    await mkdir(PUBLIC_DIR, { recursive: true })
    return bundle({ entryPoint: REMOTION_ENTRY, publicDir: PUBLIC_DIR, symlinkPublicDir: true })
  })().catch((err) => {
    // Don't poison future calls with a rejected cached promise — let the next render retry the bundle.
    bundlePromise = null
    throw err
  })
  return bundlePromise
}

/**
 * Real (non-mocked) rendering path built on Remotion instead of raw ffmpeg
 * compositing: proper React-driven animated captions (spring entrance, not
 * a static PNG overlay), a real Ken Burns pan on fallback backgrounds, and
 * the same real TTS narration + real Pexels stock footage as
 * stockRender.ts — just composited by Remotion's headless-Chromium renderer
 * instead of ffmpeg filter graphs.
 */
export async function renderRemotionVideo(input: RenderRemotionVideoInput): Promise<RenderRemotionVideoOutput> {
  const { content } = input
  const { width, height } = ASPECT_SIZES[input.aspectRatio || '9:16']
  const aspectRatio = input.aspectRatio || '9:16'
  const voice = pickVoice(input.voiceStyle)

  // Assets for this render live in their own subfolder of the fixed
  // publicDir so concurrent renders (autopilot + manual generation) never
  // collide, while the Remotion bundle itself is only ever built once.
  const renderId = randomUUID()
  const assetsDir = path.join(PUBLIC_DIR, renderId)
  const outDir = await mkdtemp(path.join(tmpdir(), 'autoviral-remotion-out-'))

  try {
    await mkdir(assetsDir, { recursive: true })

    const scenes: RemotionSceneInput[] = []
    let stockFootageScenes = 0

    for (let i = 0; i < content.script.length; i++) {
      const scene = content.script[i]

      const narrationFile = `narration-${i}.wav`
      await synthesizeNarration(scene.narration, voice, path.join(assetsDir, narrationFile), input.voiceProfileId)
      const audioDuration = await getAudioDurationSeconds(path.join(assetsDir, narrationFile))
      const segmentDuration = Math.max(audioDuration + 0.6, 2)
      const durationInFrames = Math.round(segmentDuration * FPS)
      const narrationDurationInFrames = Math.min(durationInFrames, Math.round(audioDuration * FPS))

      let backgroundType: 'video' | 'image' = 'image'
      let backgroundFile = `bg-${i}.png`

      const clip = await findStockClip(scene.visual_prompt || scene.narration, aspectRatio)

      if (clip) {
        const clipFile = `clip-${i}.mp4`
        try {
          await downloadStockClip(clip.downloadUrl, path.join(assetsDir, clipFile))
          const stats = await stat(path.join(assetsDir, clipFile))
          if (stats.size < 1024) throw new Error('Downloaded clip too small, likely a failed request.')
          backgroundType = 'video'
          backgroundFile = clipFile
          stockFootageScenes++
        } catch (err) {
          console.error(
            `[remotionRender] scene ${i}: stock clip failed, falling back to Ken Burns background:`,
            err instanceof Error ? err.message : err
          )
        }
      }

      if (backgroundType === 'image') {
        await writeFile(path.join(assetsDir, backgroundFile), renderFallbackBackground(scene, width, height))
      }

      scenes.push({
        // staticFile() inside the composition resolves relative to publicDir,
        // so every path here is prefixed with this render's unique subfolder.
        narrationFile: `${renderId}/${narrationFile}`,
        durationInFrames,
        narrationDurationInFrames,
        narration: scene.narration,
        onScreenText: scene.on_screen_text,
        backgroundType,
        backgroundFile: `${renderId}/${backgroundFile}`,
      })

      await input.onProgress?.(
        (0.6 * (i + 1)) / content.script.length,
        `Preparing scene ${i + 1} of ${content.script.length}`
      )
    }

    const inputProps: RemotionVideoInputProps = {
      scenes,
      width,
      height,
      fps: FPS,
      brandYellow: BRAND.yellow,
    }

    const serveUrl = await getServeUrl()

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
    })
    // `composition.durationInFrames` comes from Root.tsx's `calculateMetadata`,
    // which already accounts for the cross-scene transition overlap (adjacent
    // scenes overlap during their crossfade/slide/wipe) — more accurate than
    // summing each scene's narration+padding duration independently.
    const totalDuration = composition.durationInFrames / FPS

    await input.onProgress?.(0.6, 'Compositing final video')

    // Cap video bitrate so the encoded file reliably lands under Appwrite's
    // free-tier 50,000,000-byte-per-file limit (see appwriteStorage.ts) --
    // without this, longer/higher-motion renders could exceed the cap and
    // fall through to the B2/IDrive fallback path, which currently cannot
    // serve public URLs at all (see storage.ts). Target a safe ~38MB budget
    // (leaves headroom under 50MB for container/moov-atom overhead), split
    // between video and the fixed 192kbps audio track, floored at a sane
    // minimum so very long videos don't get encoded into mush.
    const TARGET_FILE_SIZE_BITS = 38 * 1024 * 1024 * 8 // ~38MB budget
    const AUDIO_BITRATE_BPS = 192_000
    const MIN_VIDEO_BITRATE_BPS = 800_000
    const MAX_VIDEO_BITRATE_BPS = 4_000_000
    const safeDuration = Math.max(totalDuration, 1)
    const computedVideoBitrateBps = Math.round(TARGET_FILE_SIZE_BITS / safeDuration - AUDIO_BITRATE_BPS)
    const videoBitrateBps = Math.min(
      MAX_VIDEO_BITRATE_BPS,
      Math.max(MIN_VIDEO_BITRATE_BPS, computedVideoBitrateBps)
    )

    const finalPath = path.join(outDir, 'final.mp4')
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: finalPath,
      inputProps,
      audioBitrate: '192k',
      videoBitrate: `${Math.round(videoBitrateBps / 1000)}K`,
      // Remotion's own native per-frame render/encode progress (0..1) --
      // genuinely reflects headless-Chromium composite work, not simulated.
      onProgress: (p) => {
        void input.onProgress?.(0.6 + 0.4 * p.progress, 'Compositing final video')
      },
    })

    const thumbnailBuffer = await renderVideoThumbnail(finalPath, totalDuration, content.title, width, height)
    const videoBuffer = await readFile(finalPath)

    return {
      videoBuffer,
      thumbnailBuffer,
      durationSeconds: Math.round(totalDuration),
      stockFootageScenes,
      totalScenes: content.script.length,
    }
  } finally {
    await rm(assetsDir, { recursive: true, force: true })
    await rm(outDir, { recursive: true, force: true })
  }
}
