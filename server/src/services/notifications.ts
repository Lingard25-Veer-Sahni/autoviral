import { supabaseAdmin } from '../supabaseAdmin.js'

export type NotificationType = 'video_failed' | 'info'

export interface NotifyUserOptions {
  type: NotificationType
  title: string
  message: string
  videoId?: string | null
}

/**
 * Inserts an in-app notification row for a user (see
 * supabase/migrations/0005_notifications.sql). Uses supabaseAdmin (the
 * service-role client), which is required — regular users have no INSERT
 * policy on this table by design; notifications are only ever
 * system-generated.
 *
 * Best-effort: a notification failing to write should never take down the
 * caller (e.g. the video-generation pipeline's failure handling, which is
 * itself already inside error-recovery code) — errors are logged, not
 * thrown.
 */
export async function notifyUser(userId: string, opts: NotifyUserOptions): Promise<void> {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    video_id: opts.videoId ?? null,
    type: opts.type,
    title: opts.title,
    message: opts.message,
  })
  if (error) {
    console.error(`[notifications] failed to create notification for user ${userId}:`, error.message)
  }
}

/**
 * Formats the standard "sorry, your video failed" copy used at every failure
 * point in videoPipeline.ts. Credits spent on a failed attempt are NOT
 * refunded (see the no-refund policy stated at signup / in Terms &
 * Conditions) — generation cost (AI tokens, TTS, partial render/storage) is
 * incurred by the business the moment an attempt starts, whether or not it
 * succeeds, so refunding would mean eating that cost with nothing to show
 * for it. This is accounted for up front in the pricing formula instead (see
 * aiSchema.ts's creditsForEstimatedCost — prices already assume ~50% of
 * attempts fail).
 */
export function videoFailedNotification(reason: string): { title: string; message: string } {
  return {
    title: "We're sorry — your video failed",
    message: `Something went wrong while generating your video: ${reason} Per our Terms & Conditions, credits spent on a failed generation are not refunded — please try again.`,
  }
}
