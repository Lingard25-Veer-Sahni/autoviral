import { useEffect, useState } from 'react'
import { Wand2, Pause, Play, Loader2, Zap, Layers, Smartphone, RectangleHorizontal, Square } from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { useAuth } from '@/context/AuthContext'
import { useChannels, useVideos } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input, Label, Textarea } from '@/components/Input'
import { StatusPill } from '@/components/Badge'
import { cn } from '@/lib/utils'
import type { AspectRatio, Platform } from '@/types'

// Autopilot never sets an explicit targetDuration, so every autopilot-generated
// video is billed at the server's DEFAULT_TARGET_DURATION rate ('30-60s' = 4
// credits — see server/src/services/aiSchema.ts's TARGET_DURATION_PRESETS).
// Keep this in sync if that default ever changes.
const AUTOPILOT_CREDITS_PER_VIDEO = 4

const ASPECT_OPTIONS: { ratio: AspectRatio; label: string; icon: typeof Smartphone }[] = [
  { ratio: '9:16', label: 'Reels / Shorts (9:16)', icon: Smartphone },
  { ratio: '16:9', label: 'Landscape (16:9)', icon: RectangleHorizontal },
  { ratio: '1:1', label: 'Square (1:1)', icon: Square },
]

const DEFAULT_ASPECT_COUNTS: Record<AspectRatio, number> = { '9:16': 1, '16:9': 0, '1:1': 0 }

export default function Autopilot() {
  const { user, profile, refreshProfile } = useAuth()
  const { channels, refresh } = useChannels()
  const { videos } = useVideos()
  const channel = channels[0]

  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [aspectCounts, setAspectCounts] = useState<Record<AspectRatio, number>>(DEFAULT_ASPECT_COUNTS)
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube'])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingAll, setGeneratingAll] = useState<{ done: number; total: number } | null>(null)

  const videosPerDay = Object.values(aspectCounts).reduce((sum, n) => sum + (Number(n) || 0), 0)

  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setNiche(channel.niche_description)
      setPlatforms(channel.platforms)
      const mix = channel.aspect_ratio_mix
      setAspectCounts(
        mix && Object.keys(mix).length
          ? { '9:16': mix['9:16'] || 0, '16:9': mix['16:9'] || 0, '1:1': mix['1:1'] || 0 }
          : { ...DEFAULT_ASPECT_COUNTS, '9:16': channel.videos_per_day || 1 }
      )
    }
  }, [channel])

  const autopilotVideos = videos.filter((v) => v.mode === 'autopilot')

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  function setAspectCount(ratio: AspectRatio, value: number) {
    setAspectCounts((prev) => ({ ...prev, [ratio]: Math.max(0, Math.min(10, Math.floor(value) || 0)) }))
  }

  async function save() {
    if (!user) return
    if (videosPerDay < 1) {
      alert('Set at least 1 video/day across the sizes below.')
      return
    }
    setSaving(true)
    try {
      if (channel) {
        // mode is set explicitly here (even though this is presumably already an
        // autopilot channel) because the Autopilot page is the only screen that can
        // ever flip a channel created as "manual" during onboarding into autopilot —
        // without this, saving here could never actually turn autopilot on.
        const { error } = await supabase
          .from('channels')
          .update({
            name,
            niche_description: niche,
            mode: 'autopilot',
            videos_per_day: videosPerDay,
            platforms,
            aspect_ratio_mix: aspectCounts,
          })
          .eq('id', channel.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('channels').insert({
          user_id: user.id,
          name,
          niche_description: niche,
          mode: 'autopilot',
          videos_per_day: videosPerDay,
          platforms,
          aspect_ratio_mix: aspectCounts,
        })
        if (error) throw error
      }
      await refresh()
    } catch (e) {
      alert((e as { message?: string }).message || 'Failed to save autopilot settings.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus() {
    if (!channel) return
    await supabase
      .from('channels')
      .update({ status: channel.status === 'active' ? 'paused' : 'active' })
      .eq('id', channel.id)
    await refresh()
  }

  // voiceProfileId/aspectRatio are deliberately omitted from both generate
  // calls below — the backend auto-resolves the account's default cloned
  // voice and the channel's next aspect-ratio-mix size for autopilot mode
  // (see server/src/services/videoPipeline.ts's initiateVideoGeneration).
  async function generateNow() {
    if (!channel) return
    setGenerating(true)
    try {
      await api.generateVideo({
        prompt: niche,
        channelId: channel.id,
        mode: 'autopilot',
        voiceStyle: channel.voice_style,
        platforms: channel.platforms,
      })
      await refreshProfile()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  // Fires off this channel's full daily quota (across every configured size)
  // right now instead of waiting for the scheduler to pace them out over the
  // day. Sequential (not Promise.all) so each call's credit check/deduction
  // sees the previous call's already-updated balance rather than racing.
  async function generateAllNow() {
    if (!channel) return
    const total = channel.videos_per_day || videosPerDay
    if (total < 1) return
    setGeneratingAll({ done: 0, total })
    let failures = 0
    for (let i = 0; i < total; i++) {
      try {
        await api.generateVideo({
          prompt: niche,
          channelId: channel.id,
          mode: 'autopilot',
          voiceStyle: channel.voice_style,
          platforms: channel.platforms,
        })
      } catch (e) {
        failures++
        console.error('[autopilot] generate-all-now failed for one video:', e)
      }
      setGeneratingAll({ done: i + 1, total })
    }
    await refreshProfile()
    setGeneratingAll(null)
    if (failures > 0) {
      alert(`${total - failures}/${total} videos started. ${failures} failed (often low credits) — check Videos for details.`)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
            <Wand2 className="h-7 w-7 text-yolk-500" /> Channel Autopilot
          </h1>
          <p className="mt-1 text-white/50">Describe your channel once. Autoviral handles the rest, every day.</p>
        </div>
        {channel && (
          <Button variant={channel.status === 'active' ? 'secondary' : 'primary'} onClick={toggleStatus}>
            {channel.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {channel.status === 'active' ? 'Pause autopilot' : 'Resume autopilot'}
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-white">Channel configuration</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="name">Channel name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Peak Mindset" />
            </div>
            <div>
              <Label htmlFor="niche">Describe your channel & content style</Label>
              <Textarea
                id="niche"
                rows={5}
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Niche, tone, audience, format (talking-head vs text-on-screen), example topics..."
              />
            </div>
            <div>
              <Label>Videos per day, by size</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {ASPECT_OPTIONS.map(({ ratio, label, icon: Icon }) => (
                  <div key={ratio} className="rounded-xl border border-white/10 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={aspectCounts[ratio]}
                      onChange={(e) => setAspectCount(ratio, Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/40">
                {videosPerDay} video{videosPerDay === 1 ? '' : 's'}/day total, generated automatically once autopilot is active.
              </p>
            </div>
            <div>
              <Label>Post to</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => togglePlatform('youtube')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                    platforms.includes('youtube') ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                  )}
                >
                  <Youtube className="h-4 w-4 text-red-500" /> YouTube
                </button>
                <button
                  onClick={() => togglePlatform('instagram')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm',
                    platforms.includes('instagram') ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50'
                  )}
                >
                  <Instagram className="h-4 w-4 text-pink-400" /> Instagram
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={save} loading={saving}>
                {channel ? 'Save changes' : 'Create autopilot channel'}
              </Button>
              {channel && (
                <Button variant="secondary" onClick={generateNow} loading={generating}>
                  <Zap className="h-4 w-4" /> Generate one now
                </Button>
              )}
              {channel && (
                <Button variant="secondary" onClick={generateAllNow} loading={!!generatingAll}>
                  <Layers className="h-4 w-4" />
                  {generatingAll ? `Generating ${generatingAll.done}/${generatingAll.total}...` : `Generate all now (${channel.videos_per_day})`}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold text-white">How billing works</h2>
          <p className="mt-3 text-sm text-white/60">
            Autopilot videos cost <span className="font-semibold text-yolk-400">{AUTOPILOT_CREDITS_PER_VIDEO} credits</span> each. You currently have{' '}
            <span className="font-semibold text-white">{profile?.credits ?? 0}</span> credits.
          </p>
          <p className="mt-3 text-sm text-white/60">
            At {videosPerDay}/day, that's about{' '}
            <span className="font-semibold text-white">
              {Math.floor((profile?.credits ?? 0) / Math.max(videosPerDay * AUTOPILOT_CREDITS_PER_VIDEO, 1))}
            </span>{' '}
            days of runway.
          </p>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="font-display text-lg font-semibold text-white">Autopilot activity</h2>
        <div className="mt-4 space-y-3">
          {autopilotVideos.length === 0 && (
            <p className="py-8 text-center text-sm text-white/40">
              No autopilot videos yet. Save your configuration and generate your first one.
            </p>
          )}
          {autopilotVideos.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-700">
                {v.status === 'generating' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-yolk-400" />
                ) : v.thumbnail_url ? (
                  <img src={v.thumbnail_url} className="h-full w-full rounded-lg object-cover" alt="" />
                ) : (
                  <Wand2 className="h-4 w-4 text-white/30" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{v.title || v.prompt}</p>
              </div>
              <StatusPill status={v.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
