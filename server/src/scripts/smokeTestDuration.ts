import 'dotenv/config'
import { generateVideoContent } from '../services/ai.js'

// One-off smoke test for the targetDuration feature: makes two real AI
// calls (short vs long preset) and confirms the AI actually responds to the
// scene-count/narration-length hint in the prompt, since that's the only
// real lever available for steering final rendered duration (real per-scene
// duration is TTS-audio-derived, not settable directly — see
// aiSchema.ts's TARGET_DURATION_PRESETS comment for the full rationale).
// Run with: npx tsx src/scripts/smokeTestDuration.ts

async function run(targetDuration: '10-30s' | '60-90s') {
  const content = await generateVideoContent({
    prompt: 'Three simple tips for staying focused while working from home.',
    mode: 'manual',
    targetDuration,
  })
  const totalWords = content.script.reduce((sum, s) => sum + s.narration.split(/\s+/).length, 0)
  return { targetDuration, scenes: content.script.length, totalNarrationWords: totalWords }
}

async function main() {
  const [short, long] = await Promise.all([run('10-30s'), run('60-90s')])
  console.log(JSON.stringify({ short, long }, null, 2))
  if (short.scenes >= long.scenes) {
    throw new Error(
      `Expected 'short' to produce fewer scenes than 'long', got short=${short.scenes} long=${long.scenes}`
    )
  }
}

main().catch((err) => {
  console.error('Duration smoke test FAILED:', err)
  process.exit(1)
})
