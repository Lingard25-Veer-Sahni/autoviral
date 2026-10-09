import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Trash2, Loader2, Sparkles, Check, CalendarClock, Send, X } from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { useVideos } from '@/lib/hooks'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { StatusPill } from '@/components/Badge'
import { VideoDetailModal } from '@/components/VideoDetailModal'
import { ProgressRing } from '@/components/ProgressRing'
import { formatDate, cn } from '@/lib/utils'
import type { VideoRecord, VideoStatus } from '@/types'

const FILTERS: { label: string; value: VideoStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Generating', value: 'generating' },
  { label: 'Ready to review', value: 'ready' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Posted', value: 'posted' },
  { label: 'Failed', value: 'failed' },
]

type BulkAction = 'Deleting' | 'Scheduling' | 'Posting'

export default function VideoManager() {
  const { videos, loading, refresh } = useVideos()
  const [filter, setFilter] = useState<VideoStatus | 'all'>('all')
  const [selected, setSelected] = useState<VideoRecord | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [schedulePanelOpen, setSchedulePanelOpen] = useState(false)
  const [postPanelOpen, setPostPanelOpen] = useState(false)
  const [bulkScheduleAt, setBulkScheduleAt] = useState('')
  const [bulkPlatforms, setBulkPlatforms] = useState<Set<'youtube' | 'instagram'>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<{ action: BulkAction; done: number; total: number } | null>(null)

  const filtered = filter === 'all' ? videos : videos.filter((v) => v.status === filter)
  // Selected videos are looked up against the full list (not just `filtered`) so a
  // selection made under one filter survives switching to another filter tab.
  const selectedVideos = videos.filter((v) => selectedIds.has(v.id))
  const readySelectedVideos = selectedVideos.filter((v) => v.video_url)
  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id))

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach((v) => next.delete(v.id))
      } else {
        filtered.forEach((v) => next.add(v.id))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSchedulePanelOpen(false)
    setPostPanelOpen(false)
    setBulkPlatforms(new Set())
    setBulkScheduleAt('')
  }

  function togglePlatform(p: 'youtube' | 'instagram') {
    setBulkPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function remove(id: string) {
    if (!confirm('Delete this video permanently?')) return
    await supabase.from('videos').delete().eq('id', id)
    refresh()
  }

  async function bulkDelete() {
    const ids = [...selectedIds]
    if (!ids.length || bulkBusy) return
    if (!confirm(`Delete ${ids.length} video${ids.length === 1 ? '' : 's'} permanently? This can't be undone.`)) return

    setBulkBusy({ action: 'Deleting', done: 0, total: ids.length })
    const { error } = await supabase.from('videos').delete().in('id', ids)
    setBulkBusy(null)
    clearSelection()
    refresh()
    if (error) alert(`Failed to delete some videos: ${error.message}`)
  }

  async function bulkSchedule() {
    if (!bulkScheduleAt || bulkBusy) return
    const targets = readySelectedVideos
    if (!targets.length) {
      alert('None of the selected videos are ready to schedule yet, they are still generating.')
      return
    }
    const iso = new Date(bulkScheduleAt).toISOString()
    setBulkBusy({ action: 'Scheduling', done: 0, total: targets.length })
    let failures = 0
    for (let i = 0; i < targets.length; i++) {
      try {
        await api.scheduleVideo(targets[i].id, iso)
      } catch {
        failures++
      }
      setBulkBusy({ action: 'Scheduling', done: i + 1, total: targets.length })
    }
    setBulkBusy(null)
    clearSelection()
    refresh()
    if (failures) alert(`${targets.length - failures}/${targets.length} scheduled. ${failures} failed.`)
  }

  async function bulkPost() {
    const platforms = [...bulkPlatforms]
    if (!platforms.length || bulkBusy) return
    const targets = readySelectedVideos
    if (!targets.length) {
      alert('None of the selected videos are ready to post yet, they are still generating.')
      return
    }
    setBulkBusy({ action: 'Posting', done: 0, total: targets.length })
    let failures = 0
    for (let i = 0; i < targets.length; i++) {
      try {
        await api.postVideo(targets[i].id, platforms)
      } catch {
        failures++
      }
      setBulkBusy({ action: 'Posting', done: i + 1, total: targets.length })
    }
    setBulkBusy(null)
    clearSelection()
    refresh()
    if (failures) alert(`${targets.length - failures}/${targets.length} posted. ${failures} failed.`)
  }

  const notReadyCount = selectedVideos.length - readySelectedVideos.length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
            <Clapperboard className="h-7 w-7 text-yolk-500" /> Video Manager
          </h1>
          <p className="mt-1 text-white/50">Preview, edit, schedule, and post, with platform-specific formatting.</p>
        </div>
        <Link to="/app/create"><Button><Sparkles className="h-4 w-4" /> New video</Button></Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                filter === f.value ? 'border-yolk-500 bg-yolk-500/10 text-white' : 'border-white/10 text-white/50 hover:text-white'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white"
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border transition',
                allFilteredSelected ? 'border-yolk-500 bg-yolk-500 text-ink-900' : 'border-white/30'
              )}
            >
              {allFilteredSelected && <Check className="h-3 w-3" />}
            </span>
            {allFilteredSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-yolk-500" /></div>
      ) : filtered.length === 0 ? (
        <Card className="mt-8 py-16 text-center">
          <p className="text-white/40">No videos here yet.</p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 pb-28 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const aspectClass =
              v.aspect_ratio === '16:9' ? 'aspect-video' : v.aspect_ratio === '1:1' ? 'aspect-square' : 'aspect-9/16'
            const isSelected = selectedIds.has(v.id)
            return (
            <Card key={v.id} className={cn('group relative flex flex-col overflow-hidden !p-0', isSelected && 'ring-2 ring-yolk-500')}>
              <div role="button" tabIndex={0} onClick={() => setSelected(v)} className={cn('relative w-full overflow-hidden bg-ink-700', aspectClass)}>
                {v.status === 'generating' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
                    <ProgressRing percent={v.progress ?? 0} />
                    <p className="text-center text-xs text-white/50">{v.progress_stage || 'Starting up…'}</p>
                  </div>
                ) : v.thumbnail_url ? (
                  <img src={v.thumbnail_url} className="h-full w-full object-cover transition group-hover:scale-105" alt="" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/20">
                    <Clapperboard className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute left-2 top-2"><StatusPill status={v.status} /></div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelect(v.id)
                  }}
                  className={cn(
                    'absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border backdrop-blur-sm transition',
                    isSelected ? 'border-yolk-500 bg-yolk-500 text-ink-900' : 'border-white/40 bg-black/40 text-transparent hover:border-white/70'
                  )}
                  aria-label={isSelected ? 'Deselect video' : 'Select video'}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="line-clamp-2 text-sm font-medium text-white">{v.title || v.prompt}</p>
                <div className="mt-auto flex items-center justify-between text-xs text-white/40">
                  <span>{formatDate(v.created_at)}</span>
                  <div className="flex items-center gap-1.5">
                    {v.platform_targets?.youtube?.enabled && <Youtube className={cn('h-3.5 w-3.5', v.platform_targets.youtube.status === 'posted' ? 'text-red-500' : 'text-white/25')} />}
                    {v.platform_targets?.instagram?.enabled && <Instagram className={cn('h-3.5 w-3.5', v.platform_targets.instagram.status === 'posted' ? 'text-pink-400' : 'text-white/25')} />}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setSelected(v)}>Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
            )
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="glass-panel flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-ink-800/95 p-4 shadow-glow">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-white">{selectedIds.size} selected</span>
              {notReadyCount > 0 && (
                <span className="text-xs text-white/40">({notReadyCount} still generating)</span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!bulkBusy}
                  onClick={() => {
                    setPostPanelOpen((o) => !o)
                    setSchedulePanelOpen(false)
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> Post
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!bulkBusy}
                  onClick={() => {
                    setSchedulePanelOpen((o) => !o)
                    setPostPanelOpen(false)
                  }}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Schedule
                </Button>
                <Button size="sm" variant="danger" onClick={bulkDelete} loading={bulkBusy?.action === 'Deleting'}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button size="sm" variant="ghost" disabled={!!bulkBusy} onClick={clearSelection}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {schedulePanelOpen && (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <Input
                  type="datetime-local"
                  value={bulkScheduleAt}
                  onChange={(e) => setBulkScheduleAt(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={bulkSchedule} loading={bulkBusy?.action === 'Scheduling'} disabled={!bulkScheduleAt}>
                  {bulkBusy?.action === 'Scheduling' ? `Scheduling ${bulkBusy.done}/${bulkBusy.total}...` : `Schedule ${readySelectedVideos.length}`}
                </Button>
              </div>
            )}

            {postPanelOpen && (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <button
                  onClick={() => togglePlatform('youtube')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                    bulkPlatforms.has('youtube') ? 'border-red-500/60 bg-red-500/10 text-white' : 'border-white/10 text-white/50 hover:text-white'
                  )}
                >
                  <Youtube className="h-3.5 w-3.5" /> YouTube
                </button>
                <button
                  onClick={() => togglePlatform('instagram')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                    bulkPlatforms.has('instagram') ? 'border-pink-400/60 bg-pink-400/10 text-white' : 'border-white/10 text-white/50 hover:text-white'
                  )}
                >
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </button>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={bulkPost}
                  loading={bulkBusy?.action === 'Posting'}
                  disabled={bulkPlatforms.size === 0}
                >
                  {bulkBusy?.action === 'Posting' ? `Posting ${bulkBusy.done}/${bulkBusy.total}...` : `Post ${readySelectedVideos.length} now`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <VideoDetailModal
          video={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            refresh()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
