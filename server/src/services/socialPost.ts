import { supabaseAdmin } from '../supabaseAdmin.js'
import { encryptToken, decryptToken } from './tokenCrypto.js'
import { refreshYoutubeAccessToken, uploadYoutubeShort } from './youtube.js'
import { publishInstagramReel } from './instagram.js'
import type { Platform } from '../types.js'

interface SocialAccountRow {
  id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  platform_account_id: string | null
  account_name: string | null
}

async function getConnectedAccount(userId: string, platform: Platform): Promise<SocialAccountRow | null> {
  const { data } = await supabaseAdmin
    .from('social_accounts')
    .select('id, access_token, refresh_token, expires_at, platform_account_id, account_name')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('connected', true)
    .maybeSingle()
  return (data as SocialAccountRow | null) ?? null
}

export interface PostVideoInput {
  userId: string
  videoId: string
  platform: Platform
  videoUrl: string
  title: string
  description: string
  hashtags: string[]
}

/** Posts an already-rendered video to a connected platform using real APIs (YouTube Data API v3 / Instagram Graph API). */
export async function postVideoToPlatform(input: PostVideoInput): Promise<{ url: string | null }> {
  const account = await getConnectedAccount(input.userId, input.platform)
  if (!account) {
    throw new Error(`${input.platform} is not connected. Connect it from the Accounts page first.`)
  }

  if (input.platform === 'youtube') {
    let accessToken = decryptToken(account.access_token)
    const refreshToken = decryptToken(account.refresh_token)
    const expiresAt = account.expires_at ? new Date(account.expires_at).getTime() : 0

    if (!accessToken || Date.now() > expiresAt - 60_000) {
      if (!refreshToken) {
        throw new Error('Your YouTube session has expired. Please reconnect your account.')
      }
      accessToken = await refreshYoutubeAccessToken(refreshToken)
      await supabaseAdmin
        .from('social_accounts')
        .update({
          access_token: encryptToken(accessToken),
          expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
        })
        .eq('id', account.id)
    }

    const result = await uploadYoutubeShort({
      accessToken,
      videoUrl: input.videoUrl,
      title: input.title,
      description: input.description,
      hashtags: input.hashtags,
    })
    return { url: result.url }
  }

  if (input.platform === 'instagram') {
    const pageAccessToken = decryptToken(account.access_token)
    const igUserId = account.platform_account_id
    if (!pageAccessToken || !igUserId) {
      throw new Error('Your Instagram connection is incomplete or expired. Please reconnect your account.')
    }

    const result = await publishInstagramReel({
      pageAccessToken,
      igUserId,
      videoUrl: input.videoUrl,
      caption: input.title,
      hashtags: input.hashtags,
    })
    return { url: result.url }
  }

  throw new Error(`Unsupported platform: ${input.platform}`)
}
