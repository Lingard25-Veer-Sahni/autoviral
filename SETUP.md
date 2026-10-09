# Autoviral — Setup Guide

Autoviral is a real, working product: real AI-written scripts (Anthropic's AI, or a free
alternative like Kimi/Mistral), real rendered video (real stock footage or Remotion's
animated captions + macOS TTS narration + ffmpeg), real storage (Supabase Storage),
and real posting (YouTube Data API v3 + Instagram Graph API) once you add your own
credentials below. Nothing here is a mockup — every integration point either works
today or is fully wired and just waiting on a credential.

## 0. Prerequisites

- Node.js 18+
- macOS, for the current narration engine (it shells out to the built-in `say` command
  for real text-to-speech — no external TTS API key needed). See "Swapping the TTS
  engine" below if you deploy to Linux.
- A free [Supabase](https://supabase.com) project
- An AI provider key for script/title/description generation — any one of:
  an [Anthropic API key](https://console.anthropic.com) (best quality, what the app is
  tuned against), a free [Moonshot AI (Kimi) key](https://platform.moonshot.ai), a
  [Mistral key](https://console.mistral.ai) (also has a free tier), or a free
  [OpenRouter key](https://openrouter.ai/keys) (proxies many providers, including
  genuinely free models). See "AI provider options" under step 3.
- (Optional, to go fully live) A Google Cloud OAuth client + a Meta Developer app

---

## 1. Supabase (database, auth, storage)

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. Open the **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_social_account_meta.sql`
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ keep this secret — server-only, never ship it to the browser)
4. After you sign up in the app for the first time, promote yourself to admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

## 2. Web app config (`web/.env.local`)

```
cp web/.env.example web/.env.local
```

Fill in:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
VITE_API_BASE_URL=http://localhost:8787
```

Run it:
```
cd web
npm install
npm run dev
```

## 3. Server config (`server/.env`)

```
cp server/.env.example server/.env
```

Minimum to get AI video generation working (no social posting yet):
```
PORT=8787
CLIENT_URL=http://localhost:5173
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
ANTHROPIC_API_KEY=sk-ant-...
TOKEN_ENCRYPTION_KEY=some-long-random-string-at-least-32-chars
```

Run it:
```
cd server
npm install
npm run dev
```

Visit `http://localhost:8787/api/health` — it reports which integrations are actually
configured (`supabaseConfigured`, `aiConfigured`, `youtubeConfigured`, `instagramConfigured`).
The Accounts page in the app surfaces the same thing if the server isn't reachable at all.

At this point you can sign up, complete onboarding, describe a video, and get a real
generated `.mp4` with real narration, a real branded thumbnail, and a real
AI-written title/description/hashtags — end to end, no mocking. What you can't do
yet is post it to YouTube/Instagram — that needs steps 4–5.

### 3a. AI provider options (Anthropic's AI, or free alternatives: Kimi / Mistral / OpenRouter)

`AI_PROVIDER` in `server/.env` picks which LLM writes the script/title/description/
hashtags. Leave it unset to auto-pick the first one that's configured, in this order:
Anthropic → Kimi → Mistral → OpenRouter. Or set it explicitly:

```
AI_PROVIDER=claude   # or "kimi", "mistral", "openrouter"
```

- **Anthropic** (`ANTHROPIC_API_KEY`) — the default, best quality, and what the app's
  prompts are tuned against. Uses native structured outputs (`messages.parse()`), so
  the response always matches the expected script schema exactly.
- **Kimi / Moonshot AI** (`MOONSHOT_API_KEY`, from [platform.moonshot.ai](https://platform.moonshot.ai))
  — OpenAI-compatible API, free-tier friendly. Model defaults to `kimi-k2.6`
  (override with `KIMI_MODEL`).
- **Mistral** (`MISTRAL_API_KEY`, from [console.mistral.ai](https://console.mistral.ai))
  — also OpenAI-compatible, has a free tier. Model defaults to `mistral-medium-latest`
  (override with `MISTRAL_MODEL`).
- **OpenRouter** (`OPENROUTER_API_KEY`, from [openrouter.ai/keys](https://openrouter.ai/keys))
  — a single OpenAI-compatible API that proxies many different providers' models,
  including a rotating set of genuinely free (`:free`-suffixed) ones with no billing
  at all. Model defaults to `minimax/minimax-m3:free` (override with
  `OPENROUTER_MODEL`). **Free-tier availability varies by the minute** — each free
  model shares a rate-limited upstream pool across every OpenRouter user, so a given
  model can 429 under load even with a valid key; if that starts happening, either
  wait it out or switch `OPENROUTER_MODEL` to a different `:free` slug from
  [openrouter.ai/models](https://openrouter.ai/models?max_price=0).

Kimi, Mistral, and OpenRouter don't support native structured outputs the way the
Anthropic-backed provider does, so those three embed the JSON schema directly in the
prompt, request JSON-mode output, validate the response against the same zod schema, and automatically
retry once (feeding the validation error back to the model) if the first response
doesn't parse cleanly. Whichever provider is active, the rest of the pipeline (rendering,
upload, posting) is completely unaffected — this only swaps out where the script text
comes from.

You can smoke-test whichever AI provider is currently configured (confirms the key
actually works and returns a schema-valid script, not just that the code compiles):
```
cd server
npx tsx src/scripts/smokeTestAi.ts
```

### 3b. Render engine options (`RENDER_ENGINE`: stock / remotion / canvas)

`RENDER_ENGINE` in `server/.env` picks which compositor actually produces the `.mp4`:

```
RENDER_ENGINE=stock   # or "remotion" or "canvas" — default is "stock"
```

- **`stock`** (default) — real TTS narration + real Pexels stock footage (see 3a
  below), composited with ffmpeg filter graphs. Battle-tested, no headless-Chromium
  dependency, works everywhere ffmpeg-static works.
- **`remotion`** — the same real narration + real stock footage, but composited by
  [Remotion](https://www.remotion.dev/)'s headless-Chromium renderer instead of ffmpeg
  filter graphs. This gets you genuinely animated captions (spring-physics slide-up +
  fade, not a static PNG overlay), a real Ken Burns pan/zoom on any scene that falls
  back to a synthetic background, and **real cross-scene transitions** — adjacent
  scenes crossfade, slide, wipe, or clock-wipe into each other (via
  [`@remotion/transitions`](https://www.remotion.dev/docs/transitions)' `TransitionSeries`,
  cycling through a few different presentations so a multi-scene video doesn't look
  the same every cut) instead of hard-cutting. The Remotion composition lives in
  `server/remotion/` (`src/VideoComposition.tsx` is the main component to edit if you
  want to change the caption style, animation, or transition presentations/timing —
  see `TRANSITION_FRAMES` and `transitionPresentationFor()` there). The webpack bundle
  is built once per server process and cached — only per-render assets
  (narration/footage) are regenerated per video. The **first** render in a fresh
  environment auto-downloads a headless Chrome Headless Shell build (~90MB) into
  Remotion's cache — expect that one render to be noticeably slower. If a Remotion
  render throws for any reason, the pipeline automatically falls back to the `stock`
  engine so a generation never fails outright just because of this.
  You can smoke-test the Remotion path in isolation without spending a credit:
  ```
  cd server
  npx tsx src/scripts/smokeTestRemotion.ts
  ```
  This writes a real rendered `.mp4`/thumbnail to `/tmp/autoviral-remotion-smoke.mp4`.
- **`canvas`** — the original fully-synthetic branded-background engine (no real
  footage), kept as a last-resort fallback.

To confirm the AI provider and Remotion renderer work together end-to-end (real script
generation feeding a real render, the same way `videoPipeline.ts` chains them, minus
Supabase persistence), run:
```
cd server
npx tsx src/scripts/smokeTestFullPipeline.ts
```
This writes `/tmp/autoviral-smoketest.mp4` + a thumbnail and prints timing/duration —
confirmed working with `AI_PROVIDER=openrouter` + `RENDER_ENGINE=remotion` (4-scene
video, ~31s runtime, valid H.264/AAC output, genuine crossfade/slide/wipe transitions
at each scene boundary).

Note: the server's `typescript` devDependency is pinned to `5.9.3` rather than a newer
major version — Remotion's bundler (`@remotion/bundler`'s esbuild-loader) depends on
the classic `ts.sys`/`ts.readConfigFile` compiler API, which isn't exposed the same way
on newer TypeScript releases. If you ever bump `typescript` in `server/package.json`,
re-run the Remotion smoke test above to confirm bundling still works before relying on
`RENDER_ENGINE=remotion` in production.

### 3c. Real stock footage (recommended — `PEXELS_API_KEY`)

By default, without a Pexels key, each scene renders over a branded abstract
background (gradient + shapes) — good-looking, but synthetic. Add a free
[Pexels API key](https://www.pexels.com/api/) (instant signup, no credit card,
generous rate limits) to `server/.env`:

```
PEXELS_API_KEY=your-pexels-key
```

With this set, Autoviral searches Pexels' real stock video library using
keywords derived from each scene's AI-written `visual_prompt`, downloads a
genuine matching clip, and composites your captions + narration on top of it
via ffmpeg (crop/scale to the target aspect ratio, looped/trimmed to match the
narration length). If no matching clip is found for a given scene (or the key
isn't set at all), that one scene silently falls back to the branded
background — the video always finishes, it just isn't 100% real footage in
that case. Check the server startup log or `/api/health`'s `pexelsConfigured`
field to confirm it's wired up.

### 3d. Local AI video generation (experimental, macOS/Apple Silicon only)

`server/python/` contains a second, fully local, genuinely free-and-unlimited
video generation path — no API key, no cloud call, everything runs on your own
machine using open-source models:

- **Motion module:** [ByteDance/AnimateDiff-Lightning](https://huggingface.co/ByteDance/AnimateDiff-Lightning)
  (few-step distilled motion adapter, ~900MB)
- **Base checkpoint:** [SG161222/Realistic Vision V6.0 B1](https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE)
  (photorealistic-tuned Stable Diffusion 1.5, fp16 single-file, ~2.1GB)

Setup (already done in this environment, included for reference / other machines):
```
cd server/python
python3 -m venv venv
./venv/bin/pip install torch diffusers transformers accelerate safetensors Pillow imageio imageio-ffmpeg sentencepiece
```

Smoke test (downloads the ~3GB of model weights to the Hugging Face cache on
first run, then generates a short clip):
```
cd server/python
./venv/bin/python3 generate_clip.py --prompt "a golden retriever running on a beach at sunset, cinematic, photorealistic" \
  --out /tmp/test_clip.mp4 --width 384 --height 384 --steps 4 --num-frames 16 --fps 8
```

**Be honest with yourself about what this is:** it's Stable Diffusion 1.5 +
a motion adapter, not a native video-generation model like Runway/Kling/Luma/
Higgsfield. Expect noticeably lower temporal coherence/realism and slower
generation (multi-minute per short clip on a 16GB Mac, CPU-tier speed via the
MPS backend, fp32 for numerical stability) than any paid API. It exists as a
genuinely free/unlimited option to evaluate before deciding whether real
footage compositing (3a) is enough on its own, or whether it's worth paying
for a real generative video API — that integration is intentionally not built
yet; `server/src/services/localVideoGen.ts` is the bridge module to extend
once you've decided.

### 3e. Custom cloned voices (optional — [Voicebox](https://github.com/jamiepine/voicebox))

Lets a user upload (or record in-browser) a short sample of any voice and
narrate their videos with a real clone of it, instead of the preset voice
styles above. This runs on [Voicebox](https://github.com/jamiepine/voicebox)
— a free, open-source (MIT), locally-run "AI voice studio" (FastAPI backend +
bundled TTS/cloning models). It's not a hosted third-party API: everything
runs on your own machine/server, no API key, no account, no per-character cost.

You can run it either via Docker, or directly with Python (no Docker
required) — pick whichever's easier for your environment.

**Option A — Docker:**

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   (macOS/Windows) or Docker Engine (Linux) if you don't already have it.
2. Clone and start Voicebox (headless — no GUI needed):
   ```
   git clone https://github.com/jamiepine/voicebox.git
   cd voicebox
   docker compose up -d
   ```
   First start downloads the TTS/cloning models it needs — can take a while
   depending on your connection.

**Option B — plain Python (no Docker), verified working:**

1. Needs Python 3.11+ and ~5-8GB free disk for the ML dependencies.
2. Clone it and set up a venv:
   ```
   git clone https://github.com/jamiepine/voicebox.git
   cd voicebox
   python3.11 -m venv backend/venv
   backend/venv/bin/pip install --upgrade pip
   backend/venv/bin/pip install -r backend/requirements.txt
   backend/venv/bin/pip install --no-deps chatterbox-tts hume-tada
   # Apple Silicon only — MLX-accelerated backend:
   backend/venv/bin/pip install -r backend/requirements-mlx.txt
   backend/venv/bin/pip install --no-deps mlx-lm==0.31.1 mlx-audio==0.4.1
   # Optional extra TTS backend (installs code straight from Alibaba's repo —
   # skip this line if you'd rather not run third-party install scripts):
   backend/venv/bin/pip install git+https://github.com/QwenLM/Qwen3-TTS.git
   ```
3. Start it headless (no Tauri desktop app, no `just`/Bun/Rust needed — this
   is the same `uvicorn` command the project's own `just dev-backend` runs):
   ```
   backend/venv/bin/uvicorn backend.main:app --port 17493
   ```
   Leave this running in its own terminal (or run it under `nohup`/a process
   manager). Confirm it's up with `curl http://127.0.0.1:17493/health`.

**Either way, once it's running:**

3. Add to `server/.env` (default port is **17493** for both options above):
   ```
   VOICEBOX_URL=http://127.0.0.1:17493
   ```
4. Restart the Autoviral server. Check the startup log or `/api/health`'s
   `voiceboxConfigured` field to confirm it's wired up.

Without this set, the "My cloned voice" option in Create Video still shows,
but uploads will fail with a clear "Voicebox isn't configured" error — every
other feature (preset voices, rendering, posting) is completely unaffected.

How it works end-to-end (see `server/src/services/voiceboxTts.ts` and
`server/src/routes/voices.ts`): an uploaded sample is transcribed with
Voicebox's own bundled Whisper model (`POST /transcribe`) to get a real
transcript — never fabricated — then a cloned-voice profile is created
(`POST /profiles`) and the sample + transcript attached to it
(`POST /profiles/{id}/samples`). When that voice is selected for a video,
narration is synthesized synchronously via `POST /generate/stream` and
converted to the same WAV format every other TTS engine here produces, so
the render pipeline never needs to know which engine actually ran. Any
failure (Voicebox unreachable, profile not ready, etc.) is caught and falls
back to the normal preset-voice chain (ElevenLabs → Azure → macOS `say`)
rather than failing the whole generation.

## 4. YouTube posting (Google Cloud OAuth + YouTube Data API v3)

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) → create a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → OAuth consent screen** → configure it (External is fine for testing;
   add your own Google account as a test user while the app is unverified).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:8787/api/social/youtube/callback`
     (replace the host with your real deployed backend URL in production)
5. Copy the Client ID / Client Secret into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:8787/api/social/youtube/callback
   ```
6. Restart the server, go to **Accounts → Connect YouTube** in the app. You'll get the
   real Google consent screen; on approval, Autoviral stores an encrypted access +
   refresh token and can now upload real Shorts via `videos.insert` (resumable upload,
   streamed straight from Supabase Storage).

## 5. Instagram posting (Meta Developer App + Instagram Graph API)

Instagram's Graph API only publishes to **Business or Creator** accounts linked to a
**Facebook Page** — a personal/no-Page Instagram account cannot be used.

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps → Create App** → type **Business**.
2. Add the **Instagram Graph API** product (and Facebook Login, which is used for the OAuth dialog).
3. In **Facebook Login → Settings**, add a valid OAuth redirect URI:
   `http://localhost:8787/api/social/instagram/callback`
4. Make sure the Instagram account you want to post from is a Business/Creator account and is
   linked to a Facebook Page you manage (Meta Business Suite → Settings → linked accounts).
5. Add these permissions to your app (Business Verification is required for these in
   production — for development/testing, add yourself as an app tester/admin to bypass that):
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`
6. Copy the App ID / App Secret into `server/.env`:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   META_REDIRECT_URI=http://localhost:8787/api/social/instagram/callback
   ```
7. Restart the server, go to **Accounts → Connect Instagram**. On approval, Autoviral
   walks the full real flow server-side: short-lived → long-lived user token → finds your
   linked Page → finds that Page's Instagram Business Account → stores its long-lived
   Page access token (encrypted) for publishing.

Posting a Reel calls the real Graph API container flow: create a `REELS` media container
pointing at the video's public Supabase Storage URL, poll until Instagram finishes
processing it, then publish it.

## 6. How autopilot & scheduling actually run

- **Channel Autopilot**: a cron job (`server/src/services/scheduler.ts`, via `node-cron`)
  ticks every minute. For each active autopilot channel, it computes `24h / videos_per_day`
  and generates a fresh video once that interval has elapsed since `last_generated_at` —
  same real AI → render → upload pipeline as manual generation, just triggered on a timer.
- **Scheduled posts**: the same cron tick checks for videos with `status = 'scheduled'`
  whose `scheduled_at` has passed, and posts them to every platform enabled on that video.
- The server process must be running continuously for either of these to fire (use
  `npm run build && npm start`, or a process manager like `pm2`/systemd, in production).

## 7. Credits & billing

Every generated video costs 1 credit (deducted immediately, refunded automatically if
generation fails). New signups get 15 free credits (see the `handle_new_user()` trigger
in `0001_init.sql`). The in-app Billing page currently performs a **mock checkout**
(directly inserts a `credit_transactions` row and increments `profiles.credits`) — wiring
up real Stripe payments is the one remaining piece for a fully monetizable product, and
isn't included here since it needs your own Stripe account and pricing decisions.

## 8. Swapping the TTS engine (for non-macOS deployment)

`server/src/services/render.ts` calls the macOS `say` binary for real narration audio —
zero cost, zero API key, but macOS-only. To deploy on Linux, replace
`synthesizeNarration()` with any TTS API of your choice (e.g. ElevenLabs, Google
Cloud TTS, Amazon Polly) that returns an audio file — the rest of the pipeline
(canvas frame rendering, ffmpeg muxing, Supabase upload) is platform-independent.

## 9. Project layout

```
autoviral/
  web/        React + Vite + Tailwind frontend (Supabase Auth + direct DB access under RLS)
  server/     Node/Express backend (AI providers, rendering, OAuth, posting, cron)
    remotion/ Remotion composition used by RENDER_ENGINE=remotion (bundled separately
              from the rest of the server — its own tsconfig/webpack toolchain)
  supabase/migrations/   SQL schema — run these in the Supabase SQL editor
```
