import { useEffect, useState } from 'react'
import { ShieldCheck, Search, Users, Clapperboard, Zap, Ban, Save, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { cn } from '@/lib/utils'
import type { Profile, VideoRecord } from '@/types'

export default function AdminPanel() {
  const [tab, setTab] = useState<'users' | 'videos'>('users')
  const [users, setUsers] = useState<Profile[]>([])
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function loadAll() {
    setLoading(true)
    const [{ data: u }, { data: v }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setUsers((u as Profile[]) ?? [])
    setVideos((v as VideoRecord[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  async function saveUser(u: Profile) {
    setSavingId(u.id)
    try {
      await supabase
        .from('profiles')
        .update({
          credits: u.credits,
          role: u.role,
          plan: u.plan,
          suspended: u.suspended,
        })
        .eq('id', u.id)
      await loadAll()
      setEditing(null)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
        <ShieldCheck className="h-7 w-7 text-yolk-500" /> Admin
      </h1>
      <p className="mt-1 text-white/50">Manage every user, credit balance, and generated video on Autoviral.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <Card><div className="flex items-center gap-3"><Users className="h-6 w-6 text-yolk-500" /><div><p className="font-display text-2xl font-bold text-white">{users.length}</p><p className="text-xs text-white/50">Total users</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Clapperboard className="h-6 w-6 text-yolk-500" /><div><p className="font-display text-2xl font-bold text-white">{videos.length}</p><p className="text-xs text-white/50">Videos (last 50)</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><Zap className="h-6 w-6 text-yolk-500" /><div><p className="font-display text-2xl font-bold text-white">{users.reduce((s, u) => s + u.credits, 0)}</p><p className="text-xs text-white/50">Credits outstanding</p></div></div></Card>
      </div>

      <div className="mt-8 flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
        {(['users', 'videos'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-lg px-4 py-2 text-sm font-medium capitalize', tab === t ? 'bg-yolk-500 text-ink-900' : 'text-white/60')}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-yolk-500" /></div>
      ) : tab === 'users' ? (
        <Card className="mt-6 !p-0 overflow-hidden">
          <div className="border-b border-white/5 p-4">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-9" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-white/40">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Credits</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isEditing = editing?.id === u.id
                  const row = isEditing ? editing : u
                  return (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{u.full_name || ', '}</p>
                        <p className="text-xs text-white/40">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={row.role}
                            onChange={(e) => setEditing({ ...row, role: e.target.value as Profile['role'] })}
                            className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span className={cn('rounded-full px-2 py-0.5 text-xs', u.role === 'admin' ? 'bg-yolk-500/15 text-yolk-400' : 'bg-white/10 text-white/60')}>{u.role}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={row.plan}
                            onChange={(e) => setEditing({ ...row, plan: e.target.value as Profile['plan'] })}
                            className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs"
                          >
                            {['starter', 'creator', 'studio', 'agency'].map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-white/70 capitalize">{u.plan}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={row.credits}
                            onChange={(e) => setEditing({ ...row, credits: Number(e.target.value) })}
                            className="w-24 !py-1"
                          />
                        ) : (
                          <span className="font-semibold text-yolk-400">{u.credits}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.suspended ? (
                          <span className="flex items-center gap-1 text-xs text-red-400"><Ban className="h-3 w-3" /> Suspended</span>
                        ) : (
                          <span className="text-xs text-emerald-400">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => saveUser(row)} loading={savingId === u.id}><Save className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>Edit</Button>
                            <Button
                              size="sm"
                              variant={u.suspended ? 'secondary' : 'danger'}
                              onClick={() => saveUser({ ...u, suspended: !u.suspended })}
                            >
                              {u.suspended ? 'Unsuspend' : 'Suspend'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-4 py-3">Title / Prompt</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="max-w-xs truncate px-4 py-3 text-white">{v.title || v.prompt}</td>
                  <td className="px-4 py-3 capitalize text-white/60">{v.mode}</td>
                  <td className="px-4 py-3 capitalize text-white/60">{v.status}</td>
                  <td className="px-4 py-3 text-white/40">{new Date(v.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
