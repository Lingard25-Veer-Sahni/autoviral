import { Resend } from 'resend'

// Transactional email via Resend. Configured via RESEND_API_KEY and
// RESEND_FROM_EMAIL in server/.env. Best-effort: a failed email send should
// never take down the caller (video pipeline, notifications, etc.), errors
// are logged, not thrown. See notifications.ts, which calls sendEmail
// alongside every in-app notification so users get a copy by email too.
export const emailConfigured = Boolean(process.env.RESEND_API_KEY)

let client: Resend | null = null

function getClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

// Resend requires a verified sending domain in production; until you verify
// one on resend.com/domains, their shared onboarding@resend.dev address
// works for testing (only delivers to your own Resend account email).
const FROM = process.env.RESEND_FROM_EMAIL || 'Autoviral <onboarding@resend.dev>'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!emailConfigured) {
    console.warn('[email] RESEND_API_KEY not set, skipping email send to', opts.to)
    return
  }
  try {
    const { error } = await getClient().emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) {
      console.error('[email] Resend API error:', error)
    }
  } catch (err) {
    console.error('[email] failed to send email:', err instanceof Error ? err.message : err)
  }
}

export function wrapEmailHtml(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px;">${title}</h2>
      <div style="font-size: 14px; line-height: 1.6; color: #333;">${bodyHtml}</div>
      <p style="margin-top: 32px; font-size: 11px; color: #999;">Autoviral, AI video, on autopilot.</p>
    </div>
  `
}
