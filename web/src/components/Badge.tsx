import { cn } from '@/lib/utils'
import type { VideoStatus, Platform } from '@/types'
import { Loader2, CheckCircle2, Clock, XCircle, Sparkles } from 'lucide-react'
import { Youtube, Instagram } from './BrandIcons'

const statusConfig: Record<VideoStatus, { label: string; className: string; icon: React.ReactNode }> = {
  queued: { label: 'Queued', className: 'bg-white/10 text-white/70', icon: <Clock className="h-3 w-3" /> },
  generating: {
    label: 'Generating',
    className: 'bg-yolk-500/15 text-yolk-400',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  ready: { label: 'Ready to review', className: 'bg-sky-500/15 text-sky-300', icon: <Sparkles className="h-3 w-3" /> },
  scheduled: { label: 'Scheduled', className: 'bg-purple-500/15 text-purple-300', icon: <Clock className="h-3 w-3" /> },
  posting: { label: 'Posting', className: 'bg-yolk-500/15 text-yolk-400', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  posted: { label: 'Posted', className: 'bg-emerald-500/15 text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: 'Failed', className: 'bg-red-500/15 text-red-300', icon: <XCircle className="h-3 w-3" /> },
}

export function StatusPill({ status }: { status: VideoStatus }) {
  const cfg = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  if (platform === 'youtube') return <Youtube className={cn('text-red-500', className)} />
  return <Instagram className={cn('text-pink-400', className)} />
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80', className)}>
      {children}
    </span>
  )
}
