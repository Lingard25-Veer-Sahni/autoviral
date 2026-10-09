import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) || {}),
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Same shape as `request`, but for multipart/form-data bodies (a custom
// thumbnail upload, which needs to ship real uploaded file bytes). Crucially
// does NOT set Content-Type itself, the browser has to compute the
// multipart boundary, which it only does when it owns that header.
async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()) }
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface ImageSearchResult {
  id: string
  width: number
  height: number
  photographer: string
  alt: string
  thumbnailUrl: string
  fullUrl: string
}

export interface GenerateVideoPayload {
  prompt: string
  channelId?: string
  mode: 'autopilot' | 'manual'
  voiceStyle?: string
  /** A user's own cloned voice (voice_profiles.id), overrides voiceStyle's preset chain when set. */
  voiceProfileId?: string
  aspectRatio?: string
  /** Target runtime preset, steers AI scene count/narration length, and determines the credits charged (see server's aiSchema.ts TARGET_DURATION_PRESETS). Real per-scene timing is TTS-audio-derived, so this isn't exact-second precision. */
  targetDuration?: '10-30s' | '30-60s' | '60-90s'
  platforms?: string[]
  /** Full-resolution URL of a single image picked from the thumbnail search dropdown (fetched server-side). */
  thumbnailImageUrl?: string
  /** A thumbnail background image picked from the user's own computer. */
  thumbnailImageFile?: File
}

export interface VoiceProfile {
  id: string
  name: string
  status: 'pending' | 'ready' | 'failed'
  error_message: string | null
  sample_count: number
  /** Whether this is the account-wide default voice, auto-used for narration in Create Video and Channel Autopilot. At most one true per user. */
  is_default: boolean
  created_at: string
}

export const api = {
  generateVideo: (payload: GenerateVideoPayload) => {
    if (!payload.thumbnailImageFile) {
      return request<{ video: unknown }>('/api/videos/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: payload.prompt,
          channelId: payload.channelId,
          mode: payload.mode,
          voiceStyle: payload.voiceStyle,
          voiceProfileId: payload.voiceProfileId,
          aspectRatio: payload.aspectRatio,
          targetDuration: payload.targetDuration,
          platforms: payload.platforms,
          thumbnailImageUrl: payload.thumbnailImageUrl,
        }),
      })
    }

    const form = new FormData()
    form.append('prompt', payload.prompt)
    form.append('mode', payload.mode)
    if (payload.channelId) form.append('channelId', payload.channelId)
    if (payload.voiceStyle) form.append('voiceStyle', payload.voiceStyle)
    if (payload.voiceProfileId) form.append('voiceProfileId', payload.voiceProfileId)
    if (payload.aspectRatio) form.append('aspectRatio', payload.aspectRatio)
    if (payload.targetDuration) form.append('targetDuration', payload.targetDuration)
    form.append('platforms', JSON.stringify(payload.platforms || []))
    form.append('thumbnailFile', payload.thumbnailImageFile)
    return requestMultipart<{ video: unknown }>('/api/videos/generate', form)
  },

  searchImages: (query: string, perPage = 16) =>
    request<{ results: ImageSearchResult[] }>(
      `/api/media/image-search?query=${encodeURIComponent(query)}&perPage=${perPage}`
    ),

  postVideo: (videoId: string, platforms: string[]) =>
    request<{ ok: boolean }>(`/api/videos/${videoId}/post`, {
      method: 'POST',
      body: JSON.stringify({ platforms }),
    }),

  scheduleVideo: (videoId: string, scheduledAt: string) =>
    request<{ ok: boolean }>(`/api/videos/${videoId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt }),
    }),

  connectStatus: () =>
    request<{ youtube: boolean; instagram: boolean }>('/api/social/status'),

  oauthUrl: (platform: 'youtube' | 'instagram') =>
    request<{ url: string; configured: boolean }>(`/api/social/${platform}/oauth-url`),

  disconnect: (platform: 'youtube' | 'instagram') =>
    request<{ ok: boolean }>(`/api/social/${platform}/disconnect`, { method: 'POST' }),

  listVoices: () => request<{ voiceProfiles: VoiceProfile[]; voiceboxConfigured: boolean }>('/api/voices'),

  // Real voice cloning: uploads a sample which gets transcribed and attached
  // to a new Voicebox profile server-side (see server/src/routes/voices.ts).
  // This can take a little while (transcription + profile creation both run
  // synchronously), so callers should show a loading state.
  createVoice: (name: string, file: File) => {
    const form = new FormData()
    form.append('name', name)
    form.append('file', file)
    return requestMultipart<{ voiceProfile: VoiceProfile }>('/api/voices', form)
  },

  deleteVoice: (id: string) => request<{ ok: boolean }>(`/api/voices/${id}`, { method: 'DELETE' }),

  setDefaultVoice: (id: string) =>
    request<{ voiceProfile: VoiceProfile }>(`/api/voices/${id}/default`, { method: 'PATCH' }),

  // Real Razorpay checkout (see server/src/routes/payments.ts), replaces the
  // old demo flow that granted credits with no payment processor at all.
  razorpayConfig: () =>
    request<{
      configured: boolean
      currency: string
      packs: Record<string, { credits: number; price: number; label: string }>
    }>('/api/payments/razorpay/config'),

  createRazorpayOrder: (packId: string) =>
    request<{ orderId: string; amount: number; currency: string; keyId: string; packId: string }>(
      '/api/payments/razorpay/create-order',
      { method: 'POST', body: JSON.stringify({ packId }) }
    ),

  verifyRazorpayPayment: (payload: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
    packId: string
  }) =>
    request<{ ok: boolean; creditsAdded: number; alreadyProcessed?: boolean }>('/api/payments/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

export { BASE_URL }
