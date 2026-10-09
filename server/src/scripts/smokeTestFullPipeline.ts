import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generateVideoContent, aiProvider, aiConfigured } from '../services/ai.js'
import { renderRemotionVideo } from '../services/remotionRender.js'

// Full, real (non-mocked) end-to-end smoke test that mirrors what
// runGenerationPipeline does, minus Supabase persistence: OpenRouter (or
// whichever AI_PROVIDER is active) generates a real script, then Remotion
// renders a real .mp4 with real `say` narration + real/fallback backgrounds
// and the new cross-scene transitions. Run with:
//   npx tsx src/scripts/smokeTestFullPipeline.ts

async function main() {
  console.log(`[smokeTestFullPipeline] provider=${aiProvider} configured=${aiConfigured}`)

  const t0 = Date.now()
  const content = await generateVideoContent({
    prompt: 'a quick 3-scene video about a weird space fact',
    mode: 'manual',
  })
  const aiElapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[smokeTestFullPipeline] AI generation done in ${aiElapsed}s, "${content.title}" (${content.script.length} scenes)`)

  const t1 = Date.now()
  const result = await renderRemotionVideo({
    content,
    aspectRatio: '9:16',
    voiceStyle: 'energetic',
  })
  const renderElapsed = ((Date.now() - t1) / 1000).toFixed(1)

  const outDir = path.resolve('/tmp')
  const videoPath = path.join(outDir, 'autoviral-smoketest.mp4')
  const thumbnailPath = path.join(outDir, 'autoviral-smoketest-thumb.jpg')
  await writeFile(videoPath, result.videoBuffer)
  await writeFile(thumbnailPath, result.thumbnailBuffer)

  console.log(
    JSON.stringify(
      {
        ok: true,
        aiElapsedSeconds: aiElapsed,
        renderElapsedSeconds: renderElapsed,
        videoPath,
        thumbnailPath,
        videoBytes: result.videoBuffer.length,
        durationSeconds: result.durationSeconds,
        stockFootageScenes: result.stockFootageScenes,
        totalScenes: result.totalScenes,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error('Full pipeline smoke test FAILED:', err)
  process.exit(1)
})
