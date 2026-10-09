import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CalendarClock,
  Save,
  Heart,
  MessageCircle,
  Send as SendIcon,
  Bookmark,
  ThumbsUp,
  MoreVertical,
} from 'lucide-react'
import { Youtube, Instagram } from './BrandIcons'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import { Button } from './Button'
import { Input, Label, Textarea } from './Input'
import { StatusPill } from './Badge'
import { ProgressRing } from './ProgressRing'
import type { VideoRecord } from '@/types'

type Tab = 'details' | 'youtube' | 'instagram'

export function VideoDetailModal({
  video,
  onClose,
  onChanged,
}: {
  video: VideoRecord
  onClose: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>('details')
  const [title, setTitle] = useState(video.title || '')
  const [description, setDescription] = useState(video.description || '')
  const [hashtags, setHashtags] = useState(video.hashtags?.join(' ') || '')
  const [scheduledAt, setScheduledAt] = useState(
    video.scheduled_at ? new Date(video.scheduled_at).toISOString().slice(0, 16) : ''
  )
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    try {
      await supabase
        .from('videos')
        .update({
          title,
          description,
          hashtags: hashtags.split(/\s+/).filter(Boolean),
        })
        .eq('id', video.id)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function schedule() {
    if (!scheduledAt) return
    setSaving(true)
    try {
      await api.scheduleVideo(video.id, new Date(scheduledAt).toISOString())
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function postNow(platform: 'youtube' | 'instagram') {
    setPosting(platform)
    try {
      await api.postVideo(video.id, [platform])
      onChanged()
    } finally {
      setPosting(null)
    }
  }

  const yt = video.platform_targets?.youtube
  const ig = video.platform_targets?.instagram

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-panel relative flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border-white/10 bg-ink-800"
        >
          <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-black/40 p-2 text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>

          {/* Left: preview */}
          <div className="flex w-[300px] shrink-0 flex-col items-center justify-center gap-4 border-r border-white/5 bg-black/30 p-6">
            <div
              className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-glow ${
                video.aspect_ratio === '16:9'
                  ? 'aspect-video max-w-[280px]'
                  : video.aspect_ratio === '1:1'
                    ? 'aspect-square max-w-[220px]'
                    : 'aspect-9/16 max-w-[220px]'
              }`}
            >
              {video.video_url ? (
                <video src={video.video_url} controls poster={video.thumbnail_url || undefined} className="h-full w-full object-cover" />
              ) : video.thumbnail_url ? (
                <img src={video.thumbnail_url} className="h-full w-full object-cover" alt="thumbnail" />
              ) : video.status === 'generating' ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
                  <ProgressRing percent={video.progress ?? 0} />
                  <p className="text-center text-xs text-white/50">{video.progress_stage || 'Starting up…'}</p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/30">Rendering…</div>
              )}
            </div>
            <StatusPill status={video.status} />
            {video.duration_seconds && <p className="text-xs text-white/40">{Math.round(video.duration_seconds)}s · {video.aspect_ratio}</p>}
          </div>

          {/* Right: tabs */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-5 flex gap-1 rounded-xl bg-white/5 p-1">
              {(['details', 'youtube', 'instagram'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition ${
                    tab === t ? 'bg-yolk-500 text-ink-900' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {t === 'details' ? 'Details' : t}
                </button>
              ))}
            </div>

            {tab === 'details' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
                  <p className="mt-1 text-right text-[11px] text-white/30">{title.length}/100</p>
                </div>
                <div>
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tags">Hashtags</Label>
                  <Input id="tags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#growth #ai #shorts" />
                </div>
                <Button variant="secondary" onClick={save} loading={saving} className="w-full">
                  <Save className="h-4 w-4" /> Save changes
                </Button>

                <div className="rounded-xl border border-white/10 p-4">
                  <Label htmlFor="sched" className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Schedule post</Label>
                  <div className="flex gap-2">
                    <Input id="sched" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                    <Button onClick={schedule} loading={saving}>Schedule</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button onClick={() => postNow('youtube')} loading={posting === 'youtube'} disabled={yt?.status === 'posted'}>
                    <Youtube className="h-4 w-4" /> {yt?.status === 'posted' ? 'Posted' : 'Post to YouTube'}
                  </Button>
                  <Button onClick={() => postNow('instagram')} loading={posting === 'instagram'} disabled={ig?.status === 'posted'}>
                    <Instagram className="h-4 w-4" /> {ig?.status === 'posted' ? 'Posted' : 'Post to Instagram'}
                  </Button>
                </div>
              </div>
            )}

            {tab === 'youtube' && (
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/40">YouTube Shorts preview</p>
                <div className="mx-auto max-w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-black">
                  <div className="aspect-9/16 w-full bg-ink-900">
                    {video.thumbnail_url && <img src={video.thumbnail_url} className="h-full w-full object-cover" alt="" />}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="line-clamp-2 text-sm font-medium text-white">{title || 'Untitled video'}</p>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <div className="h-5 w-5 rounded-full bg-yolk-500/40" /> Your channel · Just now
                    </div>
                    <div className="flex items-center gap-4 text-white/50">
                      <span className="flex items-center gap-1 text-xs"><ThumbsUp className="h-3.5 w-3.5" /> 0</span>
                      <span className="flex items-center gap-1 text-xs"><MessageCircle className="h-3.5 w-3.5" /> 0</span>
                    </div>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-white/5 p-3 text-xs text-white/60">{description || 'No description'}</p>
              </div>
            )}

            {tab === 'instagram' && (
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/40">Instagram Reel preview</p>
                <div className="relative mx-auto aspect-9/16 max-w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {video.thumbnail_url && (
                    <img src={video.thumbnail_url} className="absolute inset-0 h-full w-full object-cover" alt="" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                  <div className="absolute bottom-3 left-3 right-14 text-white">
                    <p className="text-xs font-semibold">@yourbrand</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-white/90">{description || title}</p>
                  </div>
                  <div className="absolute bottom-3 right-2 flex flex-col items-center gap-3 text-white">
                    <Heart className="h-5 w-5" />
                    <MessageCircle className="h-5 w-5" />
                    <SendIcon className="h-5 w-5" />
                    <Bookmark className="h-5 w-5" />
                    <MoreVertical className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-white/60">{hashtags}</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
