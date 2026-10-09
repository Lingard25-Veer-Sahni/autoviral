import axios from 'axios'
import { writeFile } from 'node:fs/promises'

// Real Azure Cognitive Services Neural TTS, genuinely more natural than the
// local macOS `say` voices (see render.ts's VOICE_PRESETS comment for that
// engine's history). Optional: when AZURE_SPEECH_KEY/AZURE_SPEECH_REGION
// aren't set, render.ts's synthesizeNarration() falls back to `say` so the
// app keeps working with zero external dependencies.
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || ''
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || ''

export const azureTtsConfigured = Boolean(AZURE_SPEECH_KEY && AZURE_SPEECH_REGION)

const azureClient = axios.create({
  baseURL: AZURE_SPEECH_REGION ? `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com` : undefined,
  timeout: 30_000,
})

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface AzureVoiceChoice {
  /** Azure neural voice short name, e.g. "en-US-JennyNeural". */
  voice: string
  /** SSML <prosody> rate, e.g. "+10%", "-5%", "+0%". */
  rate: string
}

/** Synthesizes real neural speech via Azure's REST TTS endpoint, writing 16-bit PCM WAV to outFile. */
export async function synthesizeAzureNarration(text: string, voiceChoice: AzureVoiceChoice, outFile: string): Promise<void> {
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">` +
    `<voice name="${voiceChoice.voice}"><prosody rate="${voiceChoice.rate}">${escapeSsml(text)}</prosody></voice>` +
    `</speak>`

  const res = await azureClient.post<ArrayBuffer>('/cognitiveservices/v1', ssml, {
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      // 16-bit PCM WAV, matches what render.ts's `say` fallback produces, so
      // both engines are interchangeable everywhere audio duration is read
      // (afinfo) or composited (ffmpeg / Remotion's bundled ffmpeg).
      'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
    },
    responseType: 'arraybuffer',
  })

  await writeFile(outFile, Buffer.from(res.data))
}
