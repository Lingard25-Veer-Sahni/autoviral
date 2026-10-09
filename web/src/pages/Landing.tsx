import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Wand2,
  CalendarClock,
  Mic2,
  Image as ImageIcon,
  ArrowRight,
  Check,
} from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/Button'
import { TiltCard } from '@/components/TiltCard'
import { Card } from '@/components/Card'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

const HERO_VIDEOS = [
  { url: 'https://pub-130a73d7700d408d8ce1c303b5637777.r2.dev/landing/archegos.mp4', title: 'The $20B Family Office That Shook Wall Street', tag: 'Reel · Archegos', icon: 'instagram' as const },
  { url: 'https://pub-130a73d7700d408d8ce1c303b5637777.r2.dev/landing/black-wednesday.mp4', title: 'How Soros Broke the Bank of England', tag: 'Short · Black Wednesday', icon: 'youtube' as const },
  { url: 'https://pub-130a73d7700d408d8ce1c303b5637777.r2.dev/landing/bond-massacre.mp4', title: "The 1994 Bond Massacre", tag: 'Reel · Bond Massacre', icon: 'instagram' as const },
]

function HeroPhone({ video, rotate }: { video: (typeof HERO_VIDEOS)[number]; rotate: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playingAudio, setPlayingAudio] = useState(false)

  function toggleAudio() {
    const el = videoRef.current
    if (!el) return
    if (!playingAudio) {
      // Pause any other hero video's audio by muting this one only — simplest
      // behavior: unmute + play this video with sound, keep others muted.
      el.muted = false
      el.currentTime = 0
      el.play().catch(() => {})
      setPlayingAudio(true)
    } else {
      el.muted = true
      setPlayingAudio(false)
    }
  }

  return (
    <TiltCard className={`w-56 ${rotate}`} intensity={16}>
      <div className="animate-float rounded-2xl border border-white/10 bg-ink-700 p-3 shadow-glow-lg">
        <button
          type="button"
          onClick={toggleAudio}
          className="relative aspect-9/16 w-full overflow-hidden rounded-xl bg-ink-800"
          aria-label={playingAudio ? 'Mute video' : 'Play with sound'}
        >
          <video
            ref={videoRef}
            src={video.url}
            autoPlay
            loop
            muted={!playingAudio}
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
            <p className="font-display text-sm font-bold text-white">{video.title}</p>
          </div>
          {!playingAudio && (
            <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white/80">
              Tap for sound
            </span>
          )}
        </button>
        <div className="mt-2 flex items-center justify-between text-xs text-white/50">
          <span>{video.tag}</span>
          {video.icon === 'instagram' ? (
            <Instagram className="h-3.5 w-3.5 text-pink-400" />
          ) : (
            <Youtube className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>
      </div>
    </TiltCard>
  )
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function Landing() {
  return (
    <div className="relative min-h-screen">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-900/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-white/70 hover:text-white">
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-20 pb-32 text-center">
        <Reveal>
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-yolk-500/30 bg-yolk-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-yolk-400">
            <Sparkles className="h-3.5 w-3.5" /> AI video studio on autopilot
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mx-auto max-w-4xl font-display text-5xl font-bold leading-[1.05] text-white md:text-7xl">
            Describe your channel.
            <br />
            <span className="text-gradient-yolk">AI does the rest.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            Autoviral writes, voices, edits, and thumbnails a brand-new video every single day —
            then posts it straight to Instagram and YouTube. Or hand-craft each video yourself.
            Either way, you never touch an editing timeline again.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Start making videos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>
        </Reveal>

        {/* Floating 3D preview mockup */}
        <Reveal delay={0.25} className="mt-20">
          <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-center gap-6 perspective-1000">
            <HeroPhone video={HERO_VIDEOS[0]} rotate="-rotate-2" />
            <HeroPhone video={HERO_VIDEOS[1]} rotate="" />
            <HeroPhone video={HERO_VIDEOS[2]} rotate="rotate-2" />
          </div>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">Two ways to go viral</h2>
          <p className="mt-3 text-white/60">Pick full autopilot, or stay hands-on per video. Switch anytime.</p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal>
            <TiltCard>
              <Card className="h-full border-yolk-500/20">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-yolk-500/15 text-yolk-400">
                  <Wand2 className="h-5.5 w-5.5" />
                </div>
                <h3 className="font-display text-xl font-semibold text-white">Channel Autopilot</h3>
                <p className="mt-2 text-sm text-white/60">
                  Describe your niche once. Autoviral generates a full script, realistic voiceover,
                  edited video, thumbnail, title and description — then posts a fresh video every day,
                  automatically, based on your credit plan.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {['Set it once, never touch it again', 'Daily volume scales with your credits', 'Review queue before anything goes live'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-yolk-500" /> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.1}>
            <TiltCard>
              <Card className="h-full border-white/10">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Sparkles className="h-5.5 w-5.5" />
                </div>
                <h3 className="font-display text-xl font-semibold text-white">Video-by-Video</h3>
                <p className="mt-2 text-sm text-white/60">
                  Have a specific idea? Describe that single video and Autoviral builds it exactly to
                  spec — script, audio, visuals, thumbnail, and metadata — ready for your approval.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {['Full creative control per video', 'Great for launches & one-offs', 'Same AI pipeline, on demand'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-yolk-500" /> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">Everything a video team does. Automatically.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Wand2, title: 'AI script writer', desc: 'AI-powered scene-by-scene scripts tailored to your niche and tone.' },
            { icon: Mic2, title: 'Realistic voiceover', desc: 'Natural narration synced to every scene, no recording booth required.' },
            { icon: ImageIcon, title: 'Auto thumbnails', desc: 'Branded, scroll-stopping thumbnails generated for every video.' },
            { icon: CalendarClock, title: 'Smart scheduling', desc: 'Queue, review, and schedule posts per platform, at the best time to post.' },
            { icon: Youtube, title: 'YouTube native', desc: 'Uploads formatted for Shorts or long-form, titled and tagged for search.' },
            { icon: Instagram, title: 'Instagram native', desc: 'Reels formatted 9:16 with captions and hashtags tuned for reach.' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <Card className="h-full">
                <f.icon className="h-6 w-6 text-yolk-500" />
                <h4 className="mt-4 font-display font-semibold text-white">{f.title}</h4>
                <p className="mt-1.5 text-sm text-white/60">{f.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">Pay for videos, not seats</h2>
          <p className="mt-3 text-white/60">Credits scale with video length — short clips cost less, longer videos cost more. Buy a credit pack, use it whenever.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { name: 'Trial pack', price: '$22', credits: '50 credits', highlight: false },
            { name: 'Creator pack', price: '$57', credits: '150 credits', highlight: true },
            { name: 'Studio pack', price: '$169', credits: '600 credits', highlight: false },
          ].map((p) => (
            <Reveal key={p.name}>
              <TiltCard>
                <Card className={p.highlight ? 'border-yolk-500 shadow-glow' : 'border-white/10'}>
                  {p.highlight && (
                    <span className="mb-3 inline-block rounded-full bg-yolk-500 px-3 py-1 text-xs font-bold text-ink-900">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-display text-xl font-semibold text-white">{p.name}</h3>
                  <p className="mt-2 font-display text-4xl font-bold text-white">{p.price}</p>
                  <p className="mt-1 text-sm text-white/60">{p.credits}</p>
                  <Link to="/signup" className="mt-6 block">
                    <Button variant={p.highlight ? 'primary' : 'secondary'} className="w-full">
                      Get started
                    </Button>
                  </Link>
                </Card>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <Reveal className="mx-auto max-w-4xl rounded-3xl border border-yolk-500/30 bg-gradient-to-br from-yolk-500/10 to-transparent p-12 text-center shadow-glow">
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">Your next video is one prompt away.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/60">Join Autoviral and let AI run your content calendar.</p>
          <Link to="/signup" className="mt-8 inline-block">
            <Button size="lg">Create your first video</Button>
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-center text-sm text-white/40">
        <Logo className="mx-auto mb-4 justify-center" />
        © {new Date().getFullYear()} Autoviral. All rights reserved.
      </footer>
    </div>
  )
}
