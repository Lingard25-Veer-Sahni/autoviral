import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Wand2, Sparkles, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/Button'
import { Input, Label, Textarea } from '@/components/Input'
import { Card } from '@/components/Card'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import type { ChannelMode, Platform } from '@/types'

const STEPS = ['Mode', 'Your channel', 'Connect', 'You’re set'] as const

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [mode, setMode] = useState<ChannelMode>('autopilot')
  const [channelName, setChannelName] = useState('')
  const [niche, setNiche] = useState('')
  const [videosPerDay, setVideosPerDay] = useState(1)
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube'])

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('channels').insert({
        user_id: user.id,
        name: channelName || 'My channel',
        niche_description: niche || 'General content',
        mode,
        videos_per_day: mode === 'autopilot' ? videosPerDay : 1,
        platforms,
      })
      await supabase
        .from('profiles')
        .update({ onboarding_complete: true, onboarding_step: 'done' })
        .eq('id', user.id)
      await refreshProfile()
      navigate('/app')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-14">
      <Logo className="mb-10" />

      {/* Stepper */}
      <div className="mb-10 flex w-full max-w-xl items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition',
                  i < step && 'border-yolk-500 bg-yolk-500 text-ink-900',
                  i === step && 'border-yolk-500 text-yolk-400 shadow-glow',
                  i > step && 'border-white/15 text-white/30'
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn('text-[11px] whitespace-nowrap', i === step ? 'text-white' : 'text-white/40')}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-2 h-px flex-1', i < step ? 'bg-yolk-500' : 'bg-white/10')} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <Card>
                <h2 className="font-display text-2xl font-bold text-white">How do you want to create?</h2>
                <p className="mt-1 text-sm text-white/50">You can change this anytime from your dashboard.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => setMode('autopilot')}
                    className={cn(
                      'rounded-2xl border p-5 text-left transition',
                      mode === 'autopilot' ? 'border-yolk-500 bg-yolk-500/10 shadow-glow' : 'border-white/10 hover:border-white/25'
                    )}
                  >
                    <Wand2 className="h-6 w-6 text-yolk-500" />
                    <h3 className="mt-3 font-display font-semibold text-white">Channel Autopilot</h3>
                    <p className="mt-1 text-xs text-white/60">Describe your niche once — a new video is generated & queued every day.</p>
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={cn(
                      'rounded-2xl border p-5 text-left transition',
                      mode === 'manual' ? 'border-yolk-500 bg-yolk-500/10 shadow-glow' : 'border-white/10 hover:border-white/25'
                    )}
                  >
                    <Sparkles className="h-6 w-6 text-yolk-500" />
                    <h3 className="mt-3 font-display font-semibold text-white">Video-by-Video</h3>
                    <p className="mt-1 text-xs text-white/60">You describe each video individually, on your own schedule.</p>
                  </button>
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <h2 className="font-display text-2xl font-bold text-white">Tell us about your channel</h2>
                <p className="mt-1 text-sm text-white/50">This shapes the tone, topics, and style of every video Autoviral makes.</p>
                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="cname">Channel / brand name</Label>
                    <Input id="cname" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g. Peak Mindset" />
                  </div>
                  <div>
                    <Label htmlFor="niche">Describe your channel</Label>
                    <Textarea
                      id="niche"
                      rows={4}
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      placeholder="e.g. Bite-sized productivity & mindset tips for founders, upbeat and punchy, mostly text-on-screen with fast cuts."
                    />
                  </div>
                  {mode === 'autopilot' && (
                    <div>
                      <Label htmlFor="vpd">Videos per day</Label>
                      <Input
                        id="vpd"
                        type="number"
                        min={1}
                        max={10}
                        value={videosPerDay}
                        onChange={(e) => setVideosPerDay(Number(e.target.value))}
                      />
                      <p className="mt-1 text-xs text-white/40">Limited by your available credits — cost per video depends on its length.</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <h2 className="font-display text-2xl font-bold text-white">Where should we post?</h2>
                <p className="mt-1 text-sm text-white/50">Connect now, or skip and link accounts later from Settings.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => togglePlatform('youtube')}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border p-4 transition',
                      platforms.includes('youtube') ? 'border-yolk-500 bg-yolk-500/10' : 'border-white/10 hover:border-white/25'
                    )}
                  >
                    <Youtube className="h-6 w-6 text-red-500" />
                    <div className="text-left">
                      <p className="font-medium text-white">YouTube</p>
                      <p className="text-xs text-white/50">Shorts & long-form</p>
                    </div>
                  </button>
                  <button
                    onClick={() => togglePlatform('instagram')}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border p-4 transition',
                      platforms.includes('instagram') ? 'border-yolk-500 bg-yolk-500/10' : 'border-white/10 hover:border-white/25'
                    )}
                  >
                    <Instagram className="h-6 w-6 text-pink-400" />
                    <div className="text-left">
                      <p className="font-medium text-white">Instagram</p>
                      <p className="text-xs text-white/50">Reels</p>
                    </div>
                  </button>
                </div>
                <p className="mt-4 text-xs text-white/40">
                  You'll do the actual account linking (OAuth) from the Accounts page after onboarding.
                </p>
              </Card>
            )}

            {step === 3 && (
              <Card className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yolk-500/15">
                  <Check className="h-7 w-7 text-yolk-400" />
                </div>
                <h2 className="mt-4 font-display text-2xl font-bold text-white">You're all set, {channelName || 'creator'}!</h2>
                <p className="mt-2 text-sm text-white/60">
                  {mode === 'autopilot'
                    ? `Autoviral will start generating up to ${videosPerDay} video${videosPerDay > 1 ? 's' : ''}/day for review.`
                    : 'Head to "Create Video" whenever you have an idea.'}
                </p>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={step === 0 ? 'invisible' : ''}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} loading={saving}>
              Enter dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
