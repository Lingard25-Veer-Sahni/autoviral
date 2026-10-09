import { Router } from 'express'
import multer from 'multer'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabaseAdmin.js'
import {
  voiceboxConfigured,
  createVoiceboxProfile,
  transcribeVoiceboxSample,
  uploadVoiceboxSample,
  deleteVoiceboxProfile,
} from '../services/voiceboxTts.js'

const router = Router()

// Memory storage: the sample only ever needs to reach Voicebox (transcribed,
// then uploaded as a profile sample), never persisted to disk or Supabase
// Storage here, same ephemeral-asset pattern as the thumbnail upload in
// routes/videos.ts.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
})

const NOT_CONFIGURED_MESSAGE =
  'Custom cloned voices need Voicebox running locally (see SETUP.md) and VOICEBOX_URL set in server/.env.'

// POST /api/voices, real (non-mocked) voice cloning: creates a Voicebox
// profile, runs Voicebox's own Whisper transcription on the uploaded sample
// (rather than fabricating a transcript), then attaches the sample + that
// real transcript to the profile so it's immediately usable for narration.
router.post('/', requireAuth, upload.single('file'), async (req: AuthedRequest, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const file = req.file

  if (!name) {
    return res.status(400).json({ error: 'A name for this voice is required.' })
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'Voice name must be 100 characters or fewer.' })
  }
  if (!file) {
    return res.status(400).json({ error: 'An audio sample file is required.' })
  }
  if (!voiceboxConfigured) {
    return res.status(503).json({ error: NOT_CONFIGURED_MESSAGE })
  }

  let voiceboxProfileId: string
  try {
    voiceboxProfileId = await createVoiceboxProfile(name)
  } catch (err) {
    console.error('[voices] failed to create Voicebox profile:', err instanceof Error ? err.message : err)
    return res.status(502).json({
      error: `Could not reach Voicebox to create the voice profile. Make sure it's running (see SETUP.md). ${err instanceof Error ? err.message : ''}`.trim(),
    })
  }

  const { data: row, error: insertError } = await supabaseAdmin
    .from('voice_profiles')
    .insert({
      user_id: req.userId,
      name,
      voicebox_profile_id: voiceboxProfileId,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !row) {
    // Best-effort cleanup, don't leave an orphaned profile on the Voicebox side.
    await deleteVoiceboxProfile(voiceboxProfileId).catch(() => {})
    return res.status(500).json({ error: insertError?.message || 'Failed to save the voice profile.' })
  }

  try {
    const referenceText = await transcribeVoiceboxSample(file.buffer, file.originalname, file.mimetype)
    await uploadVoiceboxSample(voiceboxProfileId, file.buffer, file.originalname, file.mimetype, referenceText)

    const { data: updated } = await supabaseAdmin
      .from('voice_profiles')
      .update({ status: 'ready', sample_count: 1 })
      .eq('id', row.id)
      .select()
      .single()

    return res.status(201).json({ voiceProfile: updated || { ...row, status: 'ready', sample_count: 1 } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process the voice sample.'
    console.error(`[voices] sample processing failed for profile ${row.id}:`, message)
    await supabaseAdmin.from('voice_profiles').update({ status: 'failed', error_message: message }).eq('id', row.id)
    return res.status(502).json({ error: `Voice sample processing failed: ${message}` })
  }
})

// GET /api/voices, list the current user's cloned voices (most recent first).
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('voice_profiles')
    .select('id, name, status, error_message, sample_count, is_default, created_at')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  res.json({ voiceProfiles: data || [], voiceboxConfigured })
})

// PATCH /api/voices/:id/default, marks this profile as the user's
// account-wide default voice (used automatically for narration in both the
// manual Create Video flow and Channel Autopilot, see CreateVideo.tsx and
// scheduler.ts's runAutopilotTick()), clearing the flag off any previously
// default profile first so `voice_profiles_one_default_per_user` (a partial
// unique index on `is_default`, see 0006_voice_profile_default.sql) never
// trips. Two sequential updates rather than one atomic statement, safe here
// since this is a single-user, low-frequency action with no concurrent
// writers to race against.
router.patch('/:id/default', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params

  const { data: row } = await supabaseAdmin
    .from('voice_profiles')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single()

  if (!row) {
    return res.status(404).json({ error: 'Voice profile not found.' })
  }
  if (row.status !== 'ready') {
    return res.status(400).json({ error: 'Only a fully-processed ("ready") voice can be set as the default.' })
  }

  await supabaseAdmin.from('voice_profiles').update({ is_default: false }).eq('user_id', req.userId).eq('is_default', true)

  const { data: updated, error } = await supabaseAdmin
    .from('voice_profiles')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', req.userId)
    .select('id, name, status, error_message, sample_count, is_default, created_at')
    .single()

  if (error || !updated) {
    return res.status(500).json({ error: error?.message || 'Failed to set default voice.' })
  }
  res.json({ voiceProfile: updated })
})

// DELETE /api/voices/:id, removes both our DB row and the underlying Voicebox profile.
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params
  const { data: row, error } = await supabaseAdmin
    .from('voice_profiles')
    .select('id, voicebox_profile_id')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single()

  if (error || !row) {
    return res.status(404).json({ error: 'Voice profile not found.' })
  }

  await deleteVoiceboxProfile(row.voicebox_profile_id).catch((err) => {
    console.error(`[voices] failed to delete Voicebox-side profile ${row.voicebox_profile_id} (continuing to delete our record):`, err instanceof Error ? err.message : err)
  })

  const { error: deleteError } = await supabaseAdmin.from('voice_profiles').delete().eq('id', id)
  if (deleteError) {
    return res.status(500).json({ error: deleteError.message })
  }
  res.json({ ok: true })
})

export default router
