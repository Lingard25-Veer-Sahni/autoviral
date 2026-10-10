import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { supabaseConfigured } from './supabaseAdmin.js'
import { aiConfigured, aiProvider } from './services/ai.js'
import { youtubeConfigured } from './services/youtube.js'
import { instagramConfigured } from './services/instagram.js'
import { pexelsConfigured } from './services/stockFootage.js'
import { imageSearchConfigured } from './services/imageSearch.js'
import { b2Configured } from './services/b2Storage.js'
import { elevenLabsConfigured } from './services/elevenLabsTts.js'
import { voiceboxConfigured } from './services/voiceboxTts.js'
import { razorpayConfigured } from './services/razorpay.js'
import { startScheduler } from './services/scheduler.js'
import videosRouter from './routes/videos.js'
import socialRouter from './routes/social.js'
import mediaRouter from './routes/media.js'
import voicesRouter from './routes/voices.js'
import paymentsRouter from './routes/payments.js'
import authRouter from './routes/auth.js'

const app = express()
const PORT = Number(process.env.PORT) || 8787
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

app.use(cors({ origin: CLIENT_URL }))
app.use(
  express.json({
    limit: '2mb',
    // Stashes the exact raw bytes alongside the parsed body, the Razorpay
    // webhook handler (routes/payments.ts) needs the untouched raw string to
    // verify its HMAC signature; re-serializing req.body would not
    // byte-for-byte match what Razorpay signed.
    verify: (req, _res, buf) => {
      ;(req as express.Request & { rawBody?: Buffer }).rawBody = buf
    },
  })
)

// Referenced by web/src/pages/Accounts.tsx to detect whether the backend is running,
// and surfaces which real integrations are actually wired up.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured,
    aiConfigured,
    aiProvider,
    youtubeConfigured,
    instagramConfigured,
    pexelsConfigured,
    imageSearchConfigured,
    b2Configured,
    elevenLabsConfigured,
    voiceboxConfigured,
    razorpayConfigured,
  })
})

app.use('/api/videos', videosRouter)
app.use('/api/social', socialRouter)
app.use('/api/media', mediaRouter)
app.use('/api/voices', voicesRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/auth', authRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Autoviral server] Unhandled error:', err)
  res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`[Autoviral server] Listening on http://localhost:${PORT}`)
  console.log(
    `[Autoviral server] Supabase: ${supabaseConfigured ? 'configured' : 'NOT configured'} · ` +
      `AI (${aiProvider}): ${aiConfigured ? 'configured' : 'NOT configured'} · ` +
      `Stock footage (Pexels): ${pexelsConfigured ? 'configured' : 'NOT configured, using branded backgrounds only'} · ` +
      `YouTube: ${youtubeConfigured ? 'configured' : 'not configured'} · ` +
      `Instagram: ${instagramConfigured ? 'configured' : 'not configured'} · ` +
      `Video storage (B2): ${b2Configured ? 'configured' : 'not configured, falling back to Supabase Storage (small files only)'} · ` +
      `Narration (ElevenLabs): ${elevenLabsConfigured ? 'configured (primary, falls back to Azure/say on failure)' : 'not configured'} · ` +
      `Custom cloned voices (Voicebox): ${voiceboxConfigured ? 'configured' : 'not configured, see SETUP.md to run it locally via Docker'}`
  )
  startScheduler()
})
