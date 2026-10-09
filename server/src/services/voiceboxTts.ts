import axios from 'axios'
import FormData from 'form-data'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import ffmpegPath from 'ffmpeg-static'

const execFileAsync = promisify(execFile)
const FFMPEG_BIN = (ffmpegPath as unknown as string) || 'ffmpeg'

// Voicebox (https://github.com/jamiepine/voicebox) — a self-hosted,
// open-source "AI voice studio" (Docker container, FastAPI backend) that
// does real zero-shot voice cloning: give it a short reference audio sample
// plus its transcript, and it can narrate arbitrary text back in that
// cloned voice. This is NOT a hosted third-party API — VOICEBOX_URL just
// points at wherever the user's own `docker compose up` instance is
// listening (see SETUP.md), so there's no API key. Every route/field shape
// used below was verified against Voicebox's actual FastAPI source
// (backend/routes/{profiles,transcription,generations}.py and
// backend/models.py on GitHub) rather than guessed.
const VOICEBOX_URL = (process.env.VOICEBOX_URL || '').replace(/\/+$/, '')
export const voiceboxConfigured = Boolean(VOICEBOX_URL)

const client = axios.create({
  baseURL: VOICEBOX_URL || 'http://127.0.0.1:17493',
  // Cloning/transcription/synthesis all run real local inference (no GPU
  // guaranteed), so this is generous compared to the other TTS engines'
  // hosted-API timeouts.
  timeout: 120_000,
})

/** Pulls Voicebox's actual error body (FastAPI's {detail: ...} shape) out of
 * an axios error instead of surfacing axios's generic "Request failed with
 * status code N" — the real detail is what's actually useful for debugging
 * (and for the user, when it's something actionable). */
function voiceboxErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (detail && typeof detail === 'object') {
      const d = detail as { message?: string }
      if (typeof d.message === 'string') return d.message
      return JSON.stringify(detail)
    }
    if (err.response?.data) return JSON.stringify(err.response.data)
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}

/**
 * POST /profiles — creates a new, initially sample-less cloned-voice
 * profile. Returns Voicebox's own profile id (VoiceProfileResponse.id),
 * which is what every later call (sample upload, /generate/stream,
 * deletion) addresses this voice by.
 */
export async function createVoiceboxProfile(name: string): Promise<string> {
  try {
    const res = await client.post<{ id: string }>('/profiles', {
      name,
      voice_type: 'cloned',
    })
    return res.data.id
  } catch (err) {
    throw new Error(voiceboxErrorMessage(err))
  }
}

/**
 * POST /transcribe — runs Voicebox's bundled Whisper model on the uploaded
 * sample to get a REAL transcript. Voicebox's own POST
 * /profiles/{id}/samples requires a `reference_text` field verbatim
 * matching what's spoken in the sample; rather than asking the end user to
 * type it out themselves (friction) or fabricating a placeholder (which
 * would poison the voice clone with a wrong transcript), this auto-derives
 * it from the real audio.
 *
 * The FIRST call against a fresh Voicebox instance (before its Whisper model
 * has been downloaded/loaded into memory) returns 202 with
 * `{message, model_name, downloading: true}` instead of the transcript —
 * confirmed against backend/routes/transcription.py. There's no job id or
 * webhook, just "wait and try again", so this polls (rebuilding the
 * multipart body each attempt, since a FormData stream can only be sent
 * once) until either a real 200 or maxWaitMs is exceeded.
 */
export async function transcribeVoiceboxSample(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  maxWaitMs = 5 * 60_000
): Promise<string> {
  const start = Date.now()
  for (;;) {
    const form = new FormData()
    form.append('file', buffer, { filename, contentType: mimeType })
    try {
      const res = await client.post<{ text: string; duration: number }>('/transcribe', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (status) => status === 200 || status === 202,
      })
      if (res.status === 200) return res.data.text
      // 202 — model still downloading/loading. Wait and retry.
      if (Date.now() - start > maxWaitMs) {
        throw new Error(
          "Voicebox is still downloading its speech-recognition model (first-use only) and didn't finish in time — wait a minute and try again."
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 3000))
    } catch (err) {
      if (err instanceof Error && err.message.includes('still downloading')) throw err
      throw new Error(voiceboxErrorMessage(err))
    }
  }
}

/**
 * POST /profiles/{profile_id}/samples — attaches a reference audio sample
 * (+ its real transcript from transcribeVoiceboxSample above) to a profile.
 * A profile needs at least one sample before /generate/stream can narrate
 * anything with it.
 */
export async function uploadVoiceboxSample(
  profileId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  referenceText: string
): Promise<void> {
  const form = new FormData()
  form.append('file', buffer, { filename, contentType: mimeType })
  form.append('reference_text', referenceText)
  try {
    await client.post(`/profiles/${encodeURIComponent(profileId)}/samples`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
  } catch (err) {
    throw new Error(voiceboxErrorMessage(err))
  }
}

/** DELETE /profiles/{profile_id} — removes the profile (and its samples) from Voicebox itself. */
export async function deleteVoiceboxProfile(profileId: string): Promise<void> {
  try {
    await client.delete(`/profiles/${encodeURIComponent(profileId)}`)
  } catch (err) {
    throw new Error(voiceboxErrorMessage(err))
  }
}

/**
 * `POST /generate/stream` fails fast with a 400 (`ensure_model_cached_or_raise`
 * in Voicebox's own backend/backends/__init__.py) the first time a given TTS
 * model is used and hasn't been downloaded to disk yet, rather than
 * downloading it inline like `/transcribe` does for Whisper — its own error
 * message literally says "Use /generate to trigger a download" (the
 * *non*-streaming endpoint we don't use). Left unhandled, every narration
 * call for a fresh Voicebox install/model hits this, throws, and
 * render.ts's synthesizeNarration() catches it and silently falls back to
 * the default preset voice — which is exactly why a cloned voice can render
 * as the generic AI voice with no visible error. Detects that specific
 * error and drives the download itself (mirrors the polling loop already in
 * transcribeVoiceboxSample above) before retrying once.
 */
const MODEL_NOT_DOWNLOADED_RE = /Model (\S+) is not downloaded yet/i

/**
 * Distinguishes transient failures (Voicebox 5xx / connection reset / the
 * 120s client timeout) -- which running several pipelines at once on one
 * local machine reliably triggers under CPU/GPU contention -- from
 * permanent ones (400 bad profile id, validation errors, etc). Only the
 * former is worth a single automatic retry; retrying a genuine 4xx would
 * just fail again identically.
 */
function isTransientVoiceboxError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true
  const status = err.response?.status
  return status === undefined || status >= 500
}

// Matches what /generate/stream actually requests server-side when we don't
// pass `engine`/`model_size` in the POST body (which we never do): Voicebox's
// _resolve_generation_engine() defaults to engine "qwen", and stream_speech
// defaults model_size to "1.7B" — i.e. the "qwen-tts-{size}" entry in
// /models/status. Built from the size parsed out of the 400's error message
// rather than hardcoded, so it still tracks correctly if Voicebox's own
// default model_size ever changes.
function qwenTtsModelName(modelSize: string): string {
  return `qwen-tts-${modelSize}`
}

interface VoiceboxModelStatus {
  model_name: string
  downloaded: boolean
  downloading: boolean
}

async function ensureVoiceboxModelDownloaded(modelName: string, maxWaitMs = 15 * 60_000): Promise<void> {
  const start = Date.now()

  async function isDownloaded(): Promise<boolean> {
    const res = await client.get<{ models: VoiceboxModelStatus[] }>('/models/status')
    return Boolean(res.data.models.find((m) => m.model_name === modelName)?.downloaded)
  }

  if (await isDownloaded()) return

  await client.post('/models/download', { model_name: modelName }).catch((err) => {
    // A 409/"already downloading" here is fine — the poll loop below covers it either way.
    if (!axios.isAxiosError(err) || err.response?.status !== 409) throw new Error(voiceboxErrorMessage(err))
  })

  for (;;) {
    if (Date.now() - start > maxWaitMs) {
      throw new Error(
        `Voicebox is still downloading the ${modelName} model (first-use only, several GB) and didn't finish in time — wait a bit and try again.`
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 5000))
    if (await isDownloaded()) return
  }
}

/**
 * POST /generate/stream — synchronously synthesizes `text` in the cloned
 * voice identified by `profileId` and streams back real WAV audio directly
 * (no generation-id polling needed, unlike Voicebox's async POST /generate).
 * Converts the result to the same 16-bit 24kHz mono PCM WAV shape every
 * other narration engine in this app produces (see elevenLabsTts.ts /
 * azureTts.ts), so downstream duration-reading (afinfo) and ffmpeg/Remotion
 * compositing stay completely engine-agnostic.
 */
export async function synthesizeVoiceboxNarration(
  text: string,
  profileId: string,
  outFile: string,
  isRetry = false,
  retriedTransient = false
): Promise<void> {
  let res: { data: ArrayBuffer }
  try {
    res = await client.post<ArrayBuffer>(
      '/generate/stream',
      { profile_id: profileId, text },
      { responseType: 'arraybuffer' }
    )
  } catch (err) {
    const message = voiceboxErrorMessage(err)
    const modelMatch = !isRetry ? message.match(MODEL_NOT_DOWNLOADED_RE) : null
    if (modelMatch) {
      await ensureVoiceboxModelDownloaded(qwenTtsModelName(modelMatch[1]))
      return synthesizeVoiceboxNarration(text, profileId, outFile, true, retriedTransient)
    }
    // A 500/timeout/connection-reset here is usually this same local Voicebox
    // instance being overloaded by a concurrent render/synthesis job, not a
    // real problem with the request itself -- one short-delay retry recovers
    // cleanly once the other job finishes, instead of silently falling back
    // to the generic preset voice (render.ts's synthesizeNarration() catches
    // whatever we throw and does exactly that).
    if (!retriedTransient && isTransientVoiceboxError(err)) {
      await new Promise((resolve) => setTimeout(resolve, 4000))
      return synthesizeVoiceboxNarration(text, profileId, outFile, isRetry, true)
    }
    throw new Error(message)
  }

  const tmpWav = path.join(tmpdir(), `voicebox-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`)
  await writeFile(tmpWav, Buffer.from(res.data))
  try {
    await execFileAsync(FFMPEG_BIN, ['-y', '-i', tmpWav, '-ac', '1', '-ar', '24000', '-sample_fmt', 's16', outFile])
  } finally {
    await unlink(tmpWav).catch(() => {})
  }
}
