import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import { renderRemotionVideo } from '../services/remotionRender.js'
import type { GeneratedVideoContent } from '../types.js'

// One-off smoke test for the Remotion render bridge, not part of the app,
// just a fast way to confirm bundling + headless Chromium + narration +
// fallback-background compositing all work end to end on this machine.
// Run with: npx tsx src/scripts/smokeTestRemotion.ts

const content: GeneratedVideoContent = {
  title: 'Remotion Smoke Test',
  description: 'A quick real render to confirm the Remotion pipeline works end to end.',
  hashtags: ['test', 'remotion', 'autoviral'],
  script: [
    {
      narration: 'This is scene one of a quick Remotion smoke test.',
      on_screen_text: 'Scene One',
      visual_prompt: 'a calm mountain lake at sunrise, cinematic, photorealistic',
      duration_seconds: 3,
    },
    {
      narration: 'And this is scene two, wrapping things up.',
      on_screen_text: 'Scene Two',
      visual_prompt: 'a bustling city street at night with neon lights',
      duration_seconds: 3,
    },
  ],
}

async function main() {
  console.log('Starting Remotion smoke test render...')
  const t0 = Date.now()
  const result = await renderRemotionVideo({ content, aspectRatio: '9:16', voiceStyle: 'friendly' })
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  await writeFile('/tmp/autoviral-remotion-smoke.mp4', result.videoBuffer)
  await writeFile('/tmp/autoviral-remotion-smoke-thumb.png', result.thumbnailBuffer)
  console.log(
    JSON.stringify(
      {
        ok: true,
        elapsedSeconds: elapsed,
        durationSeconds: result.durationSeconds,
        stockFootageScenes: result.stockFootageScenes,
        totalScenes: result.totalScenes,
        videoBytes: result.videoBuffer.length,
        out: '/tmp/autoviral-remotion-smoke.mp4',
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('Remotion smoke test FAILED:', err)
  process.exit(1)
})
