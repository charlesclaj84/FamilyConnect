/**
 * The two emails the APPLICATION sends, as opposed to the five GoTrue sends.
 *
 * Both carry data GoTrue has never heard of — which family, who invited you — which is
 * the whole reason they cannot be templates in `supabase/templates/`. Chrome and voice
 * come from ./layout.ts; the reasoning behind both is in supabase/templates/README.md.
 *
 * A plain module, deliberately: see the header of ./send.ts.
 */

import { APP_NAME } from '@/lib/brand'
// The `@/` alias rather than './layout', matching the rest of the codebase. Not merely
// stylistic: tests/rls loads these modules through its own resolver, which does not
// resolve extensionless relative specifiers — a bare './layout' fails every case that
// touches invitations or approvals with "Cannot find module".
import { esc, renderEmailFrom } from '@/lib/email/layout'

export interface ComposedEmail {
  subject: string
  html: string
  tag: string
}

/**
 * Sent when an administrator admits an applicant.
 *
 * The counterpart to the in-app notification `decide()` already writes. Both, not
 * either: the notification is what they see if they happen to come back, and the email
 * is what brings them back. Somebody who applied and was told to wait has no reason to
 * open the app again on the day the decision is made, and that gap was measured in days
 * rather than minutes.
 */
export function membershipApprovedEmail(o: {
  origin: string
  firstName: string
  familyName: string
}): ComposedEmail {
  const name = o.firstName.trim()
  return {
    subject: `You have been approved to join ${o.familyName}`,
    tag: 'membership-approved',
    html: renderEmailFrom(o.origin, {
      preheader: `You&rsquo;re in. ${esc(o.familyName)} is ready when you are.`,
      heading: name ? `Welcome, ${name}` : 'Welcome',
      paragraphs: [
        `Your request to join <strong style="font-weight:600;">${esc(o.familyName)}</strong> on ${esc(APP_NAME)} has been approved.`,
        'Everything is open to you now — the family tree, photographs, events, announcements and the rest. A good first step is filling in your own details, so the people who know you can find you.',
      ],
      button: {
        href: `${o.origin}/dashboard`,
        label: 'Open GENORRA',
        widthPx: 200,
      },
      footnote:
        'You are receiving this because someone with this address asked to join a family '
        + `on ${esc(APP_NAME)}.`,
    }),
  }
}

/**
 * Sent when someone creates an invitation.
 *
 * THE LINK IN THIS EMAIL IS THE CREDENTIAL. `create_family_invitation()` returns the
 * token once and stores only its SHA-256, so this message is the only place it will ever
 * exist in readable form. Two consequences the caller must honour:
 *
 *   * It must not be logged, and the token must not be put in a subject line, a
 *     notification body, or anywhere a third party can read it back.
 *   * It goes to exactly the address the invitation was minted for — never to a list,
 *     never CC'd to the inviter. The address narrows who may redeem ON TOP of the
 *     secret; mailing the secret anywhere else discards that second factor.
 *
 * The pre-approved and ordinary versions say different things because they mean
 * different things, and an invitee who is told "an administrator will review this" and
 * is then admitted instantly has been misled in the harmless direction — but one told
 * the reverse turns up expecting access they do not have.
 */
export function familyInvitationEmail(o: {
  origin: string
  familyName: string
  /** Display name of whoever sent it. Omitted rather than faked when unknown. */
  inviterName?: string | null
  /**
   * What the inviter called the invitee — required on the invitation since
   * 20260813000002, and used here only to open with a name instead of an address.
   *
   * IT IS NOT A CLAIM ABOUT WHO HOLDS THE MAILBOX, and the copy must never imply one.
   * The token is the credential and the address narrows it; this is the inviter's label
   * for a person, typed from memory, and a forwarded message greeting the wrong Ada
   * should read as a mistake rather than as recognition. Escaped like everything else
   * here — it is free text from a form, rendered in somebody's mail client.
   */
  inviteeFirstName?: string | null
  token: string
  preApproved: boolean
  /** Days until it lapses, for the fine print. */
  expiresInDays: number
}): ComposedEmail {
  const link = `${o.origin}/invite/${encodeURIComponent(o.token)}`
  const family = esc(o.familyName)
  const inviter = o.inviterName?.trim() ? esc(o.inviterName.trim()) : null
  const greetingName = o.inviteeFirstName?.trim() ? esc(o.inviteeFirstName.trim()) : null
  const greeting = greetingName ? `Hi ${greetingName},` : null

  const opening = inviter
    ? `<strong style="font-weight:600;">${inviter}</strong> has invited you to join <strong style="font-weight:600;">${family}</strong> on ${esc(APP_NAME)} — where a family keeps its stories, its photographs, its plans and the record of who belongs to whom.`
    : `You have been invited to join <strong style="font-weight:600;">${family}</strong> on ${esc(APP_NAME)} — where a family keeps its stories, its photographs, its plans and the record of who belongs to whom.`

  const second = o.preApproved
    ? 'Accept below and you are in straight away. There is no family code to find and nothing to fill in first.'
    : 'Accept below to set up your account. An administrator will then admit you, so there may be a short wait after that step.'

  return {
    subject: inviter
      ? `${o.inviterName!.trim()} invited you to join ${o.familyName}`
      : `You are invited to join ${o.familyName}`,
    tag: 'family-invitation',
    html: renderEmailFrom(o.origin, {
      preheader: `${family} kept a place for you. The invitation lasts ${o.expiresInDays} days.`,
      heading: 'Your family kept a place for you',
      // The greeting is its own paragraph and is DROPPED rather than defaulted when
      // there is no name — invitations created before 20260813000002 have none, and
      // "Hi ," reads worse than no greeting at all.
      paragraphs: greeting ? [greeting, opening, second] : [opening, second],
      button: { href: link, label: 'Accept the invitation', widthPx: 240 },
      fine: `This invitation is for this address only and expires in ${o.expiresInDays} days.`,
      fallbackUrl: esc(link),
      footnote:
        'If this is not something you were expecting, you can safely ignore it. No '
        + 'account is created until you accept, and nobody is told either way.',
    }),
  }
}
