import 'dotenv/config'
import type { GeneratedVideoContent } from '../types.js'
import type { GenerateVideoContentInput } from './aiSchema.js'
import { claudeConfigured, generateVideoContentClaude } from './aiClaude.js'
import {
  kimiConfigured,
  mistralConfigured,
  openrouterConfigured,
  openrouterAdminConfigured,
  generateVideoContentOpenAICompatible,
  PROVIDERS,
} from './aiOpenAICompatible.js'

export type { GenerateVideoContentInput }

export type AiProvider = 'claude' | 'kimi' | 'mistral' | 'openrouter'

/**
 * Which provider actually generates scripts/titles/descriptions/hashtags.
 * Set AI_PROVIDER=claude|kimi|mistral|openrouter in server/.env to force one
 * explicitly. Left unset, we auto-pick the best configured option: the
 * Anthropic-backed provider first (highest quality, what the product was
 * built and tuned against), then whichever free provider (Kimi, Mistral, or
 * OpenRouter) has an API key, for anyone who wants a genuinely
 * free/unlimited-trial path with no Anthropic billing at all. OpenRouter is
 * checked last in auto-detect since its free tier proxies to whatever
 * ":free" model is configured (see OPENROUTER_MODEL), which can vary in
 * quality/availability more than a dedicated provider's own free tier.
 */
function resolveProvider(): AiProvider {
  const requested = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  if (requested === 'claude' || requested === 'kimi' || requested === 'mistral' || requested === 'openrouter') {
    return requested
  }
  if (claudeConfigured) return 'claude'
  if (kimiConfigured) return 'kimi'
  if (mistralConfigured) return 'mistral'
  if (openrouterConfigured) return 'openrouter'
  return 'claude' // no key configured for anything, surfaces a clear error below
}

export const aiProvider: AiProvider = resolveProvider()

const CONFIGURED_BY_PROVIDER: Record<AiProvider, boolean> = {
  claude: claudeConfigured,
  kimi: kimiConfigured,
  mistral: mistralConfigured,
  openrouter: openrouterConfigured,
}

export const aiConfigured: boolean = CONFIGURED_BY_PROVIDER[aiProvider]

const PROVIDER_LABELS: Record<AiProvider, string> = {
  claude: 'AI',
  kimi: PROVIDERS.kimi.label,
  mistral: PROVIDERS.mistral.label,
  openrouter: PROVIDERS.openrouter.label,
}

if (!aiConfigured) {
  console.warn(
    `[Autoviral server] AI provider "${PROVIDER_LABELS[aiProvider]}" is missing its API key, AI generation ` +
      'routes will fail until configured. Set ANTHROPIC_API_KEY (AI), MOONSHOT_API_KEY (Kimi, free-tier ' +
      'friendly), MISTRAL_API_KEY (Mistral), or OPENROUTER_API_KEY (OpenRouter, free models available), and ' +
      'optionally AI_PROVIDER to pick which one is used.'
  )
} else {
  console.log(`[Autoviral server] AI provider: ${PROVIDER_LABELS[aiProvider]}`)
}

/** Real (non-mocked) script/title/description/hashtag generation, routed to whichever provider is configured. */
export async function generateVideoContent(
  input: GenerateVideoContentInput
): Promise<GeneratedVideoContent> {
  // Admin accounts must never incur real API spend, regardless of which
  // AI_PROVIDER is configured for everyone else. Claude and the Kimi/Mistral
  // paid tiers all cost real money per call, so admin is forced onto
  // OpenRouter, the only provider with a genuinely free (":free"-suffixed,
  // $0 cost) model -- see generateVideoContentOpenAICompatible's isAdmin
  // branch, which then refuses to fall back to OpenRouter's own paid model
  // too. If OpenRouter itself isn't configured at all, admin generation
  // fails loudly instead of silently spending money on another provider.
  if (input.isAdmin) {
    if (!openrouterAdminConfigured) {
      throw new Error(
        'Admin generations require OPENROUTER_ADMIN_API_KEY (preferred, a separate OpenRouter account/key ' +
          'isolated from paying users) or OPENROUTER_API_KEY to be configured -- admin accounts are never ' +
          'allowed to use a paid provider (Claude, Kimi, Mistral) or a paid model.'
      )
    }
    return generateVideoContentOpenAICompatible(input, PROVIDERS.openrouter)
  }

  switch (aiProvider) {
    case 'claude':
      return generateVideoContentClaude(input)
    case 'kimi':
      return generateVideoContentOpenAICompatible(input, PROVIDERS.kimi)
    case 'mistral':
      return generateVideoContentOpenAICompatible(input, PROVIDERS.mistral)
    case 'openrouter':
      return generateVideoContentOpenAICompatible(input, PROVIDERS.openrouter)
  }
}
