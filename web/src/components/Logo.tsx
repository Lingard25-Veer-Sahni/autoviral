import { cn } from '@/lib/utils'

export function Logo({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      <svg viewBox="0 0 64 64" className="h-7 w-7 shrink-0 drop-shadow-[0_0_10px_rgba(255,184,0,0.6)]">
        <rect width="64" height="64" rx="14" fill="#0b0b0f" />
        <path d="M35 6 12 36h14l-4 22 26-34H34l1-18z" fill="#FFB800" />
      </svg>
      {!iconOnly && (
        <span className="font-display text-lg font-bold tracking-tight text-white">
          Auto<span className="text-gradient-yolk">viral</span>
        </span>
      )}
    </div>
  )
}
