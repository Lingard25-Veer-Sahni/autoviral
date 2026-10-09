import OpenAI from 'openai'
import 'dotenv/config'
import { z } from 'zod/v4'
import {
  videoContentSchema,
  SYSTEM_PROMPT,
  buildUserPrompt,
  type GenerateVideoContentInput,
} from './aiSchema.js'
import type { GeneratedVideoContent } from '../types.js'

// Real (non-mocked) free/cheap AI providers for anyone who wants $0-to-start
// script generation: Moonshot AI's Kimi, Mistral, and OpenRouter all expose
// OpenAI-compatible chat completions endpoints, so we reuse the official
// `openai` SDK pointed at their base URLs instead of hand-rolling HTTP calls.
//
// None of the three has native structured-output parsing built into the SDK,
// so we ask for strict JSON via `response_format: json_object`,
// embed the JSON Schema derived from our zod schema directly in the system
// prompt as a contract, and validate the response ourselves — retrying once
// with the validation error fed back to the model if it doesn't match.

export type OpenAICompatibleProviderKey = 'kimi' | 'mistral' | 'openrouter'

export interface OpenAICompatibleProviderConfig {
  key: OpenAICompatibleProviderKey
  label: string
  apiKeyEnvVar: string
  baseURL: string
  model: string
  /** OpenRouter only: a genuinely free (":free"-suffixed) model reserved for
   * admin-account generations (see initiateVideoGeneration's is_admin
   * bypass) — admin usage never costs the business real per-token money,
   * while every paying user's generation uses `model` (a cheap paid model)
   * so real OpenRouter spend is backed by the credits that user purchased. */
  freeModel?: string
}

export const PROVIDERS: Record<OpenAICompatibleProviderKey, OpenAICompatibleProviderConfig> = {
  kimi: {
    key: 'kimi',
    label: 'Kimi (Moonshot AI)',
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
    baseURL: 'https://api.moonshot.ai/v1',
    model: process.env.KIMI_MODEL || 'kimi-k2.6',
  },
  mistral: {
    key: 'mistral',
    label: 'Mistral',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    baseURL: 'https://api.mistral.ai/v1',
    model: process.env.MISTRAL_MODEL || 'mistral-medium-latest',
  },
  openrouter: {
    key: 'openrouter',
    label: 'OpenRouter',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    // OpenRouter proxies many providers' models under one API/key, including a
    // rotating set of genuinely free (":free"-suffixed) models with no billing
    // at all. Free-tier models share a rate-limited upstream pool per model, so
    // availability varies by the minute AND providers can pull a model's free
    // tier entirely without warning (this happened to the previous default,
    // minimax/minimax-m3:free, which started 404ing with "unavailable for
    // free" and broke every autopilot generation) — nemotron-3-ultra-550b-a55b
    // tested reliably (3/3 real calls succeeded, ~15-25s each) when other
    // candidates were either rate-limited (google/gemma-4-31b-it:free -> 429)
    // or restricted to agentic harnesses only (thinkingmachines/inkling:free).
    // Override with OPENROUTER_MODEL to point at any other model slug
    // OpenRouter hosts if this one degrades or gets pulled too — see
    // src/scripts/testOpenRouterModels.ts / testOpenRouterReliability.ts for
    // the diagnostic scripts used to vet a replacement before hardcoding it.
    //
    // `model` is now a cheap PAID model by default (not ":free") — the free
    // tier gets rate-limited fast in production (observed ~50 req/day without
    // credits loaded on the OpenRouter account). Paying users' generations
    // use this; cost is already priced into creditsForEstimatedCost in
    // aiSchema.ts. `freeModel` below is reserved for admin-account use only.
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
    freeModel: process.env.OPENROUTER_MODEL_FREE || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  },
}

function apiKeyFor(config: OpenAICompatibleProviderConfig): string | undefined {
  return process.env[config.apiKeyEnvVar]
}

export const kimiConfigured = Boolean(apiKeyFor(PROVIDERS.kimi))
export const mistralConfigured = Boolean(apiKeyFor(PROVIDERS.mistral))
export const openrouterConfigured = Boolean(apiKeyFor(PROVIDERS.openrouter))

function clientFor(config: OpenAICompatibleProviderConfig): OpenAI {
  return new OpenAI({
    apiKey: apiKeyFor(config) || 'placeholder-key',
    baseURL: config.baseURL,
    // OpenRouter uses these two (optional, non-secret) headers purely for
    // attributing requests to an app on https://openrouter.ai/rankings — it
    // still works fine without them, this just identifies us properly.
    defaultHeaders:
      config.key === 'openrouter'
        ? { 'HTTP-Referer': 'https://autoviral.app', 'X-Title': 'Autoviral' }
        : undefined,
  })
}

// zod v4 can derive a JSON Schema straight from the same schema the AI
// provider's native structured-output path uses — keeps the "contract"
// identical across providers even though only some of them can enforce it
// natively.
const JSON_SCHEMA = JSON.stringify(z.toJSONSchema(videoContentSchema), null, 2)

function schemaContractPrompt(): string {
  return `Respond with ONLY a single raw JSON object — no markdown code fences, no commentary before or \
after it. The JSON object MUST validate against this JSON Schema:\n\n${JSON_SCHEMA}`
}

function extractJson(raw: string): unknown {
  // Some models wrap JSON in markdown fences despite instructions — strip them defensively.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : raw
  return JSON.parse(candidate.trim())
}

/**
 * Real (non-mocked) script/title/description/hashtag generation via any
 * OpenAI-compatible chat completions endpoint (Kimi, Mistral). JSON-mode +
 * zod validation stand in for native structured outputs, with one automatic
 * retry that feeds the validation error back to the model.
 */
export async function generateVideoContentOpenAICompatible(
  input: GenerateVideoContentInput,
  config: OpenAICompatibleProviderConfig
): Promise<GeneratedVideoContent> {
  if (!apiKeyFor(config)) {
    throw new Error(`${config.label} is not configured: missing ${config.apiKeyEnvVar} on the server.`)
  }

  const client = clientFor(config)
  const userPrompt = buildUserPrompt(input)
  // Admin-account generations use the free model (never costs the business
  // real token spend); everyone else uses the configured cheap paid model.
  const model = input.isAdmin && config.freeModel ? config.freeModel : config.model

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${schemaContractPrompt()}` },
    { role: 'user', content: userPrompt },
  ]

  let lastError = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      messages.push({
        role: 'user',
        content: `Your previous response failed schema validation with this error:\n${lastError}\n\n` +
          `Reply again with ONLY the corrected raw JSON object, matching the schema exactly.`,
      })
    }

    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.9,
    })

    // Some OpenAI-compatible providers (observed via OpenRouter routing to
    // certain upstream models) return a 200 with a malformed/error-shaped body
    // instead of throwing — `choices` itself can be missing, not just empty.
    // Guard the whole chain so that shows up as a clear retryable error
    // instead of an opaque "Cannot read properties of undefined" crash.
    const raw = completion?.choices?.[0]?.message?.content
    if (!raw) {
      lastError = `Model returned no usable content (raw response: ${JSON.stringify(completion).slice(0, 500)}).`
      continue
    }

    let candidate: unknown
    try {
      candidate = extractJson(raw)
    } catch (err) {
      lastError = `Response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`
      continue
    }

    const result = videoContentSchema.safeParse(candidate)
    if (result.success) {
      return result.data
    }
    lastError = result.error.message
  }

  throw new Error(`${config.label} did not return a schema-valid video script after retrying: ${lastError}`)
}
