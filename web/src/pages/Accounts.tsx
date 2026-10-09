import { useEffect, useState } from 'react'
import { Link2, CheckCircle2, ExternalLink, Unlink, AlertTriangle } from 'lucide-react'
import { Youtube, Instagram } from '@/components/BrandIcons'
import { useSocialAccounts } from '@/lib/hooks'
import { BASE_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import type { Platform } from '@/types'

export default function Accounts() {
  const { accounts, refresh } = useSocialAccounts()
  const [busy, setBusy] = useState<Platform | null>(null)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(`${BASE_URL}/api/health`)
      .then((r) => setBackendReachable(r.ok))
      .catch(() => setBackendReachable(false))
  }, [])

  const yt = accounts.find((a) => a.platform === 'youtube')
  const ig = accounts.find((a) => a.platform === 'instagram')

  async function connect(platform: Platform) {
    setBusy(platform)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch(`${BASE_URL}/api/social/${platform}/oauth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        alert(json.message || `${platform} OAuth isn't configured on the server yet. See SETUP.md.`)
      }
    } catch {
      alert('Could not reach the Autoviral backend. Is `npm run dev` running in /server?')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(platform: Platform) {
    await supabase.from('social_accounts').delete().eq('platform', platform)
    refresh()
  }

  return (
    <div>
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold text-white">
        <Link2 className="h-7 w-7 text-yolk-500" /> Connected accounts
      </h1>
      <p className="mt-1 text-white/50">Link Instagram and YouTube so Autoviral can post directly on your behalf.</p>

      {backendReachable === false && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-yolk-500/30 bg-yolk-500/10 p-4 text-sm text-yolk-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Backend not reachable</p>
            <p className="mt-1 text-yolk-300/80">
              Start the Autoviral server (<code className="rounded bg-black/30 px-1">cd server && npm run dev</code>) to enable real
              OAuth linking and posting.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15">
              <Youtube className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">YouTube</h3>
              <p className="text-xs text-white/40">Shorts & long-form uploads</p>
            </div>
          </div>
          {yt?.connected ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Connected as {yt.account_name || 'your channel'}
              </div>
              <Button variant="secondary" size="sm" onClick={() => disconnect('youtube')}>
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" onClick={() => connect('youtube')} loading={busy === 'youtube'}>
              <ExternalLink className="h-4 w-4" /> Connect YouTube
            </Button>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500/15">
              <Instagram className="h-6 w-6 text-pink-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white">Instagram</h3>
              <p className="text-xs text-white/40">Reels via connected Business account</p>
            </div>
          </div>
          {ig?.connected ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Connected as @{ig.account_name || 'yourbrand'}
              </div>
              <Button variant="secondary" size="sm" onClick={() => disconnect('instagram')}>
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </Button>
            </div>
          ) : (
            <Button className="mt-5 w-full" onClick={() => connect('instagram')} loading={busy === 'instagram'}>
              <ExternalLink className="h-4 w-4" /> Connect Instagram
            </Button>
          )}
        </Card>
      </div>

      <Card className="mt-8">
        <h3 className="font-display font-semibold text-white">Setting up real posting</h3>
        <p className="mt-2 text-sm text-white/60">
          Autoviral uses the real YouTube Data API and Instagram Graph API to post on your behalf. To activate this,
          the site owner needs to create a Google Cloud OAuth client and a Meta Developer app, then add the
          credentials to the server's <code className="rounded bg-black/30 px-1">.env</code>. Full steps are in{' '}
          <code className="rounded bg-black/30 px-1">SETUP.md</code>.
        </p>
      </Card>
    </div>
  )
}
