import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutGrid,
  Wand2,
  Sparkles,
  Clapperboard,
  Link2,
  CreditCard,
  ShieldCheck,
  LogOut,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { NotificationBell } from '@/components/NotificationBell'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/app', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/app/autopilot', label: 'Channel Autopilot', icon: Wand2 },
  { to: '/app/create', label: 'Create Video', icon: Sparkles },
  { to: '/app/videos', label: 'Video Manager', icon: Clapperboard },
  { to: '/app/accounts', label: 'Accounts', icon: Link2 },
  { to: '/app/billing', label: 'Credits & Billing', icon: CreditCard },
]

export default function DashboardLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-ink-900/60 backdrop-blur-xl">
        <div className="px-6 py-6">
          <NavLink to="/app">
            <Logo />
          </NavLink>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-yolk-500/15 text-yolk-400 shadow-[inset_0_0_0_1px_rgba(255,184,0,0.25)]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          ))}

          {profile?.role === 'admin' && (
            <NavLink
              to="/app/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-yolk-500/15 text-yolk-400' : 'text-white/60 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <ShieldCheck className="h-4.5 w-4.5" />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="mb-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Zap className="h-4 w-4 text-yolk-500" />
              Credits
            </div>
            <span className="font-display font-bold text-yolk-400">{profile?.credits ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name || profile?.email}</p>
              <p className="truncate text-xs text-white/40">{profile?.plan} plan</p>
            </div>
            <button onClick={handleSignOut} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-40 flex justify-end border-b border-white/5 bg-ink-900/60 px-8 py-3 backdrop-blur-xl">
          <NotificationBell />
        </div>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-auto max-w-6xl px-8 py-10"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
