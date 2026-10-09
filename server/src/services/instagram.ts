import axios from 'axios'
import 'dotenv/config'

const APP_ID = process.env.META_APP_ID
const APP_SECRET = process.env.META_APP_SECRET
const REDIRECT_URI = process.env.META_REDIRECT_URI

export const instagramConfigured = Boolean(APP_ID && APP_SECRET && REDIRECT_URI)

const GRAPH_VERSION = 'v21.0'
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`

// Instagram content publishing requires a Meta Business app, an Instagram
// Business/Creator account linked to a Facebook Page, and these permissions.
const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
]

function requireConfigured() {
  if (!instagramConfigured) {
    throw new Error('Instagram OAuth is not configured on the server (missing META_APP_ID/SECRET/REDIRECT_URI).')
  }
}

export function getInstagramAuthUrl(state: string): string {
  requireConfigured()
  const params = new URLSearchParams({
    client_id: APP_ID!,
    redirect_uri: REDIRECT_URI!,
    state,
    scope: SCOPES.join(','),
    response_type: 'code',
  })
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}

async function exchangeCodeForShortLivedToken(code: string): Promise<string> {
  const res = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: APP_ID,
      client_secret: APP_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    },
  })
  return res.data.access_token
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const res = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  })
  return res.data.access_token
}

export interface InstagramAccountLink {
  /** Long-lived Page access token used for every publish call, this is what we store, encrypted. */
  pageAccessToken: string
  /** The Instagram Business Account id that owns the connected Page. */
  igUserId: string
  username: string | null
  avatarUrl: string | null
}

/**
 * Full OAuth callback flow: short-lived user token -> long-lived user token ->
 * find the user's Facebook Pages -> find the Page's linked Instagram Business
 * Account -> fetch that Page's long-lived access token (used for publishing).
 */
export async function completeInstagramLink(code: string): Promise<InstagramAccountLink> {
  requireConfigured()
  const shortLived = await exchangeCodeForShortLivedToken(code)
  const longLivedUserToken = await exchangeForLongLivedToken(shortLived)

  const pagesRes = await axios.get(`${GRAPH_URL}/me/accounts`, {
    params: { access_token: longLivedUserToken, fields: 'id,name,access_token,instagram_business_account' },
  })
  const pages = pagesRes.data.data as Array<{
    id: string
    name: string
    access_token: string
    instagram_business_account?: { id: string }
  }>

  const pageWithIg = pages.find((p) => p.instagram_business_account?.id)
  if (!pageWithIg?.instagram_business_account) {
    throw new Error(
      'No Instagram Business/Creator account is linked to any of your Facebook Pages. Link one in Meta Business Suite first.'
    )
  }

  const igUserId = pageWithIg.instagram_business_account.id
  const profileRes = await axios.get(`${GRAPH_URL}/${igUserId}`, {
    params: { fields: 'username,profile_picture_url', access_token: pageWithIg.access_token },
  })

  return {
    pageAccessToken: pageWithIg.access_token,
    igUserId,
    username: profileRes.data.username ?? null,
    avatarUrl: profileRes.data.profile_picture_url ?? null,
  }
}

export interface PublishInstagramReelInput {
  pageAccessToken: string
  igUserId: string
  videoUrl: string
  caption: string
  hashtags: string[]
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Real Instagram Graph API container -> publish flow for a Reel from a public video URL. */
export async function publishInstagramReel(input: PublishInstagramReelInput): Promise<{ mediaId: string; url: string | null }> {
  const fullCaption = [input.caption, input.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join('\n\n')

  const createRes = await axios.post(`${GRAPH_URL}/${input.igUserId}/media`, null, {
    params: {
      media_type: 'REELS',
      video_url: input.videoUrl,
      caption: fullCaption.slice(0, 2200),
      access_token: input.pageAccessToken,
    },
  })
  const creationId = createRes.data.id as string

  // Instagram processes the uploaded video asynchronously, poll until it's ready to publish.
  let status = 'IN_PROGRESS'
  for (let attempt = 0; attempt < 20 && status !== 'FINISHED'; attempt++) {
    await sleep(3000)
    const statusRes = await axios.get(`${GRAPH_URL}/${creationId}`, {
      params: { fields: 'status_code', access_token: input.pageAccessToken },
    })
    status = statusRes.data.status_code
    if (status === 'ERROR') {
      throw new Error('Instagram failed to process the video container.')
    }
  }
  if (status !== 'FINISHED') {
    throw new Error('Timed out waiting for Instagram to finish processing the video.')
  }

  const publishRes = await axios.post(`${GRAPH_URL}/${input.igUserId}/media_publish`, null, {
    params: { creation_id: creationId, access_token: input.pageAccessToken },
  })
  const mediaId = publishRes.data.id as string

  let permalink: string | null = null
  try {
    const permalinkRes = await axios.get(`${GRAPH_URL}/${mediaId}`, {
      params: { fields: 'permalink', access_token: input.pageAccessToken },
    })
    permalink = permalinkRes.data.permalink ?? null
  } catch {
    // Permalink lookup is best-effort; publishing already succeeded without it.
  }

  return { mediaId, url: permalink }
}
