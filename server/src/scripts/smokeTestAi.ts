import 'dotenv/config'
import { generateVideoContent } from '../services/ai.js'
import { aiProvider, aiConfigured } from '../services/ai.js'

// One-off smoke test for whichever AI provider is currently active (see
// AI_PROVIDER in server/.env), confirms the API key actually works and the
// provider returns a schema-valid script, not just that the code compiles.
// Run with: npx tsx src/scripts/smokeTestAi.ts

async function main() {
  console.log(`[smokeTestAi] provider=${aiProvider} configured=${aiConfigured}`)
  const t0 = Date.now()
  const content = await generateVideoContent({
    prompt: 'a quick 2-scene video about why the ocean looks blue',
    mode: 'manual',
  })
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(
    JSON.stringify(
      {
        ok: true,
        elapsedSeconds: elapsed,
        title: content.title,
        scenes: content.script.length,
        firstNarration: content.script[0]?.narration,
        hashtags: content.hashtags,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('AI smoke test FAILED:', err)
  process.exit(1)
})
