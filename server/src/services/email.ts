import nodemailer from 'nodemailer'

// Generic SMTP transactional email (works with Brevo, or any other SMTP
// provider -- Resend, SendGrid, Mailgun, etc. -- by just swapping the
// SMTP_* env vars). Chosen over a provider-specific SDK (previously the
// `resend` package) because Brevo lets you verify a single sender EMAIL
// ADDRESS (even a personal Gmail address, via a one-click confirmation),
// with no domain ownership/DNS verification required at all -- a better
// fit than Resend, which requires verifying an entire domain.
export const emailConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 is implicit TLS; 587 (Brevo's default) is STARTTLS, where
      // the connection starts plain and upgrades -- `secure: true` on 587
      // would break the handshake, so this must track the port, not be hardcoded.
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

const FROM = process.env.EMAIL_FROM || 'Autoviral <no-reply@example.com>'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!emailConfigured) {
    console.warn('[email] SMTP_HOST/SMTP_USER/SMTP_PASS not set, skipping email send to', opts.to)
    return
  }
  try {
    await getTransporter().sendMail({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
  } catch (err) {
    console.error('[email] failed to send email:', err instanceof Error ? err.message : err)
  }
}

export function wrapEmailHtml(title: string, bodyHtml: string): string {
  // Yellow/black branding matching the site's yolk/ink color scheme.
  return `
    <div style="background-color:#0d0d0f; padding:32px 16px; font-family: -apple-system, 'Segoe UI', sans-serif;">
      <div style="max-width:480px; margin:0 auto; background-color:#17171a; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:28px;">
        <div style="text-align:center; margin-bottom:20px;">
          <span style="display:inline-block; background-color:#ffb800; color:#0d0d0f; font-weight:800; font-size:16px; padding:6px 14px; border-radius:10px; letter-spacing:-0.5px;">
            Autoviral
          </span>
        </div>
        <h2 style="color:#ffffff; margin:0 0 16px; font-size:18px; text-align:center;">${title}</h2>
        <div style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.65);">${bodyHtml}</div>
      </div>
      <p style="margin-top: 20px; font-size: 11px; color: rgba(255,255,255,0.3); text-align:center;">Autoviral, AI video, on autopilot.</p>
    </div>
  `
}
