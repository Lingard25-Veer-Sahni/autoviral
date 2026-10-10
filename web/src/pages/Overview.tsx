import { Link } from 'react-router-dom'
import { Wand2, Sparkles, Clapperboard, Zap, TrendingUp } from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { useAuth } from '@/context/AuthContext'
import { useVideos, useChannels } from '@/lib/hooks'
import { Card } from '@/components/Card'
import { TiltCard } from '@/components/TiltCard'
import { Button } from '@/components/Button'
import { StatusPill } from '@/components/Badge'
import { formatDate } from '@/lib/utils'

export default function Overview() {
  const { profile } = useAuth()
  const { videos } = useVideos()
  const { channels } = useChannels()

  const posted = videos.filter((v) => v.status === 'posted').length
  const scheduled = videos.filter((v) => v.status === 'scheduled').length
  const ready = videos.filter((v) => v.status === 'ready').length
  const activeChannel = channels.find((c) => c.status === 'active')

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="mt-1 text-white/50">Here's what Autoviral has been doing for you.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/app/create"><Button variant="secondary"><Sparkles className="h-4 w-4" /> New video</Button></Link>
          <Link to="/app/autopilot"><Button><Wand2 className="h-4 w-4" /> Autopilot</Button></Link>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Credits left', value: profile?.role === 'admin' ? 'Unlimited' : profile?.credits ?? 0, icon: Zap },
          { label: 'Ready to review', value: ready, icon: Clapperboard },
          { label: 'Scheduled', value: scheduled, icon: TrendingUp },
          { label: 'Posted total', value: posted, icon: Sparkles },
        ].map((s) => (
          <TiltCard key={s.label}>
            <Card className="h-full">
              <div className="flex items-center justify-between">
                <s.icon className="h-5 w-5 text-yolk-500" />
              </div>
              <p className="mt-4 font-display text-3xl font-bold text-white">{s.value}</p>
              <p className="mt-1 text-sm text-white/50">{s.label}</p>
            </Card>
          </TiltCard>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Recent videos</h2>
            <Link to="/app/videos" className="text-sm text-yolk-400 hover:underline">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {videos.length === 0 && (
              <p className="py-8 text-center text-sm text-white/40">No videos yet, create your first one.</p>
            )}
            {videos.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-ink-700">
                  {v.thumbnail_url && <img src={v.thumbnail_url} className="h-full w-full object-cover" alt="" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{v.title || v.prompt}</p>
                  <p className="text-xs text-white/40">{formatDate(v.created_at)}</p>
                </div>
                <StatusPill status={v.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-white">Autopilot channel</h2>
          {activeChannel ? (
            <div className="mt-4 space-y-3">
              <p className="font-medium text-white">{activeChannel.name}</p>
              <p className="text-sm text-white/50 line-clamp-3">{activeChannel.niche_description}</p>
              <div className="flex items-center gap-2 text-xs text-white/40">
                {activeChannel.platforms.includes('youtube') && <Youtube className="h-4 w-4 text-red-500" />}
                {activeChannel.platforms.includes('instagram') && <Instagram className="h-4 w-4 text-pink-400" />}
                <span>{activeChannel.videos_per_day}/day</span>
              </div>
              <Link to="/app/autopilot"><Button variant="secondary" size="sm" className="w-full">Manage</Button></Link>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <p className="text-sm text-white/50">No autopilot channel set up yet.</p>
              <Link to="/app/autopilot" className="mt-3 block"><Button size="sm" className="w-full">Set up autopilot</Button></Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
