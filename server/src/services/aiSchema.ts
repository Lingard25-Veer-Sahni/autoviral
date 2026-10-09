import { z } from 'zod/v4'
import type { GeneratedVideoContent } from '../types.js'

// Shared across every AI provider (Kimi, Mistral, OpenRouter, ...) so the
// schema, system prompt, and user-prompt construction only exist once —
// provider modules (aiClaude.ts, aiOpenAICompatible.ts) just plug this into
// whatever structured-output mechanism that provider's API offers.

// A short video is broken into scenes. Each scene becomes one rendered frame
// (via @napi-rs/canvas / stock footage / Remotion) held on screen for
// `duration_seconds`, narrated aloud via TTS, then muxed together with
// ffmpeg into the final .mp4.
export const sceneSchema = z.object({
  narration: z
    .string()
    .describe('The exact sentence(s) to be spoken aloud by the narrator for this scene. Punchy, natural spoken language, no stage directions.'),
  on_screen_text: z
    .string()
    .describe('Short (max ~8 words) bold text overlay to display on screen during this scene, for viewers watching muted.'),
  visual_prompt: z
    .string()
    .describe('A vivid, concrete visual description of what this scene should look like — subject, setting, mood, color palette, camera framing. Used to art-direct the generated frame.'),
  duration_seconds: z
    .number()
    .min(2)
    .max(10)
    .describe('How long this scene stays on screen, in seconds.'),
})

export const videoContentSchema = z.object({
  script: z
    .array(sceneSchema)
    .min(2)
    .max(30)
    .describe('The full scene-by-scene script for the video, in order.'),
  title: z
    .string()
    .max(100)
    .describe('An attention-grabbing, click-worthy title for the video, under 100 characters.'),
  description: z
    .string()
    .max(2000)
    .describe('A compelling video description for the post caption, 1-4 sentences, optionally with a call to action. Do not include hashtags here.'),
  hashtags: z
    .array(z.string())
    .min(6)
    .max(15)
    .describe('Relevant, trending-style hashtags WITHOUT the leading # symbol, lowercase, no spaces.'),
})

export const SYSTEM_PROMPT = `You are Autoviral's in-house short-form video creative director. You write scripts for \
vertical videos (YouTube Shorts / Instagram Reels / longer-form vertical explainers and documentary-style \
segments, ranging from roughly 10 seconds up to 30 minutes depending on the requested length) designed to \
be generated automatically: a text-to-speech narrator reads the narration for each scene while a branded \
frame is shown on screen, then all scenes are stitched together into one video.

Rules for every script you write:
- Hook the viewer in the first scene's first sentence — no slow intros.
- Keep narration conversational and easy to read aloud by a TTS engine: no special characters, no emoji, \
no markdown, no parenthetical stage directions.
- Hit the requested target video length below as closely as you can — do not default to a short script \
when a longer one is requested, and do not pad a short request out with filler.
- on_screen_text must be short and punchy, safe to render large on screen (max ~8 words).
- visual_prompt should describe a single clear visual concept per scene (it is used to art-direct a \
generated background frame, not a live-action shoot) — describe subject, setting, mood, and color palette.
- Titles must be scroll-stopping but not misleading clickbait, under 100 characters.
- Descriptions should read naturally, end with a light call to action, and must NOT contain hashtags.
- Hashtags should be lowercase, no # symbol, a realistic mix of broad + niche + branded tags.
- If the user prompt lists topics/titles this channel has already covered, you MUST pick a genuinely \
different topic, subtopic, or angle — never reuse or lightly reword one you were told to avoid. Repeating a \
topic that was explicitly called out as already covered is a hard failure, not a style preference.

Always produce output that matches the required JSON schema exactly.`

// --- Pricing formula -------------------------------------------------------
// Real-world value of one credit in USD. Chosen so the cheapest tier lands on
// a clean small whole-number credit cost. If you change this, also update
// the Razorpay PACKS pricing in routes/payments.ts so credit packs are sold
// at a rate that still covers this cost basis (they are NOT currently priced
// consistently with this — see the comment there).
export const USD_PER_CREDIT = 0.1

/**
 * Converts a raw per-attempt generation cost estimate into a credit price,
 * accounting for two real-world facts about this pipeline:
 *
 *  1. Generation failures still cost money (AI tokens + partial render time
 *     spent before failing) but earn nothing — refunded credits come out of
 *     the business's pocket, not the user's. Assuming roughly 1-in-2
 *     generations fails (see reconcileStuckVideos/refundCredit in
 *     videoPipeline.ts), the business must recoup TWO attempts' worth of
 *     cost for every ONE successful video sold. That's a 2x multiplier.
 *  2. On top of recouping that real (failure-adjusted) cost, margin must be
 *     2x the cost itself — i.e. the charge is cost + 2*cost = 3x the
 *     failure-adjusted cost.
 *
 * Combined: price = rawCost * 2 (failure) * 3 (cost + 2x profit) = rawCost * 6.
 * Example matching the $1 raw-cost -> $6 charge case: 1 * 2 * 3 = 6. ✓.
 * Rounded UP to the nearest whole credit (never undercharge on rounding),
 * minimum 1 credit.
 */
export function creditsForEstimatedCost(rawCostUsd: number): number {
  const chargeUsd = rawCostUsd * 2 * 3
  return Math.max(1, Math.ceil(chargeUsd / USD_PER_CREDIT))
}

export type TargetDuration = '10-30s' | '30-60s' | '60-90s'

export const DEFAULT_TARGET_DURATION: TargetDuration = '30-60s'

// Capped at 90s max (see CreateVideo.tsx) — longer presets were removed
// because generation cost scales with length (more AI script tokens, more
// TTS characters, bigger render/compositing time, bigger storage file), and
// past ~90s the pay-per-use storage/compute cost stops being something a
// flat low credit price can safely cover without real risk of losing money
// on a single video. Re-add longer tiers only after re-deriving their
// `credits` cost with the same formula below.
//
// Real per-scene screen time is always driven by actual synthesized TTS
// narration length (see remotionRender.ts/stockRender.ts/render.ts, which
// each measure real audio via `getAudioDurationSeconds()`), never by the
// AI's `duration_seconds` estimate — so the only two levers that actually
// change final video length are scene *count* and how much the AI writes
// per scene's narration. This preset table steers both via the prompt.
//
// `credits` is what generating a video at that length actually costs the
// user (see videoPipeline.ts's `initiateVideoGeneration`, the only place
// this is charged/refunded), and is derived — not guessed — from
// `estimatedCostUsd` via `creditsForEstimatedCost()` below. See that
// function for the full pricing formula (accounts for the ~50% generation
// failure rate and a 2x profit margin on top of true cost).
export const TARGET_DURATION_PRESETS: Record<
  TargetDuration,
  {
    label: string
    sceneRange: string
    secondsHint: string
    narrationHint: string
    /**
     * Rough real cost (USD) of ONE generation attempt at this length:
     * AI script tokens (cheap pay-per-use OpenRouter model, see
     * OPENROUTER_MODEL in .env) + TTS + pay-per-use object storage (e.g.
     * Cloudflare R2, priced per GB actually stored/transferred, not a flat
     * subscription) + a nominal render-compute slice. These are estimates —
     * update them once real per-tier cost is measured in production, then
     * `credits` below (computed, not hardcoded) will automatically follow.
     */
    estimatedCostUsd: number
    credits: number
  }
> = {
  '10-30s': {
    label: '10–30 sec',
    sceneRange: '2-3 scenes',
    secondsHint: 'roughly 10-30 seconds total',
    narrationHint: 'one short, punchy sentence of narration per scene — get straight to the point',
    estimatedCostUsd: 0.03,
    credits: creditsForEstimatedCost(0.03),
  },
  '30-60s': {
    label: '30–60 sec',
    sceneRange: '4-6 scenes',
    secondsHint: 'roughly 30-60 seconds total',
    narrationHint: 'one to two sentences of narration per scene',
    estimatedCostUsd: 0.06,
    credits: creditsForEstimatedCost(0.06),
  },
  '60-90s': {
    label: '60–90 sec',
    sceneRange: '6-9 scenes',
    secondsHint: 'roughly 60-90 seconds total',
    narrationHint: 'two to three sentences of narration per scene',
    estimatedCostUsd: 0.1,
    credits: creditsForEstimatedCost(0.1),
  },
}

/** Real (non-simulated) cost lookup — the single source of truth `videoPipeline.ts` charges/refunds against. */
export function creditsCostForDuration(targetDuration?: TargetDuration): number {
  return TARGET_DURATION_PRESETS[targetDuration || DEFAULT_TARGET_DURATION].credits
}

export interface GenerateVideoContentInput {
  /** The channel niche description (autopilot mode) or the specific video prompt (manual mode). */
  prompt: string
  mode: 'autopilot' | 'manual'
  voiceStyle?: string
  aspectRatio?: string
  platforms?: string[]
  /** Approximate target runtime preset — steers scene count + narration length, since real duration is TTS-driven, not exact-second-settable. Defaults to DEFAULT_TARGET_DURATION when omitted. */
  targetDuration?: TargetDuration
  /** Titles of this channel's most recent autopilot videos (newest first) — used to hard-block topic repeats across generations. Autopilot-only; omitted for manual one-off videos. */
  recentTopics?: string[]
  /** True for the account-holder's own admin account (profiles.role === 'admin') — routes OpenRouter generation to the free model instead of the paid one. See aiOpenAICompatible.ts's PROVIDERS.openrouter.freeModel. */
  isAdmin?: boolean
}

export function buildUserPrompt(input: GenerateVideoContentInput): string {
  const { prompt, mode, voiceStyle, aspectRatio, platforms, targetDuration, recentTopics } = input
  const duration = TARGET_DURATION_PRESETS[targetDuration || DEFAULT_TARGET_DURATION]

  const userPrompt =
    mode === 'autopilot'
      ? `This channel's niche/theme, described by the creator, is:\n"""\n${prompt}\n"""\n\n` +
        `Write ONE brand-new short video script for this channel. Pick a fresh, specific angle within the \
niche (do not just restate the niche description) so repeated calls produce varied videos over time.`
      : `The creator wants a video about:\n"""\n${prompt}\n"""\n\n` +
        `Write a short video script that brings this idea to life.`

  const contextLines = [
    voiceStyle ? `Narration voice style: ${voiceStyle}.` : null,
    aspectRatio ? `Target aspect ratio: ${aspectRatio}.` : null,
    platforms && platforms.length ? `Target platform(s): ${platforms.join(', ')}.` : null,
    `Target video length: ${duration.secondsHint} — write ${duration.sceneRange}, with ${duration.narrationHint}.`,
  ].filter(Boolean)

  const avoidRepeatsBlock =
    recentTopics && recentTopics.length
      ? `\n\nThis channel already has videos covering these exact topics/titles — you MUST NOT repeat any of \
them or write something that's substantially the same angle. Pick a genuinely different topic, subtopic, or \
angle within the niche instead:\n${recentTopics.map((t) => `- ${t}`).join('\n')}`
      : ''

  return (contextLines.length ? `${userPrompt}\n\n${contextLines.join('\n')}` : userPrompt) + avoidRepeatsBlock
}

export type { GeneratedVideoContent }
