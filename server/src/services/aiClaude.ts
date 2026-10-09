import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import 'dotenv/config'
import { videoContentSchema, SYSTEM_PROMPT, buildUserPrompt, type GenerateVideoContentInput } from './aiSchema.js'
import type { GeneratedVideoContent } from '../types.js'

const apiKey = process.env.ANTHROPIC_API_KEY
export const claudeConfigured = Boolean(apiKey)

if (!claudeConfigured) {
  console.warn('[Autoviral server] ANTHROPIC_API_KEY is missing, this AI provider is unavailable.')
}

const anthropic = new Anthropic({ apiKey: apiKey || 'placeholder-key' })

const MODEL = 'claude-opus-4-7'

/**
 * Real (non-mocked) script/title/description/hashtag generation via
 * Anthropic's API, using native structured outputs (`output_config.format`)
 * so the response is guaranteed to match `videoContentSchema`, no manual
 * JSON parsing needed.
 */
export async function generateVideoContentClaude(
  input: GenerateVideoContentInput
): Promise<GeneratedVideoContent> {
  if (!claudeConfigured) {
    throw new Error('This AI provider is not configured: missing ANTHROPIC_API_KEY on the server.')
  }

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
    output_config: {
      format: zodOutputFormat(videoContentSchema),
    },
  })

  const parsed = response.parsed_output
  if (!parsed) {
    throw new Error('The AI did not return a parseable video script.')
  }

  return parsed
}
