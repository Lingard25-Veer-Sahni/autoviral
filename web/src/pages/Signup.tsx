import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Button } from '@/components/Button'
import { Input, Label } from '@/components/Input'
import { Logo } from '@/components/Logo'
import { Card } from '@/components/Card'
import { TermsModal } from '@/components/TermsModal'
import { AlertCircle } from 'lucide-react'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('You must agree to the Terms & Conditions and Privacy Policy to create an account.')
      return
    }
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    void api.sendWelcomeEmail(email, name)
    navigate('/onboarding')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <Card className="border-white/10">
          <h1 className="font-display text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-white/50">Buy a credit pack to start generating videos.</p>

          {!supabaseConfigured && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-yolk-500/30 bg-yolk-500/10 p-3 text-xs text-yolk-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Supabase isn't configured yet, add your project URL/anon key to{' '}
              <code className="rounded bg-black/30 px-1">web/.env.local</code> to enable signup.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-transparent text-yolk-500 focus:ring-yolk-500"
              />
              <span>
                I have read and agree to the{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowTerms(true)
                  }}
                  className="font-medium text-yolk-400 hover:underline"
                >
                  Terms &amp; Conditions and Privacy Policy
                </button>
                , including the no-refund policy on failed generations.
              </span>
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={loading} disabled={!agreed}>
              Create account
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-white/50">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-yolk-400 hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </motion.div>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  )
}
