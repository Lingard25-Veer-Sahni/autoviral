import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '@/context/AuthContext'
import type { Channel, VideoRecord, SocialAccount, AppNotification } from '@/types'

export function useChannels() {
  const { user } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setChannels((data as Channel[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { channels, loading, refresh }
}

export function useVideos() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setVideos((data as VideoRecord[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
    if (!user) return
    const channel = supabase
      .channel('videos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'videos', filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, user])

  return { videos, loading, refresh }
}

/**
 * System-generated in-app notifications (currently just the "your video
 * failed, credits refunded" message, see server/src/services/notifications.ts
 * and supabase/migrations/0005_notifications.sql). Reads straight from
 * Supabase like useVideos/useChannels above; RLS scopes rows to the
 * signed-in user, and there's deliberately no client-side insert path, only
 * the backend's service-role key can create a notification.
 */
export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data as AppNotification[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
    if (!user) return
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, user])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user) return
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!unreadIds.length) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }, [notifications, user])

  const dismiss = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }, [])

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead, dismiss }
}

export function useSocialAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Explicitly exclude access_token/refresh_token, never ship encrypted
    // OAuth tokens to the browser, even though RLS already scopes rows to
    // their owner.
    const { data } = await supabase
      .from('social_accounts')
      .select('id, user_id, platform, account_name, avatar_url, connected, scopes, expires_at, created_at, updated_at')
      .eq('user_id', user.id)
    setAccounts((data as SocialAccount[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { accounts, loading, refresh }
}
