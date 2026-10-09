import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import { renderRemotionVideo } from '../services/remotionRender.js'
import type { GeneratedVideoContent } from '../types.js'

// One-off smoke test verifying the reported "landscape always renders as
// reel shape" bug: renders a real 16:9 video (with a deliberately long
// caption to also stress-test shrink-to-fit at this aspect ratio) and
// writes the raw mp4 to /tmp so ffprobe can empirically confirm the actual
// output pixel dimensions, independent of any web UI display bug.
// Run with: npx tsx src/scripts/smokeTest16x9.ts

const content: GeneratedVideoContent = {
  title: '16:9 Aspect Ratio Smoke Test',
  description: 'Verifies landscape rendering actually produces 1920x1080 output.',
  hashtags: ['test', 'landscape', 'autoviral'],
  script: [
    {
      narration: 'This scene has a deliberately long on screen caption to stress test shrink to fit at sixteen by nine.',
      on_screen_text:
        'This is a deliberately extremely long landscape caption designed to overflow a fixed font size and verify shrink-to-fit still keeps it inside a sixteen by nine frame',
      visual_prompt: 'a calm mountain lake at sunrise, cinematic, photorealistic',
      duration_seconds: 4,
    },
    {
      narration: 'And a second scene, confirming the whole video stays landscape throughout.',
      on_screen_text: 'Scene Two Landscape',
      visual_prompt: 'a bustling city street at night with neon lights',
      duration_seconds: 3,
    },
  ],
}

async function main() {
  console.log('Starting 16:9 aspect ratio smoke test render...')
  const t0 = Date.now()
  const result = await renderRemotionVideo({ content, aspectRatio: '16:9', voiceStyle: 'friendly' })
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  await writeFile('/tmp/autoviral-16x9-smoke.mp4', result.videoBuffer)
  await writeFile('/tmp/autoviral-16x9-smoke-thumb.png', result.thumbnailBuffer)
  console.log(
    JSON.stringify(
      {
        ok: true,
        elapsedSeconds: elapsed,
        durationSeconds: result.durationSeconds,
        stockFootageScenes: result.stockFootageScenes,
        totalScenes: result.totalScenes,
        videoBytes: result.videoBuffer.length,
        out: '/tmp/autoviral-16x9-smoke.mp4',
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('16:9 smoke test FAILED:', err)
  process.exit(1)
})
