import { supabaseAdmin } from '../supabaseAdmin.js'
import { generateVideoContent } from './ai.js'
import { creditsCostForDuration, type TargetDuration } from './aiSchema.js'
import { renderVideo, renderThumbnailFromImage, ASPECT_SIZES, type AspectRatio } from './render.js'
import { renderStockVideo } from './stockRender.js'
import { renderRemotionVideo } from './remotionRender.js'
import { pexelsConfigured } from './stockFootage.js'
import { uploadToStorage, deleteFromStorage } from './storage.js'
import { notifyUser, videoFailedNotification } from './notifications.js'
import type { GeneratedVideoContent } from '../types.js'

/** Real (non-simulated) progress-report hook: fraction/label -> absolute 0..100 DB write. */
type ProgressReporter = (fraction: number, label: string) => void | Promise<void>

// Which rendering engine actually produces the .mp4: "stock" (default, ffmpeg
// filter-graph compositing — battle-tested, no headless-Chromium dependency),
// "remotion" (real React-driven animated captions + Ken Burns pans, rendered
// via @remotion/renderer's headless Chromium), or "canvas" (the original
// fully-synthetic branded-background fallback). Set RENDER_ENGINE in
// server/.env to opt in to Remotion once you've confirmed it renders cleanly
// in your environment (see SETUP.md).
const RENDER_ENGINE = (process.env.RENDER_ENGINE || 'stock').trim().toLowerCase()

// Video generation is CPU/GPU-heavy, and narration for a cloned voice hits a
// single local Voicebox instance doing real model inference on this same
// machine. Running several pipelines at once (e.g. multiple autopilot
// channels due in the same tick, or "Generate all now" firing N videos back
// to back) was confirmed in production logs to reliably cause Voicebox
// 500s/timeouts under the resulting resource contention -- every one of
// which makes synthesizeNarration() silently fall back to the generic
// preset voice instead of the requested cloned voice, and separately causes
// Remotion delayRender timeouts. Routing every generation through this
// small in-process queue instead of firing runGenerationPipeline
// immediately/concurrently serializes pipeline execution, which fixes both.
// Configurable via MAX_CONCURRENT_GENERATIONS for beefier machines; defaults
// to 1 (safest, and what actually recovered reliable cloned-voice narration
// in testing).
const MAX_CONCURRENT_GENERATIONS = Math.max(1, Number(process.env.MAX_CONCURRENT_GENERATIONS) || 1)
const generationQueue: Array<() => Promise<void>> = []
let activeGenerations = 0

function enqueueGeneration(task: () => Promise<void>) {
  generationQueue.push(task)
  drainGenerationQueue()
}

function drainGenerationQueue() {
  while (activeGenerations < MAX_CONCURRENT_GENERATIONS && generationQueue.length) {
    const task = generationQueue.shift()!
    activeGenerations++
    task().finally(() => {
      activeGenerations--
      drainGenerationQueue()
    })
  }
}

// Fixed iteration order for flattening a channel's aspect-ratio mix into a
// round-robin sequence (object key order in JSON isn't guaranteed stable
// enough to rely on for this).
const ASPECT_RATIO_ORDER: AspectRatio[] = ['9:16', '16:9', '1:1']

/** Turns {"9:16": 4, "16:9": 2} into ['9:16','9:16','9:16','9:16','16:9','16:9']. Falls back to all-9:16 if the mix is empty/missing. */
function flattenAspectMix(mix: Partial<Record<AspectRatio, number>> | null | undefined): AspectRatio[] {
  const sequence: AspectRatio[] = []
  for (const ratio of ASPECT_RATIO_ORDER) {
    const count = Math.max(0, Math.floor(Number(mix?.[ratio]) || 0))
    for (let i = 0; i < count; i++) sequence.push(ratio)
  }
  return sequence.length ? sequence : ['9:16']
}

/**
 * Cycles an autopilot channel through its configured aspect-ratio mix (e.g.
 * 4 reels + 2 landscape/day) so consecutive generations rotate through every
 * size the user asked for instead of always landing on 9:16.
 * `channels.aspect_ratio_cursor` persists the position between calls.
 */
async function pickNextAspectRatio(channelId: string): Promise<AspectRatio> {
  const { data: channelRow } = await supabaseAdmin
    .from('channels')
    .select('aspect_ratio_mix, aspect_ratio_cursor')
    .eq('id', channelId)
    .single()

  const sequence = flattenAspectMix(channelRow?.aspect_ratio_mix as Partial<Record<AspectRatio, number>> | undefined)
  const cursor = channelRow?.aspect_ratio_cursor ?? 0
  const aspectRatio = sequence[cursor % sequence.length]

  await supabaseAdmin
    .from('channels')
    .update({ aspect_ratio_cursor: cursor + 1 })
    .eq('id', channelId)

  return aspectRatio
}

/** The account-wide default cloned voice (see routes/voices.ts's PATCH /:id/default), if the user has one ready. */
async function resolveDefaultVoiceProfileId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('voice_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .eq('status', 'ready')
    .maybeSingle()
  return data?.id ?? null
}

export interface GenerateVideoParams {
  userId: string
  channelId?: string | null
  mode: 'autopilot' | 'manual'
  prompt: string
  voiceStyle?: string
  /** A user's own cloned voice — our `voice_profiles.id`, resolved to Voicebox's own profile id inside runGenerationPipeline right before rendering. Overrides voiceStyle's preset chain when set and ready. */
  voiceProfileId?: string | null
  aspectRatio?: AspectRatio
  /** Target runtime preset (e.g. '30-60s', '5-10m') — steers the AI script's scene count/narration length, and directly determines the credits charged (see aiSchema.ts's TARGET_DURATION_PRESETS). Real per-scene timing is always TTS-audio-derived, not exact-second-settable. Defaults to DEFAULT_TARGET_DURATION. */
  targetDuration?: TargetDuration
  /** Platforms the finished video should be queued up to post to (from the create form / channel config). */
  platforms?: string[]
  /**
   * A user-chosen thumbnail background image (manual create form). When
   * present, the (AI-generated) title is composited on top of it via
   * `renderThumbnailFromImage` and the result overrides whatever synthetic
   * thumbnail the render engine produced -- independent of which render
   * engine actually rendered the video itself.
   */
  thumbnailImage?: { buffer: Buffer; mimeType: string }
  /** Resolved inside initiateVideoGeneration from profiles.role — never set by callers. True exempts this generation from the credit charge and routes AI script generation to the free model instead of the paid one. */
  isAdmin?: boolean
}

/**
 * Validates the user has enough credits for the requested video length,
 * deducts that amount immediately, and inserts a `videos` row in
 * `generating` status. The heavy AI + render work happens afterwards in
 * `runGenerationPipeline`, kicked off in the background so the HTTP request
 * can return immediately and the client can watch progress via Supabase
 * realtime.
 */
export async function initiateVideoGeneration(params: GenerateVideoParams) {
  // Real (non-flat) cost: longer target-duration presets mean more scenes,
  // more AI script tokens, more TTS characters synthesized, and more render
  // time — see aiSchema.ts's TARGET_DURATION_PRESETS for the full pricing
  // rationale. This is the one place that cost is charged (never refunded —
  // see the no-refund policy in notifications.ts).
  const creditsCost = creditsCostForDuration(params.targetDuration)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('credits, suspended, role')
    .eq('id', params.userId)
    .single()

  if (profileError || !profile) {
    throw new Error('Could not load your account. Please try again.')
  }
  if (profile.suspended) {
    throw new Error('Your account is suspended. Contact support.')
  }
  // The admin account (profiles.role === 'admin') generates for free: no
  // credit charge, and (see runGenerationPipeline's generateVideoContent
  // call) the free OpenRouter model instead of the paid one. Every other
  // account pays real credits, priced to cover the real paid-model + TTS +
  // storage cost (see aiSchema.ts's creditsForEstimatedCost).
  const isAdmin = profile.role === 'admin'
  if (!isAdmin && profile.credits < creditsCost) {
    throw new Error(
      `This video length costs ${creditsCost} credit${creditsCost === 1 ? '' : 's'} and you have ${profile.credits}. Buy more credits or pick a shorter length.`
    )
  }

  const platformTargets: Record<string, { enabled: boolean; status: string }> = {}
  for (const platform of params.platforms || []) {
    platformTargets[platform] = { enabled: true, status: 'pending' }
  }

  // Autopilot callers (the scheduler's cron tick, and the "Generate one/all
  // now" buttons) don't have to know about the account's default voice or a
  // channel's requested size mix -- resolve both here, once, so every
  // autopilot entry point behaves identically. Manual generations always
  // pass their own explicit voiceProfileId/aspectRatio (or omit them
  // deliberately), so this only fills gaps for mode === 'autopilot'.
  let voiceProfileId = params.voiceProfileId ?? null
  let aspectRatio = params.aspectRatio
  if (params.mode === 'autopilot') {
    if (!voiceProfileId) {
      voiceProfileId = await resolveDefaultVoiceProfileId(params.userId)
    }
    if (!aspectRatio && params.channelId) {
      aspectRatio = await pickNextAspectRatio(params.channelId)
    }
  }
  const resolvedParams: GenerateVideoParams = { ...params, voiceProfileId, aspectRatio, isAdmin }

  const { data: video, error: insertError } = await supabaseAdmin
    .from('videos')
    .insert({
      user_id: params.userId,
      channel_id: params.channelId || null,
      mode: params.mode,
      prompt: params.prompt,
      status: 'generating',
      aspect_ratio: aspectRatio || '9:16',
      platform_targets: platformTargets,
      credits_cost: isAdmin ? 0 : creditsCost,
      voice_profile_id: voiceProfileId,
    })
    .select()
    .single()

  if (insertError || !video) {
    throw new Error(insertError?.message || 'Failed to create the video record.')
  }

  if (!isAdmin) {
    await supabaseAdmin
      .from('profiles')
      .update({ credits: profile.credits - creditsCost })
      .eq('id', params.userId)

    await supabaseAdmin.from('credit_transactions').insert({
      user_id: params.userId,
      amount: -creditsCost,
      reason: 'video_generation',
      meta: { video_id: video.id, target_duration: params.targetDuration || null },
    })
  }

  // Fire-and-forget: the caller (HTTP route or scheduler) does not await this.
  // Uses resolvedParams (not the raw params) so the pipeline renders with the
  // same voice/aspect ratio that was actually persisted on the video row above.
  // Routed through enqueueGeneration() (not called directly) so it's serialized
  // against every other in-flight generation on this process -- see the
  // MAX_CONCURRENT_GENERATIONS comment above for why that matters.
  enqueueGeneration(() =>
    runGenerationPipeline(video.id, resolvedParams).catch((err) => {
      console.error(`[pipeline] video ${video.id} failed:`, err)
    })
  )

  return video
}

// How many of a user's oldest "ready" videos get pruned per automatic
// cleanup cycle (see maybeRunStorageCleanup below).
const STORAGE_CLEANUP_BATCH_SIZE = 5
const STORAGE_CLEANUP_NUDGE_AT = 10
const STORAGE_CLEANUP_AUTO_AT = 15

/**
 * Best-effort storage-pressure management, called after every successful
 * generation (see the "ready" update above in runGenerationPipeline).
 * Tracks a per-account counter (`profiles.videos_since_cleanup`, see
 * supabase/migrations/0008_storage_cleanup_counter.sql) of videos generated
 * since the last cleanup:
 *
 *  - every 10: fires an in-app notification asking the user to free up
 *    storage themselves (delete old videos they still want to choose from).
 *  - every 15: automatically deletes the account's oldest 5 "ready" videos
 *    (storage file + DB row) to free up space, then notifies the user that
 *    it did so. Counter resets to 0 immediately after.
 *
 * Never throws — callers treat this as fire-and-forget housekeeping that
 * must not affect the generation that just succeeded.
 */
async function maybeRunStorageCleanup(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('videos_since_cleanup')
    .eq('id', userId)
    .single()
  if (!profile) return

  const count = (profile.videos_since_cleanup || 0) + 1

  if (count >= STORAGE_CLEANUP_AUTO_AT) {
    const { data: oldest } = await supabaseAdmin
      .from('videos')
      .select('id, video_url, thumbnail_url')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: true })
      .limit(STORAGE_CLEANUP_BATCH_SIZE)

    let deletedCount = 0
    for (const video of oldest || []) {
      await deleteFromStorage(video.video_url)
      await deleteFromStorage(video.thumbnail_url)
      const { error } = await supabaseAdmin.from('videos').delete().eq('id', video.id)
      if (!error) deletedCount++
    }

    await supabaseAdmin.from('profiles').update({ videos_since_cleanup: 0 }).eq('id', userId)

    await notifyUser(userId, {
      type: 'info',
      title: 'Storage cleaned up automatically',
      message:
        deletedCount > 0
          ? `To keep making room for new videos, we automatically removed your ${deletedCount} oldest video${deletedCount === 1 ? '' : 's'}. Download anything important beforehand next time, or update your storage manually before this happens again.`
          : `Storage cleanup ran, but there were no older videos eligible to remove.`,
    })
    return
  }

  await supabaseAdmin.from('profiles').update({ videos_since_cleanup: count }).eq('id', userId)

  if (count === STORAGE_CLEANUP_NUDGE_AT) {
    await notifyUser(userId, {
      type: 'info',
      title: 'Update your storage',
      message: `You've generated ${STORAGE_CLEANUP_NUDGE_AT} videos since your last cleanup. Delete some old videos you no longer need to free up space — otherwise we'll automatically remove your oldest ${STORAGE_CLEANUP_BATCH_SIZE} videos after ${STORAGE_CLEANUP_AUTO_AT}.`,
    })
  }
}

// A video stuck in "generating" past this many minutes is treated as
// orphaned. This pipeline runs runGenerationPipeline() fire-and-forget
// in-process (see initiateVideoGeneration above) with no job queue or
// checkpointing — if the server process dies mid-render (crash, deploy, or a
// dev restart from `tsx watch` picking up a file save) the in-flight promise
// is killed outright and never reaches the try/catch that would normally
// mark the row 'failed' and refund credits. The row is left at whatever
// progress it had reached, forever. Configurable via
// STUCK_VIDEO_TIMEOUT_MINUTES; defaults comfortably above the slowest real
// render (the 10-30m preset) to avoid flagging a video that's still
// genuinely in progress.
const STUCK_VIDEO_TIMEOUT_MINUTES = Number(process.env.STUCK_VIDEO_TIMEOUT_MINUTES) || 45

/**
 * Sweeps for videos abandoned mid-generation (see STUCK_VIDEO_TIMEOUT_MINUTES
 * above) and marks them failed + refunds whatever credits were charged.
 * Called once at server boot and then every minute from the scheduler's
 * cron tick, so an orphaned row gets cleaned up within
 * ~STUCK_VIDEO_TIMEOUT_MINUTES of the process that abandoned it dying.
 */
export async function reconcileStuckVideos(): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_VIDEO_TIMEOUT_MINUTES * 60 * 1000).toISOString()
  const { data: stuck, error } = await supabaseAdmin
    .from('videos')
    .select('id, user_id, credits_cost, created_at')
    .eq('status', 'generating')
    .lt('created_at', cutoff)

  if (error) {
    console.error('[pipeline] failed to query for stuck videos:', error.message)
    return
  }
  if (!stuck?.length) return

  for (const video of stuck) {
    console.error(
      `[pipeline] video ${video.id}: stuck in "generating" since ${video.created_at} — marking failed (no refund, per no-refund policy).`
    )
    await supabaseAdmin
      .from('videos')
      .update({
        status: 'failed',
        error_message:
          'Generation was interrupted (the server restarted mid-render). Per our Terms & Conditions, credits spent on a failed generation are not refunded — please try again.',
      })
      .eq('id', video.id)
    const { title, message } = videoFailedNotification('the server restarted mid-render and generation was interrupted.')
    await notifyUser(video.user_id, { type: 'video_failed', title, message, videoId: video.id })
  }
}

/**
 * The default engine: real stock-footage compositing (genuine filmed
 * footage, not synthetic backgrounds). Falls back to the fully-synthetic
 * canvas renderer only if the stock pipeline itself throws (e.g. ffmpeg
 * failure unrelated to footage availability) — per-scene "no clip found"
 * cases are already handled inside renderStockVideo via a branded background.
 */
async function renderStockVideoWithCanvasFallback(
  videoId: string,
  content: GeneratedVideoContent,
  params: GenerateVideoParams,
  voiceboxProfileId: string | undefined,
  onProgress?: ProgressReporter
): Promise<{ videoBuffer: Buffer; thumbnailBuffer: Buffer; durationSeconds: number }> {
  try {
    const result = await renderStockVideo({
      content,
      aspectRatio: params.aspectRatio,
      voiceStyle: params.voiceStyle,
      voiceProfileId: voiceboxProfileId,
      onProgress,
    })
    if (!pexelsConfigured) {
      console.warn(
        `[pipeline] video ${videoId}: PEXELS_API_KEY not set — rendered with branded backgrounds only (no real stock footage). Add a free key at pexels.com/api for real footage.`
      )
    } else {
      console.log(`[pipeline] video ${videoId}: ${result.stockFootageScenes}/${result.totalScenes} scenes used real stock footage.`)
    }
    return result
  } catch (err) {
    console.error(`[pipeline] video ${videoId}: stock-footage render failed, falling back to canvas engine:`, err instanceof Error ? err.message : err)
    return renderVideo({
      content,
      aspectRatio: params.aspectRatio,
      voiceStyle: params.voiceStyle,
      voiceProfileId: voiceboxProfileId,
      onProgress,
    })
  }
}

/**
 * Real (non-simulated) progress reporting: only writes to the DB when the
 * rounded integer percentage actually changes, to avoid hammering Supabase
 * with a write on every single onProgress tick (Remotion's renderMedia in
 * particular can fire many times per second). Capped at 99 here -- the
 * final `status: 'ready', progress: 100` write happens once, at the very
 * end, alongside all the other final fields.
 */
function makeProgressReporter(videoId: string): ProgressReporter {
  let lastReported = -1
  return async (fraction: number, label: string) => {
    const percent = Math.min(99, Math.max(0, Math.round(fraction * 100)))
    if (percent === lastReported) return
    lastReported = percent
    try {
      await supabaseAdmin.from('videos').update({ progress: percent, progress_stage: label }).eq('id', videoId)
    } catch (err) {
      console.error(`[pipeline] video ${videoId}: failed to write progress update:`, err instanceof Error ? err.message : err)
    }
  }
}

/** The real (non-mocked) pipeline: AI script -> render engine -> Supabase Storage upload -> DB update. */
export async function runGenerationPipeline(videoId: string, params: GenerateVideoParams): Promise<void> {
  const report = makeProgressReporter(videoId)
  // Render-engine work (script sourcing/asset prep/composite) is mapped into
  // the 15-88% band; script generation and upload get the remaining real
  // stage boundaries around it.
  const RENDER_BAND_START = 0.15
  const RENDER_BAND_SPAN = 0.73
  const reportRender: ProgressReporter = (fraction, label) =>
    report(RENDER_BAND_START + fraction * RENDER_BAND_SPAN, label)

  try {
    await report(0.02, 'Generating script')

    // Autopilot channels must never repeat a topic: pull this channel's
    // recent video titles (newest first, capped generously) and hand them to
    // the AI as a hard exclusion list so every generation picks a genuinely
    // new angle instead of drifting back over old ground.
    let recentTopics: string[] | undefined
    if (params.mode === 'autopilot' && params.channelId) {
      const { data: pastVideos } = await supabaseAdmin
        .from('videos')
        .select('title')
        .eq('channel_id', params.channelId)
        .not('title', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)
      recentTopics = (pastVideos || []).map((v) => v.title as string).filter(Boolean)
    }

    const content = await generateVideoContent({
      prompt: params.prompt,
      mode: params.mode,
      voiceStyle: params.voiceStyle,
      aspectRatio: params.aspectRatio,
      platforms: params.platforms,
      targetDuration: params.targetDuration,
      recentTopics,
      isAdmin: params.isAdmin,
    })
    await report(0.15, 'Sketching the plan')

    // A cloned voice is referenced by OUR `voice_profiles.id` on
    // params.voiceProfileId (that's what's stored on the video row and what
    // the frontend selects by) -- resolve it here to Voicebox's own profile
    // id, which is what synthesizeNarration()/Voicebox's API actually needs.
    // If the profile was deleted or never finished uploading a sample
    // (status != 'ready'), fall back to the normal preset-voice chain rather
    // than failing the whole generation.
    let voiceboxProfileId: string | undefined
    if (params.voiceProfileId) {
      const { data: voiceProfile } = await supabaseAdmin
        .from('voice_profiles')
        .select('voicebox_profile_id, status')
        .eq('id', params.voiceProfileId)
        .eq('user_id', params.userId)
        .single()
      if (voiceProfile?.status === 'ready') {
        voiceboxProfileId = voiceProfile.voicebox_profile_id
      } else {
        console.warn(
          `[pipeline] video ${videoId}: requested cloned voice ${params.voiceProfileId} is missing or not ready — using the default voice instead.`
        )
      }
    }

    // Primary path (RENDER_ENGINE=remotion): real Remotion rendering — same
    // real narration + real Pexels/Pixabay stock footage as the ffmpeg path
    // below, but with genuinely animated (spring-physics) captions and Ken
    // Burns pans, composited by headless Chromium instead of ffmpeg filter
    // graphs. Falls back to the ffmpeg stock-footage engine, then the
    // fully-synthetic canvas engine, if a given stage throws — a video
    // generation should degrade in quality before it fails outright.
    let rendered: { videoBuffer: Buffer; thumbnailBuffer: Buffer; durationSeconds: number }
    if (RENDER_ENGINE === 'remotion') {
      try {
        const result = await renderRemotionVideo({
          content,
          aspectRatio: params.aspectRatio,
          voiceStyle: params.voiceStyle,
          voiceProfileId: voiceboxProfileId,
          onProgress: reportRender,
        })
        rendered = result
        console.log(`[pipeline] video ${videoId}: rendered via Remotion (${result.stockFootageScenes}/${result.totalScenes} scenes used real stock footage).`)
      } catch (err) {
        console.error(`[pipeline] video ${videoId}: Remotion render failed, falling back to ffmpeg stock-footage engine:`, err instanceof Error ? err.message : err)
        rendered = await renderStockVideoWithCanvasFallback(videoId, content, params, voiceboxProfileId, reportRender)
      }
    } else if (RENDER_ENGINE === 'canvas') {
      rendered = await renderVideo({
        content,
        aspectRatio: params.aspectRatio,
        voiceStyle: params.voiceStyle,
        voiceProfileId: voiceboxProfileId,
        onProgress: reportRender,
      })
    } else {
      rendered = await renderStockVideoWithCanvasFallback(videoId, content, params, voiceboxProfileId, reportRender)
    }

    let { videoBuffer, thumbnailBuffer, durationSeconds } = rendered

    // A user-chosen thumbnail background overrides whatever synthetic
    // thumbnail the render engine produced, regardless of which engine
    // actually rendered the video -- composited here, once, centrally,
    // rather than duplicating image-compositing logic in all three engines.
    if (params.thumbnailImage) {
      try {
        const { width, height } = ASPECT_SIZES[params.aspectRatio || '9:16']
        thumbnailBuffer = await renderThumbnailFromImage(content.title, params.thumbnailImage.buffer, width, height)
      } catch (err) {
        console.error(`[pipeline] video ${videoId}: custom thumbnail compositing failed, keeping the engine's default thumbnail:`, err instanceof Error ? err.message : err)
      }
    }

    await report(0.9, 'Uploading video')

    const videoUrl = await uploadToStorage('videos', `${params.userId}/${videoId}.mp4`, videoBuffer, 'video/mp4')
    await report(0.96, 'Uploading thumbnail')
    const thumbnailUrl = await uploadToStorage(
      'thumbnails',
      `${params.userId}/${videoId}.png`,
      thumbnailBuffer,
      'image/png'
    )

    await supabaseAdmin
      .from('videos')
      .update({
        script: content.script,
        title: content.title,
        description: content.description,
        hashtags: content.hashtags,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration_seconds: durationSeconds,
        status: 'ready',
        progress: 100,
        progress_stage: 'Ready',
      })
      .eq('id', videoId)
    // Note: `channels.last_generated_at` for autopilot pacing is stamped by the
    // scheduler at trigger time (see services/scheduler.ts), not here — that
    // prevents the cron tick from re-triggering the same channel while a
    // single generation is still in flight.

    // Best-effort storage-pressure management: nudge (every 10) then
    // auto-prune (every 15) so a user's account doesn't silently accumulate
    // videos until they hit a provider's storage cap. Never allowed to fail
    // the generation that just succeeded.
    await maybeRunStorageCleanup(params.userId).catch((err) => {
      console.error(`[pipeline] storage-cleanup check failed for user ${params.userId}:`, err instanceof Error ? err.message : err)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during video generation.'
    await supabaseAdmin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    // No refund on failure — see the no-refund policy in notifications.ts's
    // videoFailedNotification and aiSchema.ts's pricing formula, which
    // already assumes ~50% of attempts fail and prices accordingly.
    const { title, message: notifyMessage } = videoFailedNotification(message)
    await notifyUser(params.userId, { type: 'video_failed', title, message: notifyMessage, videoId })
    throw err
  }
}
