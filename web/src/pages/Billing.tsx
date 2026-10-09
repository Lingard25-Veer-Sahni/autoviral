import { useEffect, useState } from 'react'
import { CreditCard, Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { TiltCard } from '@/components/TiltCard'
import { formatDate } from '@/lib/utils'
import type { CreditTransaction } from '@/types'

// Mirrors server/src/routes/payments.ts's PACKS — the packId is what's sent
// to the backend, which is the actual source of truth for price/credits (a
// tampered client can't buy credits at a different price).
const PACKS = [
  { id: 'trial', credits: 50, price: 19, label: 'Trial pack' },
  { id: 'creator', credits: 150, price: 49, label: 'Creator pack', highlight: true },
  { id: 'studio', credits: 600, price: 149, label: 'Studio pack' },
]

// Loaded globally in index.html via <script src="https://checkout.razorpay.com/v1/checkout.js">.
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void
      on: (event: 'payment.failed', handler: (response: { error: { description: string } }) => void) => void
    }
  }
}

export default function Billing() {
  const { user, profile, refreshProfile } = useAuth()
  const [tx, setTx] = useState<CreditTransaction[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [razorpayConfigured, setRazorpayConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setTx((data as CreditTransaction[]) ?? []))
  }, [user])

  useEffect(() => {
    api
      .razorpayConfig()
      .then((r) => setRazorpayConfigured(r.configured))
      .catch(() => setRazorpayConfigured(false))
  }, [])

  // Real Razorpay checkout: create a server-side order (so price can't be
  // spoofed), open Razorpay's Checkout widget for the actual payment, then
  // have the server independently re-verify the signature before crediting
  // the account. See server/src/routes/payments.ts.
  async function buy(pack: (typeof PACKS)[number]) {
    if (!user) return
    setBuyError(null)
    setBuying(pack.id)
    try {
      const order = await api.createRazorpayOrder(pack.id)

      if (typeof window.Razorpay !== 'function') {
        throw new Error('Payment widget failed to load — check your connection and try again.')
      }

      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Autoviral',
          description: pack.label,
          prefill: { email: user.email ?? undefined },
          theme: { color: '#ffb800' },
          handler: async (response: {
            razorpay_order_id: string
            razorpay_payment_id: string
            razorpay_signature: string
          }) => {
            try {
              await api.verifyRazorpayPayment({ ...response, packId: pack.id })
              await refreshProfile()
              resolve()
            } catch (err) {
              reject(err)
            }
          },
          modal: {
            // User closed the widget without paying — not an error, just no-op.
            ondismiss: () => resolve(),
          },
        })
        // Declined card / bank rejection / etc. — Razorpay emits this
        // separately from the widget's own dismiss/handler flow.
        rz.on('payment.failed', (response) => {
          reject(new Error(response.error?.description || 'Payment failed.'))
        })
        rz.open()
      })
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
    } finally {
      setBuying(null)
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
        <CreditCard className="h-7 w-7 text-yolk-500" /> Credits & Billing
      </h1>
      <p className="mt-1 text-white/50">Credits scale with video length — 1 credit for a quick clip, more for longer videos. Buy more anytime.</p>

      <Card className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-yolk-500" />
          <div>
            <p className="text-sm text-white/50">Current balance</p>
            <p className="font-display text-3xl font-bold text-white">{profile?.credits ?? 0} credits</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium capitalize text-white/70">{profile?.plan} plan</span>
      </Card>

      {razorpayConfigured === false && (
        <p className="mt-4 rounded-xl border border-yolk-500/30 bg-yolk-500/10 px-4 py-3 text-sm text-yolk-200">
          Payments aren't configured yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env (see SETUP.md).
        </p>
      )}
      {buyError && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{buyError}</p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {PACKS.map((p) => (
          <TiltCard key={p.id}>
            <Card className={p.highlight ? 'h-full border-yolk-500 shadow-glow' : 'h-full border-white/10'}>
              {p.highlight && <span className="mb-3 inline-block rounded-full bg-yolk-500 px-3 py-1 text-xs font-bold text-ink-900">Best value</span>}
              <p className="text-sm text-white/50">{p.label}</p>
              <p className="mt-1 font-display text-3xl font-bold text-white">{p.credits} <span className="text-base font-normal text-white/50">credits</span></p>
              <p className="mt-1 text-sm text-white/60">${p.price}</p>
              <Button
                className="mt-5 w-full"
                variant={p.highlight ? 'primary' : 'secondary'}
                onClick={() => buy(p)}
                loading={buying === p.id}
                disabled={razorpayConfigured === false}
              >
                Buy now
              </Button>
            </Card>
          </TiltCard>
        ))}
      </div>

      <Card className="mt-8">
        <h2 className="font-display text-lg font-semibold text-white">Transaction history</h2>
        <div className="mt-4 space-y-2">
          {tx.length === 0 && <p className="py-6 text-center text-sm text-white/40">No transactions yet.</p>}
          {tx.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                {t.amount > 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                <span className="capitalize">{t.reason.replace('_', ' ')}</span>
              </div>
              <span className={t.amount > 0 ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
                {t.amount > 0 ? '+' : ''}{t.amount}
              </span>
              <span className="text-xs text-white/30">{formatDate(t.created_at)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
