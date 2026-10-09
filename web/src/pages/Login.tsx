import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/Button'
import { Input, Label } from '@/components/Input'
import { Logo } from '@/components/Logo'
import { Card } from '@/components/Card'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/app')
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
          <h1 className="font-display text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-white/50">Log in to keep your videos rolling.</p>

          {!supabaseConfigured && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-yolk-500/30 bg-yolk-500/10 p-3 text-xs text-yolk-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Supabase isn't configured yet — add your project URL/anon key to{' '}
              <code className="rounded bg-black/30 px-1">web/.env.local</code> to enable login.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Log in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-white/50">
            New to Autoviral?{' '}
            <Link to="/signup" className="font-medium text-yolk-400 hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  )
}
