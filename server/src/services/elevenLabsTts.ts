import axios from 'axios'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import ffmpegPath from 'ffmpeg-static'

const execFileAsync = promisify(execFile)
const FFMPEG_BIN = (ffmpegPath as unknown as string) || 'ffmpeg'

// Real ElevenLabs TTS, optional, highest-priority narration engine (see
// render.ts's synthesizeNarration), tried before Azure Neural TTS / the
// macOS `say` fallback when ELEVENLABS_API_KEY is set. ElevenLabs' free tier
// is time- and character-limited, so ANY failure here (quota exhausted,
// trial expired, network error, etc.) is caught by the caller in render.ts
// and silently degrades to Azure or `say`, a generation never fails just
// because the ElevenLabs trial ran out.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''

// Optional: pin a specific voice_id from your ElevenLabs "Voices" library.
// When unset, resolveVoiceId() below picks the first voice on the account.
// Deliberately NOT hardcoding any of ElevenLabs' historical default voice
// names/IDs (e.g. "Rachel", "Josh", "Antoni") here, ElevenLabs has retired
// and silently remapped several of those over time, which is exactly the
// kind of silent-substitution failure this codebase avoids elsewhere (see
// render.ts's VOICE_PRESETS comment re: macOS `say`'s silent voice
// substitution). Always resolving against the account's real, current voice
// list, and logging which one got picked, avoids narrating with an
// unexpected voice with zero indication.
const ELEVENLABS_VOICE_ID_OVERRIDE = process.env.ELEVENLABS_VOICE_ID || ''

export const elevenLabsConfigured = Boolean(ELEVENLABS_API_KEY)

const client = axios.create({
  baseURL: 'https://api.elevenlabs.io/v1',
  timeout: 30_000,
  headers: { 'xi-api-key': ELEVENLABS_API_KEY },
})

let cachedVoiceId: string | null = null

async function resolveVoiceId(): Promise<string> {
  if (ELEVENLABS_VOICE_ID_OVERRIDE) return ELEVENLABS_VOICE_ID_OVERRIDE
  if (cachedVoiceId) return cachedVoiceId

  const res = await client.get<{ voices: { voice_id: string; name: string }[] }>('/voices')
  const voices = res.data.voices
  if (!voices?.length) {
    throw new Error('ElevenLabs account has no voices available in its Voices library.')
  }
  cachedVoiceId = voices[0].voice_id
  console.log(`[elevenlabs] resolved narration voice: "${voices[0].name}" (${cachedVoiceId})`)
  return cachedVoiceId
}

/**
 * Synthesizes real speech via ElevenLabs' TTS API and writes 16-bit 24kHz
 * mono PCM WAV to outFile, matches the exact format the Azure and `say`
 * engines produce (see render.ts), so downstream duration-reading (afinfo)
 * and compositing (ffmpeg/Remotion) never need to know which engine ran.
 * ElevenLabs itself returns mp3 (its universally-available default, unlike
 * some PCM sample rates which require a paid tier), so this converts it via
 * the ffmpeg binary already bundled for the rest of the render pipeline.
 */
export async function synthesizeElevenLabsNarration(text: string, outFile: string): Promise<void> {
  const voiceId = await resolveVoiceId()

  const res = await client.post<ArrayBuffer>(
    `/text-to-speech/${voiceId}`,
    { text, model_id: 'eleven_multilingual_v2' },
    { responseType: 'arraybuffer' }
  )

  const tmpMp3 = path.join(tmpdir(), `elevenlabs-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)
  await writeFile(tmpMp3, Buffer.from(res.data))
  try {
    await execFileAsync(FFMPEG_BIN, ['-y', '-i', tmpMp3, '-ac', '1', '-ar', '24000', '-sample_fmt', 's16', outFile])
  } finally {
    await unlink(tmpMp3).catch(() => {})
  }
}
