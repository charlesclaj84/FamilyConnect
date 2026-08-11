/**
 * Sending mail from the application, over Resend's HTTP API.
 *
 * NOT A SERVER ACTION, and must never become one — same rule as lib/notifications.ts.
 * An export of a `'use server'` file is a public HTTP endpoint, so a `sendEmail` export
 * there would be an open relay: any signed-in user could POST an arbitrary recipient,
 * subject and body and have it delivered over GENORRA's authenticated domain. That is
 * worse than spam; it is phishing with our SPF and DKIM on it. A plain module has no URL.
 *
 * WHY HTTP AND NOT SMTP, AND WHY NOT THE `resend` PACKAGE
 *   Supabase's GoTrue speaks SMTP to Resend for the five auth emails. This app speaks
 *   HTTPS to the same account for its own two. One credential, two protocols, because
 *   GoTrue only does SMTP and a serverless function only comfortably does HTTPS.
 *   The REST call is four lines, so the SDK would be a dependency for a `fetch`.
 *
 * FAIL-SOFT, ALWAYS. Every function here returns a result and never throws. The calls
 * sit after a decision has already been committed — a membership approved, an invitation
 * minted — and an unreachable mail provider must not roll those back or surface as a
 * failure to the administrator who just clicked Approve. The caller logs and carries on.
 * That is a deliberate trade and it has a cost: a dropped email is invisible to the user
 * who was expecting it. `deliveryNote()` below is what the UI says instead of pretending.
 */

import { APP_NAME } from '@/lib/brand'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface SendResult {
  sent: boolean
  /** Present when `sent` is false. Server-side diagnostics; never shown to a user. */
  error?: string
}

/**
 * The From address.
 *
 * Must be on a domain verified in Resend, or every send 403s. `noreply@` is the default
 * rather than a decision — set EMAIL_FROM to a monitored mailbox if replies should reach
 * a human, which for a family product is worth considering.
 */
function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || `${APP_NAME} <noreply@genorra.com>`
}

/**
 * The origin links and artwork are built from.
 *
 * DERIVED FROM CONFIGURATION, NEVER FROM A REQUEST HEADER. The obvious alternative —
 * reading `Host` or `X-Forwarded-Host` off the incoming request — is attacker-controlled,
 * and what it controls here is the hostname inside a link that an email tells somebody
 * to trust. Host-header poisoning turning a password-reset or invitation link into an
 * attacker's domain is a well-worn bug and this is exactly its shape.
 *
 * NEXT_PUBLIC_SITE_URL should be set on the deployment to the same value as
 * `auth.site_url` in supabase/config.toml, so application email and GoTrue email agree
 * about where the product lives.
 */
export function emailOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return 'https://genorra.com'
}

/**
 * Deliver one message.
 *
 * `to` is a single address on purpose. Resend accepts an array, and a shared array is
 * how one family's members end up seeing another recipient's address in the To line.
 * Fan-out is the caller's job, one call per person.
 */
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  /** Shown in Resend's dashboard for grouping. Not sent to the recipient. */
  tag?: string
}): Promise<SendResult> {
  // RFC 2606 reserves .test, .example, .invalid and .localhost precisely so they can
  // never resolve. Mailing one can only ever produce a hard bounce, and bounce rate is
  // what mailbox providers score a sending domain on — so this is reputation protection,
  // not tidiness.
  //
  // It is also load-bearing for `tests/rls`: its positive controls call the real
  // inviteMember with addresses like legit.invite@rls.test, so a developer who happens
  // to have RESEND_API_KEY in their environment would fire live sends at nonexistent
  // domains every time they ran the suite.
  if (/\.(test|example|invalid|localhost)$/i.test(opts.to.trim())) {
    console.warn(`[email] refusing reserved-TLD recipient ${opts.to} — "${opts.subject}" not sent`)
    return { sent: false, error: 'reserved TLD' }
  }

  const key = process.env.RESEND_API_KEY?.trim()

  // No key configured is the normal state of a fresh local checkout, and it must not
  // crash a signup or an approval. Reported, not thrown.
  if (!key) {
    console.warn(`[email] RESEND_API_KEY is not set — "${opts.subject}" was not sent to ${opts.to}`)
    return { sent: false, error: 'RESEND_API_KEY is not set' }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.tag ? { tags: [{ name: 'kind', value: opts.tag }] } : {}),
      }),
      // A mail provider having a bad day must not hold a server action open until the
      // platform's own timeout kills it, taking the user's click with it.
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      // Resend returns JSON with a `message`. Read it as text so a proxy's HTML error
      // page does not throw inside the error path.
      const detail = await res.text().catch(() => '')
      console.error(`[email] ${res.status} sending "${opts.subject}": ${detail.slice(0, 300)}`)
      return { sent: false, error: `${res.status}` }
    }

    return { sent: true }
  } catch (e) {
    // Network failure, DNS, timeout. Never rethrown — see the header.
    const message = e instanceof Error ? e.message : 'unknown'
    console.error(`[email] failed sending "${opts.subject}": ${message}`)
    return { sent: false, error: message }
  }
}

/**
 * What the UI should say about a send that did not happen.
 *
 * The point of surfacing this at all: an invitation whose email silently failed leaves
 * the inviter believing their cousin has been contacted, and the cousin waiting. The
 * dialog shows the link as a fallback in exactly that case — which is the OLD behaviour,
 * kept as the failure path rather than as the normal one.
 */
export function deliveryNote(result: SendResult): string | null {
  return result.sent ? null : 'We could not send the email just now.'
}
