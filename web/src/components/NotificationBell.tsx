import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, X, AlertTriangle, Info, CheckCheck } from 'lucide-react'
import { useNotifications } from '@/lib/hooks'
import { cn, timeAgo } from '@/lib/utils'
import type { AppNotification } from '@/types'

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'video_failed') return <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
  return <Info className="h-4 w-4 shrink-0 text-sky-400" />
}

/**
 * Bell icon + dropdown for in-app notifications, currently only fires for
 * "your video failed, credits refunded" (see server/src/services/videoPipeline.ts),
 * but built generically since useNotifications() is type-agnostic.
 */
export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white"
        title="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-white">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-white/40">You're all caught up.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={cn(
                      'group flex items-start gap-3 border-b border-white/5 px-4 py-3 last:border-b-0',
                      !n.read && 'cursor-pointer bg-yolk-500/[0.04]'
                    )}
                  >
                    <NotificationIcon type={n.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{n.title}</p>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yolk-400" />}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/60">{n.message}</p>
                      <p className="mt-1 text-[11px] text-white/30">{timeAgo(n.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        dismiss(n.id)
                      }}
                      className="shrink-0 rounded p-1 text-white/20 opacity-0 hover:bg-white/5 hover:text-white group-hover:opacity-100"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
