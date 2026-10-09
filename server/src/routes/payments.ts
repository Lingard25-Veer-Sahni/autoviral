import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabaseAdmin.js'
import {
  razorpayConfigured,
  RAZORPAY_CURRENCY,
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../services/razorpay.js'

const router = Router()

// Server-side source of truth for what a pack costs / grants — the client
// only ever sends a packId, never an amount, so a tampered request can't buy
// credits at an arbitrary price. Mirrors web/src/pages/Billing.tsx's PACKS.
export const PACKS: Record<string, { credits: number; price: number; label: string }> = {
  trial: { credits: 50, price: 19, label: 'Trial pack' },
  creator: { credits: 150, price: 49, label: 'Creator pack' },
  studio: { credits: 600, price: 149, label: 'Studio pack' },
}

const NOT_CONFIGURED_MESSAGE =
  'Payments are not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env (see SETUP.md).'

// GET /api/payments/razorpay/config — lets the frontend know whether real
// checkout is wired up, and hands over the (non-secret) pack catalogue.
router.get('/razorpay/config', requireAuth, (_req, res) => {
  res.json({ configured: razorpayConfigured, currency: RAZORPAY_CURRENCY, packs: PACKS })
})

// POST /api/payments/razorpay/create-order — step 1 of checkout: creates a
// real Razorpay order server-side so the amount can never be spoofed by the
// client opening the Checkout widget.
router.post('/razorpay/create-order', requireAuth, async (req: AuthedRequest, res) => {
  if (!razorpayConfigured) {
    return res.status(503).json({ error: NOT_CONFIGURED_MESSAGE })
  }
  const packId = typeof req.body?.packId === 'string' ? req.body.packId : ''
  const pack = PACKS[packId]
  if (!pack) {
    return res.status(400).json({ error: 'Unknown credit pack.' })
  }
  // Razorpay rejects orders under 100 paise — every current pack is well
  // above that, but guard it explicitly so a future low-price pack fails
  // loudly here instead of as an opaque Razorpay API error.
  if (Math.round(pack.price * 100) < 100) {
    return res.status(400).json({ error: 'Order amount must be at least 100 paise.' })
  }

  try {
    const order = await createRazorpayOrder(pack.price, `${req.userId}-${packId}-${Date.now()}`, {
      user_id: req.userId!,
      pack_id: packId,
    })
    res.json({ ...order, packId, pack })
  } catch (err) {
    console.error('[payments] failed to create Razorpay order:', err instanceof Error ? err.message : err)
    // Razorpay's SDK throws errors carrying the upstream HTTP status it got
    // back (401 for bad/revoked API keys, etc.) — forward that distinction
    // instead of collapsing everything into one generic response.
    const statusCode = (err as { statusCode?: number })?.statusCode
    if (statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay rejected our API credentials — check RAZORPAY_KEY_ID/SECRET.' })
    }
    res.status(500).json({ error: 'Could not start the payment. Please try again.' })
  }
})

// POST /api/payments/razorpay/verify — step 2: the client posts back what
// Razorpay Checkout returned on success. We independently re-verify the HMAC
// signature (never trust the client's word that a payment succeeded) before
// crediting the account, and de-dupe on the order id so a retried/duplicate
// call can never double-credit.
router.post('/razorpay/verify', requireAuth, async (req: AuthedRequest, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packId } = req.body || {}
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packId) {
    return res.status(400).json({ error: 'Missing payment verification fields.' })
  }
  const pack = PACKS[packId]
  if (!pack) {
    return res.status(400).json({ error: 'Unknown credit pack.' })
  }

  const valid = verifyRazorpayPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  if (!valid) {
    console.warn(`[payments] signature verification FAILED for order ${razorpay_order_id}, user ${req.userId}`)
    return res.status(400).json({ error: 'Payment verification failed.' })
  }

  const { data: existing } = await supabaseAdmin
    .from('credit_transactions')
    .select('id')
    .eq('meta->>razorpay_order_id', razorpay_order_id)
    .maybeSingle()
  if (existing) {
    return res.json({ ok: true, alreadyProcessed: true, creditsAdded: 0 })
  }

  const { data: profileRow } = await supabaseAdmin.from('profiles').select('credits').eq('id', req.userId).single()

  const { error: insertError } = await supabaseAdmin.from('credit_transactions').insert({
    user_id: req.userId,
    amount: pack.credits,
    reason: 'purchase',
    meta: {
      pack: pack.label,
      price: pack.price,
      currency: RAZORPAY_CURRENCY,
      razorpay_order_id,
      razorpay_payment_id,
    },
  })
  if (insertError) {
    console.error('[payments] payment verified but failed to record credit_transactions row:', insertError.message)
    return res.status(500).json({ error: 'Payment succeeded but crediting your account failed — contact support.' })
  }

  await supabaseAdmin
    .from('profiles')
    .update({ credits: (profileRow?.credits ?? 0) + pack.credits })
    .eq('id', req.userId)

  res.json({ ok: true, creditsAdded: pack.credits })
})

// POST /api/payments/razorpay/webhook — async safety net (Razorpay dashboard
// -> Settings -> Webhooks). The primary flow above already credits on the
// client-verify step; this exists so a payment that succeeds but never makes
// it back to the browser (closed tab, network drop) still gets logged.
// Needs the raw request body for signature verification — see index.ts's
// express.json({ verify }) hook, which stashes it on req.rawBody.
router.post('/razorpay/webhook', (req, res) => {
  const signature = req.header('x-razorpay-signature') || ''
  const rawBody = (req as AuthedRequest & { rawBody?: Buffer }).rawBody?.toString('utf8') || ''

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' })
  }

  let event = 'unknown'
  try {
    event = JSON.parse(rawBody)?.event || event
  } catch {
    // ignore parse failure — signature already verified, just couldn't log the event name
  }
  console.log(`[payments] razorpay webhook received: ${event}`)
  res.json({ ok: true })
})

export default router
