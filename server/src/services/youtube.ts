import { google } from 'googleapis'
import axios from 'axios'
import 'dotenv/config'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI

export const youtubeConfigured = Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI)

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

function client() {
  if (!youtubeConfigured) {
    throw new Error('YouTube OAuth is not configured on the server (missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI).')
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export function getYoutubeAuthUrl(state: string): string {
  const oauth2 = client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh_token issuance even on repeat connects
    scope: SCOPES,
    state,
  })
}

export interface YoutubeTokens {
  accessToken: string
  refreshToken: string | null
  expiryDate: number | null
  scope: string | null
}

export async function exchangeYoutubeCode(code: string): Promise<YoutubeTokens> {
  const oauth2 = client()
  const { tokens } = await oauth2.getToken(code)
  if (!tokens.access_token) {
    throw new Error('Google did not return an access token.')
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
    scope: tokens.scope ?? null,
  }
}

export async function getYoutubeChannel(accessToken: string): Promise<{ name: string | null; avatarUrl: string | null }> {
  const oauth2 = client()
  oauth2.setCredentials({ access_token: accessToken })
  const youtube = google.youtube({ version: 'v3', auth: oauth2 })
  const res = await youtube.channels.list({ part: ['snippet'], mine: true })
  const channel = res.data.items?.[0]
  return {
    name: channel?.snippet?.title ?? null,
    avatarUrl: channel?.snippet?.thumbnails?.default?.url ?? null,
  }
}

/** Refreshes an access token using the stored refresh token. Returns the new access token. */
export async function refreshYoutubeAccessToken(refreshToken: string): Promise<string> {
  const oauth2 = client()
  oauth2.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2.refreshAccessToken()
  if (!credentials.access_token) {
    throw new Error('Failed to refresh YouTube access token.')
  }
  return credentials.access_token
}

export interface UploadYoutubeShortInput {
  accessToken: string
  videoUrl: string
  title: string
  description: string
  hashtags: string[]
}

/** Streams the already-rendered video from Supabase Storage straight into a real YouTube Data API v3 upload. */
export async function uploadYoutubeShort(input: UploadYoutubeShortInput): Promise<{ videoId: string; url: string }> {
  const oauth2 = client()
  oauth2.setCredentials({ access_token: input.accessToken })
  const youtube = google.youtube({ version: 'v3', auth: oauth2 })

  const download = await axios.get<NodeJS.ReadableStream>(input.videoUrl, { responseType: 'stream' })

  const fullDescription = [input.description, input.hashtags.map((h) => `#${h}`).join(' ')]
    .filter(Boolean)
    .join('\n\n')

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: input.title.slice(0, 100),
        description: fullDescription.slice(0, 5000),
        tags: input.hashtags.slice(0, 15),
        categoryId: '22', // People & Blogs — reasonable default for AI-generated shorts
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: download.data,
    },
  })

  const videoId = res.data.id
  if (!videoId) {
    throw new Error('YouTube did not return a video id after upload.')
  }
  return { videoId, url: `https://www.youtube.com/shorts/${videoId}` }
}
