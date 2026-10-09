import Razorpay from 'razorpay'
import crypto from 'node:crypto'
import 'dotenv/config'

// Real (non-mocked) Razorpay integration for the credit-pack checkout in
// web/src/pages/Billing.tsx — replaces the previous demo flow that granted
// credits directly with no payment processor involved at all.

export const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

// Smallest-unit currency Razorpay charges in. Most Razorpay accounts are
// INR-only unless international payments have been explicitly enabled on the
// dashboard — override via RAZORPAY_CURRENCY if yours supports USD directly.
export const RAZORPAY_CURRENCY = process.env.RAZORPAY_CURRENCY || 'INR'

let client: Razorpay | null = null

function getClient(): Razorpay {
  if (!razorpayConfigured) {
    throw new Error('Razorpay is not configured: missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the server.')
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return client
}

export interface CreateOrderResult {
  orderId: string
  amount: number
  currency: string
  keyId: string
}

/**
 * Creates a Razorpay order for `amountMajorUnits` (e.g. 19 for ₹19/$19) —
 * Razorpay's API wants the smallest currency unit (paise for INR, cents for
 * USD), so this multiplies by 100 for the caller.
 */
export async function createRazorpayOrder(
  amountMajorUnits: number,
  receipt: string,
  notes: Record<string, string>
): Promise<CreateOrderResult> {
  const order = await getClient().orders.create({
    amount: Math.round(amountMajorUnits * 100),
    currency: RAZORPAY_CURRENCY,
    receipt,
    notes,
  })
  return {
    orderId: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID!,
  }
}

/**
 * Verifies the razorpay_order_id/razorpay_payment_id/razorpay_signature
 * triplet the client gets back from Razorpay's Checkout widget on success,
 * per Razorpay's documented HMAC-SHA256(order_id + "|" + payment_id) scheme.
 * NEVER credit an account without this passing — the three values are
 * client-controlled and easy to forge without it.
 */
export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!process.env.RAZORPAY_KEY_SECRET) return false
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return timingSafeEqualHex(expected, signature)
}

/**
 * Verifies an async webhook delivery (Razorpay dashboard -> Settings ->
 * Webhooks) against RAZORPAY_WEBHOOK_SECRET — a separate secret from the
 * API key pair, configured when the webhook endpoint is registered.
 */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return timingSafeEqualHex(expected, signature)
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const a = Buffer.from(expectedHex, 'hex')
  const b = Buffer.from(actualHex, 'hex')
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b)
}
