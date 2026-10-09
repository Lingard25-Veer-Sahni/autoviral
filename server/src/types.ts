export type Platform = 'youtube' | 'instagram'

export interface VideoScriptScene {
  narration: string
  on_screen_text: string
  visual_prompt: string
  duration_seconds: number
}

export interface GeneratedVideoContent {
  script: VideoScriptScene[]
  title: string
  description: string
  hashtags: string[]
}
