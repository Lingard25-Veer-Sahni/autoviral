import { Router } from 'express'
import multer from 'multer'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabaseAdmin.js'
import { initiateVideoGeneration } from '../services/videoPipeline.js'
import { postVideoToPlatform } from '../services/socialPost.js'
import { downloadImageBuffer } from '../services/imageSearch.js'
import { TARGET_DURATION_PRESETS, DEFAULT_TARGET_DURATION } from '../services/aiSchema.js'
import type { Platform } from '../types.js'

const router = Router()

const VALID_ASPECTS = ['9:16', '1:1', '16:9']
// Single source of truth is aiSchema.ts's TARGET_DURATION_PRESETS (which also
// carries each tier's credit cost), this just derives the list of valid keys.
const VALID_DURATIONS = Object.keys(TARGET_DURATION_PRESETS)

// Memory storage: a thumbnail image is only ever needed transiently to seed
// a single render (see render.ts's renderThumbnailFromImage), never
// persisted to disk or Storage here, consistent with the rest of the
// pipeline's ephemeral per-render assets.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
})

// POST /api/videos/generate, kicks off the real AI -> render -> upload pipeline.
// Accepts either a plain JSON body (no thumbnail image picked, the default
// shape) or a multipart/form-data body when a thumbnail file is uploaded
// (under "thumbnailFile"), a picked-from-search thumbnail instead travels
// as a plain URL string ("thumbnailImageUrl") on either body shape.
// `.fields()` only engages for multipart requests, a JSON request passes
// straight through untouched.
router.post(
  '/generate',
  requireAuth,
  upload.fields([{ name: 'thumbnailFile', maxCount: 1 }]),
  async (req: AuthedRequest, res) => {
  const body: Record<string, unknown> = req.body || {}
  const { prompt, channelId, mode, voiceStyle, voiceProfileId, aspectRatio, targetDuration } = body as {
    prompt?: unknown
    channelId?: unknown
    mode?: unknown
    voiceStyle?: unknown
    voiceProfileId?: unknown
    aspectRatio?: unknown
    targetDuration?: unknown
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'A prompt/description is required.' })
  }
  if (mode !== 'autopilot' && mode !== 'manual') {
    return res.status(400).json({ error: 'mode must be "autopilot" or "manual".' })
  }
  if (aspectRatio && !VALID_ASPECTS.includes(aspectRatio as string)) {
    return res.status(400).json({ error: `aspectRatio must be one of ${VALID_ASPECTS.join(', ')}` })
  }
  if (targetDuration && !VALID_DURATIONS.includes(targetDuration as string)) {
    return res.status(400).json({ error: `targetDuration must be one of ${VALID_DURATIONS.join(', ')}` })
  }

  // On multipart requests every non-file field arrives as a string, so the
  // platforms array is JSON-encoded by the client and parsed back out here.
  // On plain JSON requests it's already a real array.
  let platforms: unknown = body.platforms
  if (typeof platforms === 'string') {
    try {
      platforms = JSON.parse(platforms)
    } catch {
      platforms = []
    }
  }

  // Under `.fields()`, req.files is keyed by field name instead of a flat array.
  const filesByField = (req.files as Record<string, Express.Multer.File[]> | undefined) || {}

  // An uploaded thumbnail file takes priority over a search-result URL if somehow both arrive.
  let thumbnailImage: { buffer: Buffer; mimeType: string } | undefined
  const uploadedThumbnail = (filesByField.thumbnailFile || [])[0]
  if (uploadedThumbnail && uploadedThumbnail.mimetype.startsWith('image/')) {
    thumbnailImage = { buffer: uploadedThumbnail.buffer, mimeType: uploadedThumbnail.mimetype }
  } else if (typeof body.thumbnailImageUrl === 'string' && body.thumbnailImageUrl.trim()) {
    try {
      thumbnailImage = await downloadImageBuffer(body.thumbnailImageUrl.trim())
    } catch (err) {
      console.error(
        `[videos] failed to fetch selected thumbnail image ${body.thumbnailImageUrl}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  try {
    const video = await initiateVideoGeneration({
      userId: req.userId!,
      channelId: (channelId as string) || null,
      mode,
      prompt: prompt.trim(),
      voiceStyle: typeof voiceStyle === 'string' ? voiceStyle : undefined,
      voiceProfileId: typeof voiceProfileId === 'string' && voiceProfileId.trim() ? voiceProfileId.trim() : undefined,
      // Leave unset rather than forcing '9:16' here: for autopilot mode,
      // initiateVideoGeneration auto-picks the next size from the channel's
      // aspect_ratio_mix when this is omitted (see videoPipeline.ts's
      // pickNextAspectRatio). It still falls back to '9:16' itself if
      // there's no channel to resolve a mix from. Manual mode (Create Video)
      // always sends an explicit aspectRatio anyway.
      aspectRatio: (aspectRatio as any) || undefined,
      targetDuration: (targetDuration as any) || DEFAULT_TARGET_DURATION,
      platforms: Array.isArray(platforms) ? platforms.filter((p) => p === 'youtube' || p === 'instagram') : [],
      thumbnailImage,
    })
    res.status(201).json({ video })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to start video generation.' })
  }
})

// POST /api/videos/:id/post, posts an already-rendered video to one or more connected platforms.
router.post('/:id/post', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params
  const platforms: Platform[] = Array.isArray(req.body?.platforms)
    ? req.body.platforms.filter((p: unknown): p is Platform => p === 'youtube' || p === 'instagram')
    : []

  if (!platforms.length) {
    return res.status(400).json({ error: 'At least one platform is required.' })
  }

  const { data: video, error } = await supabaseAdmin
    .from('videos')
    .select('*')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single()

  if (error || !video) {
    return res.status(404).json({ error: 'Video not found.' })
  }
  if (!video.video_url) {
    return res.status(400).json({ error: 'This video is still generating, try again in a moment.' })
  }

  const results: Record<string, { status: 'posted' | 'failed'; url?: string | null; error?: string }> = {}

  for (const platform of platforms) {
    try {
      const { url } = await postVideoToPlatform({
        userId: req.userId!,
        videoId: video.id,
        platform,
        videoUrl: video.video_url,
        title: video.title || video.prompt,
        description: video.description || '',
        hashtags: video.hashtags || [],
      })
      results[platform] = { status: 'posted', url }
    } catch (err) {
      results[platform] = { status: 'failed', error: err instanceof Error ? err.message : 'Failed to post.' }
    }
  }

  const anySucceeded = Object.values(results).some((r) => r.status === 'posted')
  const now = new Date().toISOString()

  const mergedTargets = { ...(video.platform_targets || {}) }
  for (const [platform, result] of Object.entries(results)) {
    mergedTargets[platform] = {
      enabled: true,
      status: result.status,
      ...(result.url ? { url: result.url } : {}),
      ...(result.status === 'posted' ? { posted_at: now } : {}),
    }
  }

  await supabaseAdmin
    .from('videos')
    .update({
      platform_targets: mergedTargets,
      ...(anySucceeded ? { status: 'posted', posted_at: video.posted_at || now } : {}),
    })
    .eq('id', video.id)

  if (!anySucceeded) {
    const firstError = Object.values(results)[0]?.error || 'Failed to post to the selected platform(s).'
    return res.status(502).json({ error: firstError, results })
  }

  res.json({ ok: true, results })
})

// POST /api/videos/:id/schedule
router.post('/:id/schedule', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params
  const { scheduledAt } = req.body || {}

  if (typeof scheduledAt !== 'string' || Number.isNaN(Date.parse(scheduledAt))) {
    return res.status(400).json({ error: 'A valid scheduledAt ISO timestamp is required.' })
  }

  const { data: video, error } = await supabaseAdmin
    .from('videos')
    .select('id, status, video_url')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single()

  if (error || !video) {
    return res.status(404).json({ error: 'Video not found.' })
  }
  if (!video.video_url) {
    return res.status(400).json({ error: 'This video is still generating, try again in a moment.' })
  }

  await supabaseAdmin
    .from('videos')
    .update({ scheduled_at: scheduledAt, status: video.status === 'posted' ? video.status : 'scheduled' })
    .eq('id', id)

  res.json({ ok: true })
})

export default router
