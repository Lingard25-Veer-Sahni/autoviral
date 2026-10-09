export type Role = 'user' | 'admin'
export type Plan = 'starter' | 'creator' | 'studio' | 'agency'
export type ChannelMode = 'autopilot' | 'manual'
export type VideoStatus =
  | 'queued'
  | 'generating'
  | 'ready'
  | 'scheduled'
  | 'posting'
  | 'posted'
  | 'failed'
export type Platform = 'youtube' | 'instagram'
export type AspectRatio = '9:16' | '16:9' | '1:1'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  credits: number
  plan: Plan
  onboarding_complete: boolean
  onboarding_step: 'mode' | 'channel' | 'connect' | 'credits' | 'done' | null
  suspended: boolean
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  user_id: string
  name: string
  niche_description: string
  mode: ChannelMode
  videos_per_day: number
  platforms: Platform[]
  voice_style: string
  /** How many videos/day to generate at each size, e.g. {"9:16": 4, "16:9": 2}. Sum should equal videos_per_day. */
  aspect_ratio_mix: Partial<Record<AspectRatio, number>>
  status: 'active' | 'paused'
  last_generated_at: string | null
  created_at: string
  updated_at: string
}

export interface PlatformTarget {
  enabled: boolean
  status?: 'pending' | 'posted' | 'failed'
  url?: string
  posted_at?: string
}

export interface VideoScriptScene {
  narration: string
  on_screen_text: string
  visual_prompt: string
  duration_seconds: number
}

export interface VideoRecord {
  id: string
  user_id: string
  channel_id: string | null
  mode: ChannelMode
  prompt: string
  script: VideoScriptScene[] | null
  title: string | null
  description: string | null
  hashtags: string[]
  status: VideoStatus
  error_message: string | null
  /** Real (non-simulated) 0-100 pipeline-progress percentage, only meaningful while status is "generating". */
  progress: number
  /** Human-readable label for whatever stage `progress` currently reflects, e.g. "Rendering scene 2 of 5". */
  progress_stage: string | null
  video_url: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  aspect_ratio: string
  scheduled_at: string | null
  posted_at: string | null
  platform_targets: Partial<Record<Platform, PlatformTarget>>
  credits_cost: number
  created_at: string
  updated_at: string
}

export interface SocialAccount {
  id: string
  user_id: string
  platform: Platform
  account_name: string | null
  avatar_url: string | null
  connected: boolean
  scopes: string[] | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  meta: Record<string, unknown>
  created_at: string
}

export type NotificationType = 'video_failed' | 'info'

export interface AppNotification {
  id: string
  user_id: string
  video_id: string | null
  type: NotificationType
  title: string
  message: string
  read: boolean
  created_at: string
}
