import cron from 'node-cron'
import { supabaseAdmin } from '../supabaseAdmin.js'
import { initiateVideoGeneration, reconcileStuckVideos } from './videoPipeline.js'
import { postVideoToPlatform } from './socialPost.js'
import type { Platform } from '../types.js'

const DAY_MS = 24 * 60 * 60 * 1000

interface ChannelRow {
  id: string
  user_id: string
  niche_description: string
  videos_per_day: number
  platforms: string[]
  voice_style: string
  status: string
  last_generated_at: string | null
}

/** Autopilot: generate a fresh video for every active channel that's due, based on videos_per_day pacing. */
async function runAutopilotTick() {
  const { data: channels, error } = await supabaseAdmin
    .from('channels')
    .select('id, user_id, niche_description, videos_per_day, platforms, voice_style, status, last_generated_at')
    .eq('status', 'active')
    .eq('mode', 'autopilot')

  if (error || !channels?.length) return

  for (const channel of channels as ChannelRow[]) {
    const intervalMs = DAY_MS / Math.max(1, channel.videos_per_day)
    const due =
      !channel.last_generated_at || Date.now() - new Date(channel.last_generated_at).getTime() >= intervalMs

    if (!due) continue

    // Stamp last_generated_at optimistically *before* kicking off generation so a
    // fast-firing cron tick can't queue duplicate videos while the first is still rendering.
    await supabaseAdmin
      .from('channels')
      .update({ last_generated_at: new Date().toISOString() })
      .eq('id', channel.id)

    try {
      // voiceProfileId and aspectRatio are deliberately omitted here:
      // initiateVideoGeneration resolves both automatically for autopilot
      // mode (the account's default cloned voice, and the next size in this
      // channel's aspect_ratio_mix), see videoPipeline.ts.
      await initiateVideoGeneration({
        userId: channel.user_id,
        channelId: channel.id,
        mode: 'autopilot',
        prompt: channel.niche_description,
        voiceStyle: channel.voice_style,
        platforms: channel.platforms,
      })
    } catch (err) {
      console.error(`[scheduler] autopilot generation failed for channel ${channel.id}:`, err)
    }
  }
}

/** Publishes any video whose scheduled_at has arrived to every platform enabled on it. */
async function runScheduledPostsTick() {
  const { data: videos, error } = await supabaseAdmin
    .from('videos')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (error || !videos?.length) return

  for (const video of videos) {
    if (!video.video_url) continue

    interface PlatformTargetState {
      enabled?: boolean
      status?: string
      url?: string | null
      posted_at?: string
    }
    const targets = (video.platform_targets || {}) as Record<string, PlatformTargetState>
    const platformsToPost = (Object.keys(targets) as Platform[]).filter(
      (p) => targets[p]?.enabled && targets[p]?.status !== 'posted'
    )
    if (!platformsToPost.length) continue

    const mergedTargets: Record<string, PlatformTargetState> = { ...targets }
    let anySucceeded = false

    for (const platform of platformsToPost) {
      try {
        const { url } = await postVideoToPlatform({
          userId: video.user_id,
          videoId: video.id,
          platform,
          videoUrl: video.video_url,
          title: video.title || video.prompt,
          description: video.description || '',
          hashtags: video.hashtags || [],
        })
        mergedTargets[platform] = { enabled: true, status: 'posted', url, posted_at: new Date().toISOString() }
        anySucceeded = true
      } catch (err) {
        console.error(`[scheduler] scheduled post failed for video ${video.id} on ${platform}:`, err)
        mergedTargets[platform] = { enabled: true, status: 'failed' }
      }
    }

    await supabaseAdmin
      .from('videos')
      .update({
        platform_targets: mergedTargets,
        ...(anySucceeded ? { status: 'posted', posted_at: new Date().toISOString() } : {}),
      })
      .eq('id', video.id)
  }
}

let started = false

/** Starts the background cron jobs. Safe to call once at server boot. */
export function startScheduler() {
  if (started) return
  started = true

  // Run once immediately at boot so any video orphaned by a previous process
  // dying mid-render (crash, deploy, dev restart) gets cleaned up right away
  // instead of waiting for the first cron tick.
  reconcileStuckVideos().catch((err) => console.error('[scheduler] startup stuck-video reconciliation error:', err))

  // Every minute: cheap enough given both queries are small/filtered, and keeps
  // scheduled-post publishing and autopilot pacing feeling near-real-time.
  cron.schedule('* * * * *', () => {
    runAutopilotTick().catch((err) => console.error('[scheduler] autopilot tick error:', err))
    runScheduledPostsTick().catch((err) => console.error('[scheduler] scheduled posts tick error:', err))
    reconcileStuckVideos().catch((err) => console.error('[scheduler] stuck-video reconciliation error:', err))
  })

  console.log('[Autoviral server] Scheduler started (autopilot pacing + scheduled post publishing + stuck-video reconciliation, every minute).')
}
