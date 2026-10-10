import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * Robust check for the admin role stored in profiles.role. Tolerates
 * leading/trailing whitespace or differing case from however the value got
 * written (Supabase dashboard edits, scripts, etc.) instead of a brittle
 * strict `=== 'admin'` that silently fails on e.g. "Admin " or "ADMIN".
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? '').trim().toLowerCase() === 'admin'
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return ', '
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return ', '
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
