import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import type { GeneratedVideoContent, VideoScriptScene } from '../types.js'
import { azureTtsConfigured, synthesizeAzureNarration } from './azureTts.js'
import { elevenLabsConfigured, synthesizeElevenLabsNarration } from './elevenLabsTts.js'
import { voiceboxConfigured, synthesizeVoiceboxNarration } from './voiceboxTts.js'

const execFileAsync = promisify(execFile)

// ffmpeg-static's type declares `string`, but resolves to `null` on unsupported
// platforms at runtime — guard for that even though this project targets macOS dev.
export const FFMPEG_BIN = (ffmpegPath as unknown as string) || 'ffmpeg'

export type AspectRatio = '9:16' | '1:1' | '16:9'

export const ASPECT_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
}

// Voice presets, keyed by the friendly `voiceStyle` values surfaced in the
// Create Video / Autopilot forms. Each entry carries settings for BOTH
// engines synthesizeNarration() can dispatch to:
//  - azureVoice/azureRate: real Azure Neural TTS (genuinely natural,
//    cloud-synthesized) — used whenever AZURE_SPEECH_KEY/AZURE_SPEECH_REGION
//    are configured in server/.env. This is the primary/preferred engine.
//  - voice/rate: macOS `say` fallback, used only when Azure isn't
//    configured, so the app still works with zero external dependencies.
//
// IMPORTANT (say fallback only): `say -v <name>` does NOT error when
// `<name>` isn't installed — it silently substitutes the system default
// voice with zero indication. Verified directly on this machine: `say -v
// "Ava" ...`, `say -v "Samantha" ...`, and even `say -v
// "NotARealVoiceName123" ...` all produced byte-identical output. Every
// voice name below was confirmed present via `say -v '?'` on this machine —
// no silent fallbacks — and novelty/sound-effect voices are avoided
// entirely in favor of real, non-effects voices.
const VOICE_PRESETS: Record<string, { voice: string; rate: number; azureVoice: string; azureRate: string }> = {
  energetic: { voice: 'Samantha', rate: 190, azureVoice: 'en-US-AriaNeural', azureRate: '+12%' },
  friendly: { voice: 'Samantha', rate: 172, azureVoice: 'en-US-JennyNeural', azureRate: '+0%' },
  calm: { voice: 'Karen', rate: 150, azureVoice: 'en-US-SaraNeural', azureRate: '-10%' },
  authoritative: { voice: 'Daniel', rate: 162, azureVoice: 'en-US-GuyNeural', azureRate: '-5%' },
  deep: { voice: 'Ralph', rate: 150, azureVoice: 'en-US-DavisNeural', azureRate: '-8%' },
  dramatic: { voice: 'Moira', rate: 148, azureVoice: 'en-US-TonyNeural', azureRate: '-5%' },
  quirky: { voice: 'Samantha', rate: 195, azureVoice: 'en-US-JaneNeural', azureRate: '+14%' },
  default: { voice: 'Samantha', rate: 172, azureVoice: 'en-US-JennyNeural', azureRate: '+0%' },
}

export interface VoiceChoice {
  voice: string
  rate: number
  azureVoice: string
  azureRate: string
}

export function pickVoice(voiceStyle?: string): VoiceChoice {
  if (!voiceStyle) return VOICE_PRESETS.default
  const key = voiceStyle.trim().toLowerCase()
  return VOICE_PRESETS[key] || VOICE_PRESETS.default
}

// Brand palette — matches the web app's yellow/black theme.
export const BRAND = {
  black: '#0a0a0a',
  charcoal: '#141414',
  yellow: '#f5c400',
  yellowBright: '#ffe066',
  white: '#f5f5f0',
}

/** Cheap deterministic hash so the same visual_prompt always renders the same accent/shape. */
export function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawBrandBackground(
  ctx: SKRSContext2D,
  width: number,
  height: number,
  seed: number
) {
  // Base near-black gradient.
  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, BRAND.black)
  bg.addColorStop(1, BRAND.charcoal)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Soft yellow glow anchored by the scene's hash, for per-scene variety.
  const glowX = width * (0.2 + 0.6 * ((seed % 100) / 100))
  const glowY = height * (0.15 + 0.5 * (((seed >> 3) % 100) / 100))
  const glowRadius = Math.max(width, height) * 0.55
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius)
  glow.addColorStop(0, 'rgba(245, 196, 0, 0.35)')
  glow.addColorStop(1, 'rgba(245, 196, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  // Abstract rotated shapes derived from the hash, giving each scene a
  // distinct "art-directed" feel without needing a real image-gen model.
  const shapeCount = 3 + (seed % 3)
  for (let i = 0; i < shapeCount; i++) {
    const shapeSeed = seed + i * 7919
    const cx = width * ((shapeSeed % 137) / 137)
    const cy = height * (((shapeSeed >> 4) % 137) / 137)
    const size = Math.min(width, height) * (0.08 + ((shapeSeed >> 2) % 20) / 100)
    const rotation = ((shapeSeed % 360) * Math.PI) / 180
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    ctx.globalAlpha = 0.08 + ((shapeSeed % 10) / 100)
    ctx.fillStyle = i % 2 === 0 ? BRAND.yellow : BRAND.white
    if (shapeSeed % 2 === 0) {
      ctx.fillRect(-size / 2, -size / 2, size, size)
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

export function drawBrandFooter(ctx: SKRSContext2D, width: number, height: number) {
  ctx.save()
  ctx.font = '600 30px "Arial", sans-serif'
  ctx.fillStyle = 'rgba(245, 245, 240, 0.55)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('AUTOVIRAL', width / 2, height - 48)
  ctx.restore()
}

function drawProgressDots(
  ctx: SKRSContext2D,
  width: number,
  y: number,
  total: number,
  activeIndex: number
) {
  const dotRadius = 7
  const gap = 24
  const totalWidth = total * dotRadius * 2 + (total - 1) * gap
  let x = width / 2 - totalWidth / 2 + dotRadius
  for (let i = 0; i < total; i++) {
    ctx.beginPath()
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = i === activeIndex ? BRAND.yellow : 'rgba(245, 245, 240, 0.25)'
    ctx.fill()
    x += dotRadius * 2 + gap
  }
}

/** Renders a single scene as a branded PNG frame. */
function renderSceneFrame(
  scene: VideoScriptScene,
  index: number,
  total: number,
  width: number,
  height: number
): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const seed = hashString(scene.visual_prompt || scene.narration)

  drawBrandBackground(ctx, width, height, seed)

  // Bold on-screen caption, centered, wrapped to fit within safe margins.
  const maxWidth = width * 0.84
  let fontSize = Math.round(width * 0.085)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let lines: string[] = []
  do {
    ctx.font = `900 ${fontSize}px "Arial Black", "Arial", sans-serif`
    lines = wrapText(ctx, scene.on_screen_text.toUpperCase(), maxWidth)
    if (lines.length <= 4) break
    fontSize -= 4
  } while (fontSize > 32)

  const lineHeight = fontSize * 1.18
  const blockHeight = lines.length * lineHeight
  const startY = height / 2 - blockHeight / 2 + lineHeight / 2

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 18
    ctx.fillStyle = BRAND.white
    ctx.fillText(line, width / 2, y)
    ctx.shadowBlur = 0
  })

  // Thin yellow accent rule under the caption block.
  const ruleY = startY + blockHeight - lineHeight / 2 + 36
  ctx.fillStyle = BRAND.yellow
  ctx.fillRect(width / 2 - 60, ruleY, 120, 6)

  drawProgressDots(ctx, width, height - 110, total, index)
  drawBrandFooter(ctx, width, height)

  return canvas.encodeSync('png')
}

/**
 * Renders the thumbnail from a user-chosen background image with the (AI
 * generated) title composited on top -- same brand text treatment as the
 * fully-synthetic `renderThumbnailFrame`, but with a real photo instead of
 * an abstract gradient background.
 */
export async function renderThumbnailFromImage(
  title: string,
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const img = await loadImage(imageBuffer)
  // Cover-fit crop, same math as CSS `object-fit: cover`.
  const scale = Math.max(width / img.width, height / img.height)
  const drawWidth = img.width * scale
  const drawHeight = img.height * scale
  const dx = (width - drawWidth) / 2
  const dy = (height - drawHeight) / 2
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight)

  // Bottom-weighted dark gradient so the title stays legible over any photo.
  const overlay = ctx.createLinearGradient(0, 0, 0, height)
  overlay.addColorStop(0, 'rgba(10, 10, 10, 0.12)')
  overlay.addColorStop(0.55, 'rgba(10, 10, 10, 0.32)')
  overlay.addColorStop(1, 'rgba(10, 10, 10, 0.85)')
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, width, height)

  const maxWidth = width * 0.86
  let fontSize = Math.round(width * 0.09)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let lines: string[] = []
  do {
    ctx.font = `900 ${fontSize}px "Arial Black", "Arial", sans-serif`
    lines = wrapText(ctx, title.toUpperCase(), maxWidth)
    if (lines.length <= 3) break
    fontSize -= 4
  } while (fontSize > 28)

  const lineHeight = fontSize * 1.14
  const blockHeight = lines.length * lineHeight
  const startY = height * 0.8 - blockHeight / 2

  // Yellow accent rule above the title block.
  ctx.fillStyle = BRAND.yellow
  ctx.fillRect(width / 2 - 60, startY - lineHeight / 2 - 30, 120, 6)

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
    ctx.shadowBlur = 20
    ctx.fillStyle = BRAND.white
    ctx.fillText(line, width / 2, y)
    ctx.shadowBlur = 0
  })

  drawBrandFooter(ctx, width, height)

  return canvas.encodeSync('png')
}

/** Renders the eye-catching thumbnail frame (used as the video's poster image). */
export function renderThumbnailFrame(
  title: string,
  width: number,
  height: number
): Buffer {
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const seed = hashString(title)

  drawBrandBackground(ctx, width, height, seed)

  // Strong yellow diagonal band behind the title for a "thumbnail" pop.
  ctx.save()
  ctx.globalAlpha = 0.92
  ctx.fillStyle = BRAND.yellow
  ctx.translate(width / 2, height * 0.5)
  ctx.rotate(-0.035)
  ctx.fillRect(-width * 0.65, -height * 0.16, width * 1.3, height * 0.32)
  ctx.restore()

  const maxWidth = width * 0.86
  let fontSize = Math.round(width * 0.09)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let lines: string[] = []
  do {
    ctx.font = `900 ${fontSize}px "Arial Black", "Arial", sans-serif`
    lines = wrapText(ctx, title.toUpperCase(), maxWidth)
    if (lines.length <= 3) break
    fontSize -= 4
  } while (fontSize > 28)

  const lineHeight = fontSize * 1.12
  const blockHeight = lines.length * lineHeight
  const startY = height / 2 - blockHeight / 2 + lineHeight / 2
  lines.forEach((line, i) => {
    ctx.fillStyle = BRAND.black
    ctx.fillText(line, width / 2, startY + i * lineHeight)
  })

  // Play button glyph.
  const r = width * 0.09
  const cx = width / 2
  const cy = height * 0.82
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(10, 10, 10, 0.55)'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.35, cy - r * 0.5)
  ctx.lineTo(cx - r * 0.35, cy + r * 0.5)
  ctx.lineTo(cx + r * 0.5, cy)
  ctx.closePath()
  ctx.fillStyle = BRAND.yellow
  ctx.fill()

  drawBrandFooter(ctx, width, height)

  return canvas.encodeSync('png')
}

/**
 * Grabs a single still frame from the just-rendered video via ffmpeg, to use
 * as the thumbnail's background (see renderVideoThumbnail below) instead of
 * a fully synthetic graphic. Sampled partway through rather than frame 0,
 * since opening frames are often a title-card/fade-in that makes for a
 * duller, less representative thumbnail than a mid-video moment.
 */
async function extractVideoFrame(videoPath: string, atSeconds: number): Promise<Buffer> {
  const framePath = path.join(tmpdir(), `thumb-src-${Date.now()}-${Math.random().toString(36).slice(2)}.png`)
  try {
    await runFfmpeg(['-y', '-ss', atSeconds.toFixed(2), '-i', videoPath, '-frames:v', '1', framePath])
    return await readFile(framePath)
  } finally {
    await unlink(framePath).catch(() => {})
  }
}

/**
 * Builds the video's thumbnail by compositing the title over an actual frame
 * pulled from the rendered video itself (see extractVideoFrame above),
 * rather than a fully synthetic branded graphic — the thumbnail now visually
 * matches what the video actually looks like, across all three render
 * engines (canvas/render.ts, stockRender.ts, remotionRender.ts all call this
 * with their own already-concatenated `finalPath`). Falls back to the old
 * fully-synthetic renderThumbnailFrame() if frame extraction fails for any
 * reason (e.g. a pathologically short/corrupt render), so thumbnail
 * generation can never fail the whole video.
 */
export async function renderVideoThumbnail(
  finalVideoPath: string,
  totalDurationSeconds: number,
  title: string,
  width: number,
  height: number
): Promise<Buffer> {
  try {
    const atSeconds = Math.min(
      Math.max(totalDurationSeconds * 0.35, 0.3),
      Math.max(totalDurationSeconds - 0.3, 0.3)
    )
    const frame = await extractVideoFrame(finalVideoPath, atSeconds)
    return await renderThumbnailFromImage(title, frame, width, height)
  } catch (err) {
    console.error(
      '[render] failed to extract a video frame for the thumbnail, falling back to a synthetic background:',
      err instanceof Error ? err.message : err
    )
    return renderThumbnailFrame(title, width, height)
  }
}

/**
 * Real (non-mocked) narration synthesis.
 *
 * When `voiceProfileId` is set (a user picked one of their own cloned
 * voices — see voiceboxTts.ts / routes/voices.ts), Voicebox is tried FIRST,
 * ahead of every preset engine below, since a specific custom voice was
 * explicitly requested. Any failure (Voicebox unreachable, profile not
 * ready, etc.) is caught and logged, then falls through to the normal
 * preset-voice chain below rather than failing the whole generation —
 * consistent with every other optional engine in this file.
 *
 * Preset-voice priority (used whenever no voiceProfileId is set, or as the
 * fallback above):
 *  1. ElevenLabs (most natural, but free-tier is time/character limited —
 *     see elevenLabsTts.ts). Any failure here (quota exhausted, trial
 *     expired, network error) is caught and logged, then falls through to:
 *  2. Azure Neural TTS, when configured (genuinely natural cloud voices).
 *  3. The local macOS `say` engine, so the app always keeps working with
 *     zero external dependencies even if nothing above is configured/working.
 * All paths write 16-bit PCM WAV, so callers/downstream ffmpeg or Remotion
 * compositing never need to know which engine actually ran.
 */
export async function synthesizeNarration(
  text: string,
  voiceChoice: VoiceChoice,
  outFile: string,
  voiceProfileId?: string | null
): Promise<void> {
  if (voiceProfileId && voiceboxConfigured) {
    try {
      await synthesizeVoiceboxNarration(text, voiceProfileId, outFile)
      return
    } catch (err) {
      console.error(
        `[render] custom cloned-voice narration failed (profile ${voiceProfileId}), falling back to the default voice:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  if (elevenLabsConfigured) {
    try {
      await synthesizeElevenLabsNarration(text, outFile)
      return
    } catch (err) {
      console.error(
        `[render] ElevenLabs narration failed, falling back to ${azureTtsConfigured ? 'Azure Neural TTS' : 'macOS say'}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  if (azureTtsConfigured) {
    await synthesizeAzureNarration(text, { voice: voiceChoice.azureVoice, rate: voiceChoice.azureRate }, outFile)
    return
  }
  // `-r` (words per minute) is the one reliably-documented, empirically-verified lever
  // for pacing on this limited legacy voice set — see VOICE_PRESETS' comment above.
  await execFileAsync('say', [
    '-v', voiceChoice.voice,
    '-r', String(voiceChoice.rate),
    '--file-format=WAVE', '--data-format=LEI16',
    '-o', outFile, text,
  ])
}

export async function getAudioDurationSeconds(file: string): Promise<number> {
  const { stdout } = await execFileAsync('afinfo', [file])
  const match = stdout.match(/estimated duration:\s*([\d.]+)\s*sec/i)
  if (!match) {
    throw new Error(`Could not determine audio duration for ${file}`)
  }
  return parseFloat(match[1])
}

export async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync(FFMPEG_BIN, args, { maxBuffer: 1024 * 1024 * 64 })
}

export interface RenderVideoInput {
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

export interface RenderVideoOutput {
  videoBuffer: Buffer
  thumbnailBuffer: Buffer
  durationSeconds: number
}

/**
 * The real (non-mocked) rendering pipeline:
 *  1. The AI-written script scenes are narrated via synthesizeNarration() (Azure Neural TTS, or macOS `say` fallback) -> real speech audio.
 *  2. Each scene is art-directed into a branded frame with @napi-rs/canvas.
 *  3. ffmpeg (via ffmpeg-static, no system install required) muxes each
 *     scene's still frame + narration into a segment, then concatenates all
 *     segments into the final vertical/square/horizontal .mp4.
 *  4. A separate, more eye-catching frame is rendered as the thumbnail.
 */
export async function renderVideo(input: RenderVideoInput): Promise<RenderVideoOutput> {
  const { content } = input
  const { width, height } = ASPECT_SIZES[input.aspectRatio || '9:16']
  const voice = pickVoice(input.voiceStyle)

  const workDir = await mkdtemp(path.join(tmpdir(), 'autoviral-render-'))
  try {
    const segmentFiles: string[] = []
    let totalDuration = 0

    for (let i = 0; i < content.script.length; i++) {
      const scene = content.script[i]

      const framePath = path.join(workDir, `frame-${i}.png`)
      const audioPath = path.join(workDir, `narration-${i}.wav`)
      const segmentPath = path.join(workDir, `segment-${i}.mp4`)

      await writeFile(framePath, renderSceneFrame(scene, i, content.script.length, width, height))
      await synthesizeNarration(scene.narration, voice, audioPath, input.voiceProfileId)

      const audioDuration = await getAudioDurationSeconds(audioPath)
      // Pad slightly past the spoken audio so the line never feels cut off.
      const segmentDuration = Math.max(audioDuration + 0.6, 2)
      totalDuration += segmentDuration

      await runFfmpeg([
        '-y',
        '-loop', '1',
        '-i', framePath,
        '-i', audioPath,
        '-t', segmentDuration.toFixed(2),
        '-vf', `scale=${width}:${height},format=yuv420p`,
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-r', '30',
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

    return { videoBuffer, thumbnailBuffer, durationSeconds: Math.round(totalDuration) }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
