import { createCanvas } from '@napi-rs/canvas'
import { mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { GeneratedVideoContent, VideoScriptScene } from '../types.js'
import {
  ASPECT_SIZES,
  BRAND,
  type AspectRatio,
  pickVoice,
  wrapText,
  drawBrandFooter,
  hashString,
  synthesizeNarration,
  getAudioDurationSeconds,
  runFfmpeg,
  renderVideoThumbnail,
} from './render.js'
import { findStockClip, downloadStockClip } from './stockFootage.js'

/**
 * Renders a transparent PNG caption overlay (bottom-anchored dark bar + bold
 * white caption + brand accent + watermark). Composited on top of real stock
 * footage via ffmpeg, instead of being the entire frame like the canvas-only
 * fallback renderer.
 */
function renderCaptionOverlay(scene: VideoScriptScene, width: number, height: number): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  // Fully transparent canvas, only the caption bar + text get painted.
  ctx.clearRect(0, 0, width, height)

  const maxWidth = width * 0.86
  let fontSize = Math.round(width * 0.062)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let lines: string[] = []
  do {
    ctx.font = `800 ${fontSize}px "Arial Black", "Arial", sans-serif`
    lines = wrapText(ctx, scene.on_screen_text.toUpperCase(), maxWidth)
    if (lines.length <= 3) break
    fontSize -= 3
  } while (fontSize > 26)

  const lineHeight = fontSize * 1.25
  const padding = height * 0.045
  const blockHeight = lines.length * lineHeight + padding * 2
  const barTop = height - blockHeight - height * 0.09

  // Semi-transparent dark bar so captions stay legible over any footage.
  const bar = ctx.createLinearGradient(0, barTop, 0, barTop + blockHeight)
  bar.addColorStop(0, 'rgba(10, 10, 10, 0)')
  bar.addColorStop(0.25, 'rgba(10, 10, 10, 0.72)')
  bar.addColorStop(1, 'rgba(10, 10, 10, 0.72)')
  ctx.fillStyle = bar
  ctx.fillRect(0, barTop, width, blockHeight)

  // Yellow accent rule at the top of the caption block.
  ctx.fillStyle = BRAND.yellow
  ctx.fillRect(width / 2 - 50, barTop + 10, 100, 6)

  const startY = barTop + padding + lineHeight / 2 + 16
  lines.forEach((line, i) => {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 14
    ctx.fillStyle = BRAND.white
    ctx.fillText(line, width / 2, startY + i * lineHeight)
    ctx.shadowBlur = 0
  })

  drawBrandFooter(ctx, width, height)

  return canvas.encodeSync('png')
}

/** Fallback: a static branded background (same visual language as the legacy canvas engine) used only when no stock clip is found for a scene. */
export function renderFallbackBackground(scene: VideoScriptScene, width: number, height: number): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const seed = hashString(scene.visual_prompt || scene.narration)

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, BRAND.black)
  bg.addColorStop(1, BRAND.charcoal)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const glowX = width * (0.2 + 0.6 * ((seed % 100) / 100))
  const glowY = height * (0.15 + 0.5 * (((seed >> 3) % 100) / 100))
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(width, height) * 0.6)
  glow.addColorStop(0, 'rgba(245, 196, 0, 0.3)')
  glow.addColorStop(1, 'rgba(245, 196, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  return canvas.encodeSync('png')
}

export interface RenderStockVideoInput {
  content: GeneratedVideoContent
  aspectRatio?: AspectRatio
  voiceStyle?: string
  /** A user's own cloned voice (see voiceboxTts.ts) to narrate with instead of the preset voiceStyle chain. */
  voiceProfileId?: string | null
  /**
   * Real (non-simulated) per-scene progress hook: called with a 0..1
   * fraction of this render function's own work, plus a human-readable
   * stage label, right after each scene actually finishes rendering.
   */
  onProgress?: (fraction: number, label: string) => void | Promise<void>
}

export interface RenderStockVideoOutput {
  videoBuffer: Buffer
  thumbnailBuffer: Buffer
  durationSeconds: number
  /** How many scenes actually used real stock footage vs. the branded fallback background. */
  stockFootageScenes: number
  totalScenes: number
}

/**
 * The primary (non-canvas-only) rendering pipeline:
 *  1. For each scene, search Pexels' free stock video library using keywords
 *     derived from the scene's `visual_prompt` and download a real matching clip.
 *     If no key is configured or no match is found, fall back to a branded
 *     abstract background for just that scene (never fails the whole video).
 *  2. Real narration is synthesized with macOS `say`, exactly as before.
 *  3. ffmpeg crops/scales the real footage to the target aspect ratio, loops
 *     or trims it to match the narration duration, and overlays a caption +
 *     brand watermark PNG rendered with @napi-rs/canvas.
 *  4. Segments are concatenated into the final video; the thumbnail is then
 *     built by compositing the title over an actual frame pulled from that
 *     finished video (see renderVideoThumbnail in render.ts).
 */
export async function renderStockVideo(input: RenderStockVideoInput): Promise<RenderStockVideoOutput> {
  const { content } = input
  const { width, height } = ASPECT_SIZES[input.aspectRatio || '9:16']
  const aspectRatio = input.aspectRatio || '9:16'
  const voice = pickVoice(input.voiceStyle)

  const workDir = await mkdtemp(path.join(tmpdir(), 'autoviral-stockrender-'))
  try {
    const segmentFiles: string[] = []
    let totalDuration = 0
    let stockFootageScenes = 0

    for (let i = 0; i < content.script.length; i++) {
      const scene = content.script[i]

      const audioPath = path.join(workDir, `narration-${i}.wav`)
      const overlayPath = path.join(workDir, `overlay-${i}.png`)
      const segmentPath = path.join(workDir, `segment-${i}.mp4`)

      await synthesizeNarration(scene.narration, voice, audioPath, input.voiceProfileId)
      await writeFile(overlayPath, renderCaptionOverlay(scene, width, height))

      const audioDuration = await getAudioDurationSeconds(audioPath)
      const segmentDuration = Math.max(audioDuration + 0.6, 2)
      totalDuration += segmentDuration

      const clip = await findStockClip(scene.visual_prompt || scene.narration, aspectRatio)

      if (clip) {
        const clipPath = path.join(workDir, `clip-${i}.mp4`)
        try {
          await downloadStockClip(clip.downloadUrl, clipPath)
          const stats = await stat(clipPath)
          if (stats.size < 1024) throw new Error('Downloaded clip too small, likely a failed request.')

          // Ken-Burns-ish real footage: scale to cover the frame, crop to exact
          // aspect, loop if the source clip is shorter than the narration.
          await runFfmpeg([
            '-y',
            '-stream_loop', '-1',
            '-i', clipPath,
            '-i', overlayPath,
            '-i', audioPath,
            '-filter_complex',
            `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuv420p[bg];[bg][1:v]overlay=0:0[v]`,
            '-map', '[v]',
            '-map', '2:a',
            '-t', segmentDuration.toFixed(2),
            '-r', '30',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-af', 'apad',
            '-shortest',
            segmentPath,
          ])
          segmentFiles.push(segmentPath)
          stockFootageScenes++
          await input.onProgress?.((i + 1) / content.script.length, `Rendering scene ${i + 1} of ${content.script.length}`)
          continue
        } catch (err) {
          console.error(`[stockRender] scene ${i}: stock clip failed, falling back to branded background:`, err instanceof Error ? err.message : err)
        }
      }

      // Fallback: still frame + overlay, same as the legacy canvas renderer but
      // reusing the lighter-touch caption overlay for visual consistency.
      const bgPath = path.join(workDir, `bg-${i}.png`)
      await writeFile(bgPath, renderFallbackBackground(scene, width, height))
      await runFfmpeg([
        '-y',
        '-loop', '1',
        '-i', bgPath,
        '-i', overlayPath,
        '-i', audioPath,
        '-filter_complex', '[0:v][1:v]overlay=0:0,format=yuv420p[v]',
        '-map', '[v]',
        '-map', '2:a',
        '-t', segmentDuration.toFixed(2),
        '-r', '30',
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-af', 'apad',
        '-shortest',
        segmentPath,
      ])
      segmentFiles.push(segmentPath)
      await input.onProgress?.((i + 1) / content.script.length, `Rendering scene ${i + 1} of ${content.script.length}`)
    }

    const concatListPath = path.join(workDir, 'concat.txt')
    const concatList = segmentFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    await writeFile(concatListPath, concatList)

    const finalPath = path.join(workDir, 'final.mp4')
    await runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      finalPath,
    ])

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
    await rm(workDir, { recursive: true, force: true })
  }
}
