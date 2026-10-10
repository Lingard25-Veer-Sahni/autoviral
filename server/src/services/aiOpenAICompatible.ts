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
// prompt as a contract, and validate the response ourselves, retrying once
// with the validation error fed back to the model if it doesn't match.

export type OpenAICompatibleProviderKey = 'kimi' | 'mistral' | 'openrouter'

export interface OpenAICompatibleProviderConfig {
  key: OpenAICompatibleProviderKey
  label: string
  apiKeyEnvVar: string
  baseURL: string
  model: string
  /** OpenRouter only: a genuinely free (":free"-suffixed) model tried FIRST
   * for every generation (admin and paying users alike) to minimize real
   * token spend, falling back to `model` (a cheap paid model) only if the
   * free model errors or fails validation. See generateVideoContentOpenAICompatible. */
  freeModel?: string
  /** OpenRouter only: a SEPARATE API key used exclusively for the admin
   * account's free-model calls, decoupled from the main OPENROUTER_API_KEY
   * used by paying users' generations (including their paid fallback model).
   * This keeps admin usage from ever competing with paying users for the
   * same key's rate limits/quota, and means admin traffic is fully isolated
   * on its own OpenRouter account. Falls back to the main key if unset. */
  adminApiKeyEnvVar?: string
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
    // free" and broke every autopilot generation), nemotron-3-ultra-550b-a55b
    // tested reliably (3/3 real calls succeeded, ~15-25s each) when other
    // candidates were either rate-limited (google/gemma-4-31b-it:free -> 429)
    // or restricted to agentic harnesses only (thinkingmachines/inkling:free).
    // Override with OPENROUTER_MODEL to point at any other model slug
    // OpenRouter hosts if this one degrades or gets pulled too, see
    // src/scripts/testOpenRouterModels.ts / testOpenRouterReliability.ts for
    // the diagnostic scripts used to vet a replacement before hardcoding it.
    //
    // `model` is now a cheap PAID model by default (not ":free"), the free
    // tier gets rate-limited fast in production (observed ~50 req/day without
    // credits loaded on the OpenRouter account). Paying users' generations
    // use this; cost is already priced into creditsForEstimatedCost in
    // aiSchema.ts. `freeModel` below is reserved for admin-account use only.
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
    freeModel: process.env.OPENROUTER_MODEL_FREE || 'nvidia/nemotron-3-ultra-550b-a55b:free',
    // Dedicated key for admin-only free-model calls -- see field doc above.
    // Set OPENROUTER_ADMIN_API_KEY on a SEPARATE OpenRouter account (sign up
    // again with a different email, generate a key there) so admin traffic
    // never shares rate limits/quota with the main OPENROUTER_API_KEY used
    // by paying users. Falls back to the main key if left unset.
    adminApiKeyEnvVar: 'OPENROUTER_ADMIN_API_KEY',
  },
}

function apiKeyFor(config: OpenAICompatibleProviderConfig, isAdmin?: boolean): string | undefined {
  if (isAdmin && config.adminApiKeyEnvVar) {
    const adminKey = process.env[config.adminApiKeyEnvVar]
    if (adminKey) return adminKey
  }
  return process.env[config.apiKeyEnvVar]
}

export const kimiConfigured = Boolean(apiKeyFor(PROVIDERS.kimi))
export const mistralConfigured = Boolean(apiKeyFor(PROVIDERS.mistral))
export const openrouterConfigured = Boolean(apiKeyFor(PROVIDERS.openrouter))
// Whether EITHER the dedicated admin key (OPENROUTER_ADMIN_API_KEY) or the
// main key (OPENROUTER_API_KEY, used as a fallback if the admin-only one
// isn't set) is available -- used to gate admin generations specifically.
export const openrouterAdminConfigured = Boolean(apiKeyFor(PROVIDERS.openrouter, true))

function clientFor(config: OpenAICompatibleProviderConfig, isAdmin?: boolean): OpenAI {
  return new OpenAI({
    apiKey: apiKeyFor(config, isAdmin) || 'placeholder-key',
    baseURL: config.baseURL,
    // OpenRouter uses these two (optional, non-secret) headers purely for
    // attributing requests to an app on https://openrouter.ai/rankings, it
    // still works fine without them, this just identifies us properly.
    defaultHeaders:
      config.key === 'openrouter'
        ? { 'HTTP-Referer': 'https://autoviral.app', 'X-Title': 'Autoviral' }
        : undefined,
  })
}

// zod v4 can derive a JSON Schema straight from the same schema the AI
// provider's native structured-output path uses, keeps the "contract"
// identical across providers even though only some of them can enforce it
// natively.
const JSON_SCHEMA = JSON.stringify(z.toJSONSchema(videoContentSchema), null, 2)

function schemaContractPrompt(): string {
  return `Respond with ONLY a single raw JSON object, no markdown code fences, no commentary before or \
after it. The JSON object MUST validate against this JSON Schema:\n\n${JSON_SCHEMA}`
}

function extractJson(raw: string): unknown {
  // Some models wrap JSON in markdown fences despite instructions, strip them defensively.
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
/**
 * Runs the schema-validated chat-completion attempt loop (2 tries, feeding
 * back a validation error on the retry) against a single model. Throws if
 * the model errors outright (rate limit, 404/unavailable, etc.) OR if it
 * never returns schema-valid JSON after retrying, either case is what
 * triggers the caller's fallback to the next candidate model.
 */
async function attemptWithModel(
  client: OpenAI,
  model: string,
  userPrompt: string
): Promise<GeneratedVideoContent> {
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
    // instead of throwing, `choices` itself can be missing, not just empty.
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

  throw new Error(`model "${model}" did not return a schema-valid video script after retrying: ${lastError}`)
}

export async function generateVideoContentOpenAICompatible(
  input: GenerateVideoContentInput,
  config: OpenAICompatibleProviderConfig
): Promise<GeneratedVideoContent> {
  if (!apiKeyFor(config, input.isAdmin)) {
    throw new Error(
      input.isAdmin && config.adminApiKeyEnvVar
        ? `${config.label} is not configured: missing both ${config.adminApiKeyEnvVar} and ${config.apiKeyEnvVar} on the server.`
        : `${config.label} is not configured: missing ${config.apiKeyEnvVar} on the server.`
    )
  }

  const client = clientFor(config, input.isAdmin)
  const userPrompt = buildUserPrompt(input)

  // Admin accounts must NEVER trigger real API spend: if a free model is
  // configured, that's the ONLY candidate tried, no fallback to the paid
  // model at all. If the free model errors/fails validation, the generation
  // fails outright for admin rather than silently costing real money -- see
  // the admin-only guard in generateVideoContent (ai.ts), which forces
  // OpenRouter (the only provider with a genuinely free model) for admin
  // regardless of AI_PROVIDER, for the same reason.
  //
  // Every non-admin generation still tries the free (":free"-suffixed, $0
  // real cost) model first to keep real OpenRouter spend near zero whenever
  // the free tier is available, falling back to the cheap PAID model only
  // for paying users if the free model errors or fails validation -- their
  // credits already price in this fallback cost (see aiSchema.ts's
  // creditsForEstimatedCost).
  const candidates = input.isAdmin
    ? config.freeModel
      ? [config.freeModel]
      : (() => {
          throw new Error(
            `${config.label} has no configured free model and admin generations are never allowed to use a paid model.`
          )
        })()
    : config.freeModel
      ? [config.freeModel, config.model]
      : [config.model]

  let lastErr: unknown
  for (const model of candidates) {
    try {
      return await attemptWithModel(client, model, userPrompt)
    } catch (err) {
      lastErr = err
      console.warn(
        `[${config.label}] model "${model}" failed, ${model === candidates[candidates.length - 1] ? 'no more fallbacks' : 'falling back to next model'}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`${config.label} failed to generate a video script after trying all fallback models.`)
}
