import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, Wand2, ImagePlus, Search, Upload, X, Mic, Trash2, Square, RotateCcw, Star } from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { useAuth } from '@/context/AuthContext'
import { api, type ImageSearchResult, type VoiceProfile } from '@/lib/api'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Label, Textarea } from '@/components/Input'
import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

const EXAMPLES = [
  'A 40-second explainer on why compound interest is the "8th wonder of the world", with bold on-screen numbers and an energetic tone.',
  'A calming morning routine reel: 5 habits, soft visuals, gentle narration, ending with a call to follow for more.',
  'Fast-paced list video: "3 AI tools that will save you 10 hours a week", punchy captions, upbeat music energy.',
]

const VOICES = ['energetic', 'calm', 'professional', 'comedic', 'inspirational']

type DurationValue = '10-30s' | '30-60s' | '60-90s'

// Real per-scene screen time is driven by actual narration audio length, not
// an exact-second slider, so length is offered as presets that steer the AI
// script's scene count/narration length (see aiSchema.ts's TARGET_DURATION_PRESETS).
// `credits` mirrors that same file's TARGET_DURATION_PRESETS costs so the
// dropdown can show the real price up front, longer videos mean more AI
// script tokens, more TTS narration, and more render time, so they cost more.
// Capped at 90s max, see aiSchema.ts's TARGET_DURATION_PRESETS comment for why.
const DURATIONS: { value: DurationValue; label: string; credits: number }[] = [
  { value: '10-30s', label: '10–30 sec', credits: 2 },
  { value: '30-60s', label: '30–60 sec', credits: 4 },
  { value: '60-90s', label: '60–90 sec', credits: 6 },
]

interface SelectedImage {
  key: string
  kind: 'search' | 'upload'
  previewUrl: string
  searchResult?: ImageSearchResult
  file?: File
}

export default function CreateVideo() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [voice, setVoice] = useState('energetic')
  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16')
  const [duration, setDuration] = useState<DurationValue>('30-60s')
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube', 'instagram'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const durationCredits = DURATIONS.find((d) => d.value === duration)?.credits ?? 1
  const availableCredits = profile?.credits ?? 0
  const insufficientCredits = availableCredits < durationCredits

  // Thumbnail: "auto" (default) lets the render engine's own synthetic
  // thumbnail stand; "custom" lets the user pick a single background image
  // that the (AI-generated) title gets composited on top of server-side.
  const [thumbnailMode, setThumbnailMode] = useState<'auto' | 'custom'>('auto')
  const [thumbnailQuery, setThumbnailQuery] = useState('')
  const [thumbnailResults, setThumbnailResults] = useState<ImageSearchResult[]>([])
  const [searchingThumbnail, setSearchingThumbnail] = useState(false)
  const [thumbnailSearchError, setThumbnailSearchError] = useState<string | null>(null)
  const [thumbnailImage, setThumbnailImage] = useState<SelectedImage | null>(null)
  const thumbnailFileInputRef = useRef<HTMLInputElement>(null)

  // Revoke any object URL we created for a local thumbnail upload when the component unmounts.
  useEffect(() => {
    return () => {
      if (thumbnailImage?.kind === 'upload') URL.revokeObjectURL(thumbnailImage.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Narration: "preset" (default) uses the built-in voice styles below;
  // "clone" narrates with one of the user's own real cloned voices (see
  // server/src/routes/voices.ts -- genuine Voicebox voice cloning, not a
  // mocked/simulated feature).
  const [voiceMode, setVoiceMode] = useState<'preset' | 'clone'>('preset')
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([])
  const [voiceboxAvailable, setVoiceboxAvailable] = useState(true)
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [cloneFile, setCloneFile] = useState<File | null>(null)
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const cloneFileInputRef = useRef<HTMLInputElement>(null)

  // In-browser mic recording (real MediaRecorder capture, not a file-upload
  // simulation) as an alternative to uploading an existing audio file --
  // both paths just populate `cloneFile`, so submitClone() below is
  // identical either way.
  const [sampleSource, setSampleSource] = useState<'upload' | 'record'>('upload')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop any live mic stream / timer if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl)
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function extensionForMimeType(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm'
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
    if (mimeType.includes('mpeg')) return 'mp3'
    if (mimeType.includes('wav')) return 'wav'
    return 'webm'
  }

  async function startRecording() {
    setCloneError(null)
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl)
      setRecordedPreviewUrl(null)
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        const file = new File([blob], `voice-sample-${Date.now()}.${extensionForMimeType(mimeType)}`, { type: mimeType })
        setCloneFile(file)
        setRecordedPreviewUrl(URL.createObjectURL(blob))
        micStreamRef.current?.getTracks().forEach((t) => t.stop())
        micStreamRef.current = null
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      setCloneError('Microphone access was denied or unavailable, allow mic access in your browser, or upload a file instead.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  function discardRecording() {
    if (recordedPreviewUrl) URL.revokeObjectURL(recordedPreviewUrl)
    setRecordedPreviewUrl(null)
    setCloneFile(null)
    setRecordSeconds(0)
  }

  useEffect(() => {
    api
      .listVoices()
      .then(({ voiceProfiles, voiceboxConfigured }) => {
        setVoiceProfiles(voiceProfiles)
        setVoiceboxAvailable(voiceboxConfigured)
        // Pre-select the account's default cloned voice (see the star toggle
        // below / PATCH /api/voices/:id/default) so narration automatically
        // uses it without having to reselect it on every video -- the user
        // can still switch back to a preset voice or another clone.
        const defaultProfile = voiceProfiles.find((vp) => vp.is_default && vp.status === 'ready')
        if (defaultProfile) {
          setVoiceMode('clone')
          setSelectedVoiceProfileId(defaultProfile.id)
        }
      })
      .catch(() => {
        // Cloned voices are an optional add-on -- if this fails, preset
        // voices are still fully usable, so fail silently here.
      })
  }, [])

  function handleCloneFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl)
        setRecordedPreviewUrl(null)
      }
      setCloneFile(file)
    }
  }

  async function submitClone() {
    setCloneError(null)
    if (!cloneName.trim()) {
      setCloneError('Give this voice a name first.')
      return
    }
    if (!cloneFile) {
      setCloneError('Choose a short audio sample of the voice (a clean 10-30s clip works best).')
      return
    }
    setCloning(true)
    try {
      const { voiceProfile } = await api.createVoice(cloneName.trim(), cloneFile)
      setVoiceProfiles((prev) => [voiceProfile, ...prev])
      setSelectedVoiceProfileId(voiceProfile.id)
      setCloneName('')
      setCloneFile(null)
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl)
        setRecordedPreviewUrl(null)
      }
    } catch (e) {
      setCloneError((e as Error).message)
    } finally {
      setCloning(false)
    }
  }

  async function removeVoiceProfile(id: string) {
    try {
      await api.deleteVoice(id)
      setVoiceProfiles((prev) => prev.filter((v) => v.id !== id))
      setSelectedVoiceProfileId((prev) => (prev === id ? null : prev))
    } catch (e) {
      setCloneError((e as Error).message)
    }
  }

  // Marks a voice as the account-wide default -- auto-selected here on every
  // future page load, and also used automatically for Channel Autopilot
  // generations (see scheduler.ts). The backend clears any previous default
  // for this user first (at most one default at a time).
  async function setDefaultVoiceProfile(id: string) {
    try {
      const { voiceProfile } = await api.setDefaultVoice(id)
      setVoiceProfiles((prev) => prev.map((vp) => ({ ...vp, is_default: vp.id === voiceProfile.id })))
    } catch (e) {
      setCloneError((e as Error).message)
    }
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function runThumbnailSearch() {
    const query = thumbnailQuery.trim()
    if (!query) return
    setSearchingThumbnail(true)
    setThumbnailSearchError(null)
    try {
      const { results } = await api.searchImages(query)
      setThumbnailResults(results)
    } catch (e) {
      setThumbnailSearchError((e as Error).message)
    } finally {
      setSearchingThumbnail(false)
    }
  }

  function selectThumbnailSearchImage(result: ImageSearchResult) {
    setThumbnailImage((prev) => {
      if (prev?.kind === 'upload') URL.revokeObjectURL(prev.previewUrl)
      return { key: `thumb-search-${result.id}`, kind: 'search', previewUrl: result.thumbnailUrl, searchResult: result }
    })
  }

  function handleThumbnailFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setThumbnailImage((prev) => {
      if (prev?.kind === 'upload') URL.revokeObjectURL(prev.previewUrl)
      return { key: `thumb-upload-${Date.now()}-${file.name}`, kind: 'upload', previewUrl: URL.createObjectURL(file), file }
    })
  }

  function clearThumbnail() {
    setThumbnailImage((prev) => {
      if (prev?.kind === 'upload') URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  async function submit() {
    setError(null)
    if (!prompt.trim()) {
      setError('Describe the video you want first.')
      return
    }
    if (thumbnailMode === 'custom' && !thumbnailImage) {
      setError('Search and select a thumbnail image, or upload one, or switch back to "Auto-generated".')
      return
    }
    if (voiceMode === 'clone' && !selectedVoiceProfileId) {
      setError('Select one of your cloned voices below, or switch back to "Preset voice".')
      return
    }
    if (insufficientCredits) {
      setError(`This length costs ${durationCredits} credits and you only have ${availableCredits}. Pick a shorter length or buy more credits.`)
      return
    }
    setLoading(true)
    try {
      await api.generateVideo({
        prompt,
        mode: 'manual',
        voiceStyle: voiceMode === 'preset' ? voice : undefined,
        voiceProfileId: voiceMode === 'clone' ? selectedVoiceProfileId! : undefined,
        aspectRatio: aspect,
        targetDuration: duration,
        platforms,
        thumbnailImageUrl:
          thumbnailMode === 'custom' && thumbnailImage?.kind === 'search' ? thumbnailImage.searchResult!.fullUrl : undefined,
        thumbnailImageFile:
          thumbnailMode === 'custom' && thumbnailImage?.kind === 'upload' ? thumbnailImage.file! : undefined,
      })
      await refreshProfile()
      navigate('/app/videos')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
        <Sparkles className="h-7 w-7 text-yolk-500" /> Create a video
      </h1>
      <p className="mt-1 text-white/50">Describe exactly what you want. AI writes it, voices it, edits it, and builds the thumbnail.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Label htmlFor="prompt">What's this video about?</Label>
          <Textarea
            id="prompt"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the topic, tone, key points, and any specific hook or call to action..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 hover:border-yolk-500/50 hover:text-white"
              >
                {ex.slice(0, 42)}…
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="duration">Length</Label>
              <select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value as DurationValue)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-yolk-500/50 focus:outline-none"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value} className="bg-ink-900 text-white">
                    {d.label}, {d.credits} credit{d.credits === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              {insufficientCredits && (
                <p className="mt-1.5 text-xs text-red-400">
                  Needs {durationCredits} credits, you have {availableCredits}.
                </p>
              )}
            </div>
            <div>
              <Label>Voice style</Label>
              <div className="flex flex-wrap gap-2">
                {VOICES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVoice(v)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs capitalize',
                      voice === v ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Aspect ratio</Label>
              <div className="flex gap-2">
                {(['9:16', '1:1', '16:9'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAspect(a)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs',
                      aspect === a ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Label>Narration</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setVoiceMode('preset')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                  voiceMode === 'preset' ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                )}
              >
                <Sparkles className="h-4 w-4" /> Preset voice{!voiceProfiles.some((vp) => vp.is_default) && ' (default)'}
              </button>
              <button
                onClick={() => setVoiceMode('clone')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                  voiceMode === 'clone' ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                )}
              >
                <Mic className="h-4 w-4" /> My cloned voice{voiceProfiles.some((vp) => vp.is_default) && ' (default)'}
              </button>
            </div>

            {voiceMode === 'clone' && (
              <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                {!voiceboxAvailable && (
                  <p className="rounded-lg bg-yolk-500/10 p-3 text-xs text-yolk-500">
                    Voice cloning isn't set up on this server yet (Voicebox isn't configured/running, see SETUP.md). Uploads will fail until it is.
                  </p>
                )}
                <p className="text-xs text-white/40">
                  Clone a real voice from a short sample, then pick it here to narrate this video.
                </p>

                {voiceProfiles.length > 0 && (
                  <div>
                    <Label className="text-xs">Your voices</Label>
                    <div className="flex flex-wrap gap-2">
                      {voiceProfiles.map((vp) => (
                        <div key={vp.id} className="group relative">
                          <button
                            type="button"
                            disabled={vp.status !== 'ready'}
                            onClick={() => setSelectedVoiceProfileId(vp.id)}
                            title={
                              vp.status === 'failed'
                                ? vp.error_message || 'Cloning failed'
                                : vp.status === 'pending'
                                  ? 'Still processing…'
                                  : undefined
                            }
                            className={cn(
                              'rounded-full border py-1.5 pl-3 pr-12 text-xs capitalize',
                              selectedVoiceProfileId === vp.id
                                ? 'border-yolk-500 bg-yolk-500/10 text-white'
                                : 'border-white/10 text-white/50',
                              vp.status !== 'ready' && 'cursor-not-allowed opacity-40'
                            )}
                          >
                            {vp.name}
                            {vp.status !== 'ready' && ` (${vp.status})`}
                            {vp.is_default && ' · Default'}
                          </button>
                          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                            <button
                              type="button"
                              disabled={vp.status !== 'ready'}
                              onClick={() => setDefaultVoiceProfile(vp.id)}
                              className={cn(
                                'disabled:cursor-not-allowed disabled:opacity-30',
                                vp.is_default ? 'text-yolk-400' : 'text-white/30 hover:text-yolk-400'
                              )}
                              title={vp.is_default ? 'This is your default voice' : 'Set as default voice'}
                            >
                              <Star className="h-3 w-3" fill={vp.is_default ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVoiceProfile(vp.id)}
                              className="text-white/30 hover:text-red-400"
                              title="Delete this voice"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div>
                    <Label className="text-xs">Clone a new voice</Label>
                    <input
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                      placeholder="Name this voice, e.g. My voice"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-yolk-500/50 focus:outline-none"
                    />

                    <div className="mt-2 flex gap-1 rounded-lg border border-white/10 bg-black/20 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          if (recording) stopRecording()
                          setSampleSource('upload')
                        }}
                        className={cn(
                          'flex-1 rounded-md py-1.5 transition-colors',
                          sampleSource === 'upload' ? 'bg-yolk-500/15 text-white' : 'text-white/40 hover:text-white/70'
                        )}
                      >
                        Upload file
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleSource('record')}
                        className={cn(
                          'flex-1 rounded-md py-1.5 transition-colors',
                          sampleSource === 'record' ? 'bg-yolk-500/15 text-white' : 'text-white/40 hover:text-white/70'
                        )}
                      >
                        Record voice
                      </button>
                    </div>

                    {sampleSource === 'upload' ? (
                      <>
                        <input
                          ref={cloneFileInputRef}
                          type="file"
                          accept="audio/*"
                          onChange={handleCloneFileSelected}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => cloneFileInputRef.current?.click()}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-3 text-xs text-white/50 hover:border-yolk-500/50 hover:text-white"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {cloneFile && !recordedPreviewUrl ? cloneFile.name : 'Choose an audio sample (10-30s, clean single voice)…'}
                        </button>
                      </>
                    ) : (
                      <div className="mt-2 rounded-lg border border-dashed border-white/15 p-3">
                        {!recordedPreviewUrl ? (
                          <div className="flex flex-col items-center gap-2">
                            <button
                              type="button"
                              onClick={recording ? stopRecording : startRecording}
                              className={cn(
                                'flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors',
                                recording
                                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                  : 'bg-yolk-500/15 text-white hover:bg-yolk-500/25'
                              )}
                            >
                              {recording ? (
                                <>
                                  <Square className="h-3.5 w-3.5" /> Stop recording
                                </>
                              ) : (
                                <>
                                  <Mic className="h-3.5 w-3.5" /> Start recording
                                </>
                              )}
                            </button>
                            <p className="text-[11px] text-white/40">
                              {recording
                                ? `Recording… ${recordSeconds}s (aim for 10-30s)`
                                : 'Record a clean 10-30s sample of a single voice.'}
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <audio controls src={recordedPreviewUrl} className="w-full" />
                            <button
                              type="button"
                              onClick={discardRecording}
                              className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white"
                            >
                              <RotateCcw className="h-3 w-3" /> Re-record
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button type="button" onClick={submitClone} loading={cloning} className="self-end shrink-0">
                    <Mic className="h-4 w-4" /> Clone voice
                  </Button>
                </div>
                {cloneError && <p className="text-xs text-red-400">{cloneError}</p>}
              </div>
            )}
          </div>

          <div className="mt-6">
            <Label>Thumbnail</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setThumbnailMode('auto')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                  thumbnailMode === 'auto' ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                )}
              >
                <Sparkles className="h-4 w-4" /> Auto-generated (default)
              </button>
              <button
                onClick={() => setThumbnailMode('custom')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                  thumbnailMode === 'custom' ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                )}
              >
                <ImagePlus className="h-4 w-4" /> Choose my own image
              </button>
            </div>

            {thumbnailMode === 'custom' && (
              <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs text-white/40">
                  Pick a background image (search or upload), the AI-generated title gets composited on top of it.
                </p>

                <div>
                  <Label className="text-xs">Search for an image</Label>
                  <div className="flex gap-2">
                    <input
                      value={thumbnailQuery}
                      onChange={(e) => setThumbnailQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runThumbnailSearch())}
                      placeholder="e.g. city skyline at night"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-yolk-500/50 focus:outline-none"
                    />
                    <Button type="button" onClick={runThumbnailSearch} loading={searchingThumbnail} className="shrink-0">
                      <Search className="h-4 w-4" /> Search
                    </Button>
                  </div>
                  {thumbnailSearchError && <p className="mt-2 text-xs text-red-400">{thumbnailSearchError}</p>}

                  {thumbnailResults.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {thumbnailResults.map((result) => {
                        const isSelected = thumbnailImage?.kind === 'search' && thumbnailImage.searchResult?.id === result.id
                        return (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => selectThumbnailSearchImage(result)}
                            className={cn(
                              'relative aspect-square overflow-hidden rounded-lg border-2',
                              isSelected ? 'border-yolk-500' : 'border-transparent hover:border-white/20'
                            )}
                            title={result.alt}
                          >
                            <img src={result.thumbnailUrl} alt={result.alt} className="h-full w-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <div className="rounded-full bg-yolk-500 p-1">
                                  <Sparkles className="h-3 w-3 text-black" />
                                </div>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Or upload from your computer</Label>
                  <input
                    ref={thumbnailFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => thumbnailFileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-3 text-xs text-white/50 hover:border-yolk-500/50 hover:text-white"
                  >
                    <Upload className="h-3.5 w-3.5" /> Choose an image file…
                  </button>
                </div>

                {thumbnailImage && (
                  <div>
                    <Label className="text-xs">Selected</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      <div className="group relative aspect-square overflow-hidden rounded-lg">
                        <img src={thumbnailImage.previewUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={clearThumbnail}
                          className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white/80 hover:bg-black hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6">
            <Label>Post to</Label>
            <div className="flex gap-2">
              <button
                onClick={() => togglePlatform('youtube')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                  platforms.includes('youtube') ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                )}
              >
                <Youtube className="h-4 w-4 text-red-500" /> YouTube
              </button>
              <button
                onClick={() => togglePlatform('instagram')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                  platforms.includes('instagram') ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                )}
              >
                <Instagram className="h-4 w-4 text-pink-400" /> Instagram
              </button>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <Button className="mt-6 w-full" size="lg" onClick={submit} loading={loading} disabled={insufficientCredits}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate video ({durationCredits} credit{durationCredits === 1 ? '' : 's'})
          </Button>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-white">What happens next</h2>
          <ol className="mt-4 space-y-4 text-sm text-white/60">
            <li><span className="font-semibold text-white">1. Script.</span> AI writes a scene-by-scene script matching your prompt.</li>
            <li><span className="font-semibold text-white">2. Voice & visuals.</span> Real narration is recorded and branded frames are rendered.</li>
            <li><span className="font-semibold text-white">3. Thumbnail & metadata.</span> A title, description, hashtags and thumbnail are generated.</li>
            <li><span className="font-semibold text-white">4. Review.</span> It lands in Video Manager for you to preview, edit, schedule or post.</li>
          </ol>
          <p className="mt-5 rounded-xl bg-white/5 p-3 text-xs text-white/40">
            You have {profile?.credits ?? 0} credits available.
          </p>
        </Card>
      </div>
    </div>
  )
}
