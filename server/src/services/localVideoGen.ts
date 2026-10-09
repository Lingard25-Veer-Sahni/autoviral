import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AspectRatio } from './render.js'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/src/services/localVideoGen.ts -> server/python/
const PYTHON_DIR = path.resolve(__dirname, '../../python')
const PYTHON_BIN = path.join(PYTHON_DIR, 'venv', 'bin', 'python3')
const SCRIPT_PATH = path.join(PYTHON_DIR, 'generate_clip.py')

/**
 * True only if the local venv + script actually exist on disk. This is an
 * experimental, opt-in, macOS/Apple-Silicon-only path (AnimateDiff-Lightning +
 * Realistic Vision running on MPS), never required for the app to function,
 * and never selected automatically by the main pipeline.
 */
export const localVideoGenAvailable = existsSync(PYTHON_BIN) && existsSync(SCRIPT_PATH)

export interface GenerateLocalClipInput {
  prompt: string
  outPath: string
  aspectRatio?: AspectRatio
  /** 1 | 2 | 4 | 8 - AnimateDiff-Lightning step count. Lower = faster, slightly lower quality. */
  steps?: 1 | 2 | 4 | 8
  numFrames?: number
  fps?: number
  seed?: number
}

export interface GenerateLocalClipResult {
  path: string
  frames: number
  generationSeconds: number
}

// Local SD1.5-based generation is only tractable at modest resolutions on a
// 16GB unified-memory Mac, square-ish sizes close to the model's native 512.
const LOCAL_GEN_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 384, height: 640 },
  '1:1': { width: 512, height: 512 },
  '16:9': { width: 640, height: 384 },
}

/**
 * Spawns the local Python worker to generate one short AI video clip entirely
 * on-device, no API key, no network call for inference (model weights are
 * cached locally after first download), zero marginal cost.
 *
 * This is explicitly an experimental/secondary path (see SETUP.md): slower
 * and lower-fidelity than a real hosted video-generation API. It exists so
 * the user can evaluate local generation quality/speed before deciding
 * whether to wire up a paid API (Runway/Kling/Luma/Higgsfield/etc).
 */
export async function generateLocalClip(input: GenerateLocalClipInput): Promise<GenerateLocalClipResult> {
  if (!localVideoGenAvailable) {
    throw new Error(
      'Local AI video generation is not set up (missing server/python/venv or generate_clip.py). See SETUP.md.'
    )
  }

  const { width, height } = LOCAL_GEN_SIZE[input.aspectRatio || '9:16']

  const args = [
    SCRIPT_PATH,
    '--prompt', input.prompt,
    '--out', input.outPath,
    '--width', String(width),
    '--height', String(height),
    '--steps', String(input.steps ?? 4),
    '--num-frames', String(input.numFrames ?? 16),
    '--fps', String(input.fps ?? 8),
  ]
  if (typeof input.seed === 'number') {
    args.push('--seed', String(input.seed))
  }

  // Generous timeout: first run downloads ~3GB of model weights; subsequent
  // runs are pure inference but still slow (SD1.5 x N frames on MPS, fp32).
  const { stdout, stderr } = await execFileAsync(PYTHON_BIN, args, {
    timeout: 30 * 60 * 1000,
    maxBuffer: 1024 * 1024 * 32,
  }).catch((err) => {
    // execFile rejects with stdout/stderr attached even on non-zero exit, // surface the Python script's own JSON error if it printed one.
    throw err
  })

  if (stderr) {
    // The script logs its own progress to stderr by design; surface it for debugging.
    console.log(`[localVideoGen] ${stderr.trim().split('\n').join('\n[localVideoGen] ')}`)
  }

  const lastLine = stdout.trim().split('\n').filter(Boolean).pop()
  if (!lastLine) {
    throw new Error('Local AI video worker produced no output.')
  }

  let parsed: { ok: boolean; path?: string; frames?: number; seconds?: number; error?: string }
  try {
    parsed = JSON.parse(lastLine)
  } catch {
    throw new Error(`Local AI video worker returned unparseable output: ${lastLine.slice(0, 200)}`)
  }

  if (!parsed.ok || !parsed.path) {
    throw new Error(parsed.error || 'Local AI video generation failed for an unknown reason.')
  }

  return { path: parsed.path, frames: parsed.frames ?? input.numFrames ?? 16, generationSeconds: parsed.seconds ?? 0 }
}
