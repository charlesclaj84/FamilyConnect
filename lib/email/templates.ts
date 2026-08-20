/**
 * The three emails the APPLICATION sends, as opposed to the five GoTrue sends.
 *
 * All three carry data GoTrue has never heard of — which family, who invited you, which
 * family somebody is about to switch off — which is the whole reason they cannot be
 * templates in `supabase/templates/`. Chrome and voice come from ./layout.ts; the
 * reasoning behind both is in supabase/templates/README.md.
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
        'Everything is open to you now — the family tree, photographs, gatherings, announcements and the rest. A good first step is filling in your own details, so the people who know you can find you.',
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

/**
 * The six-digit code that confirms removing a family.
 *
 * ── IT GOES TO THE PERSON WHO ASKED, AND NOWHERE ELSE ──────────────────────────────
 * `requestFamilyRemovalCode` takes no arguments at all and resolves the address from the
 * session, which is what stops this being a mail cannon (the rule `resendConfirmationEmail`
 * is built on). So the recipient here is by construction the acting administrator, and the
 * copy can address them as such rather than hedging about who might be reading.
 *
 * ── NO BUTTON, DELIBERATELY ────────────────────────────────────────────────────────
 * Every other message this module composes ends in a link, because every other one is
 * asking somebody to come and do something. This one is a factor in a confirmation that is
 * already open in another window: the code is the payload, and a "Remove the family" button
 * in an email would be a one-click removal reachable from anybody who ever sees the
 * message — a forwarded inbox, a shared laptop, a mail client preview. The code is typed
 * into a form that has already proved who is sitting in front of it.
 *
 * ── IT SAYS WHAT REMOVAL IS, BECAUSE THIS MAY BE THE WARNING ───────────────────────
 * If somebody else has got at the account, this email is the first and possibly only
 * notice its owner gets. So it states plainly what the code does, that nothing is deleted,
 * and what to do if they did not ask — which is the same job a password-reset notification
 * does and the reason that copy exists.
 */
export function familyRemovalCodeEmail(o: {
  origin: string
  familyName: string
  /** The digits. Never logged, never put in the subject, never stored in plaintext. */
  code: string
  /** How long it lasts, for the fine print. Comes from the action, so the two agree. */
  expiresInMinutes: number
}): ComposedEmail {
  const family = esc(o.familyName)
  return {
    subject: `Your code to remove ${o.familyName}`,
    tag: 'family-removal-code',
    html: renderEmailFrom(o.origin, {
      preheader: `The code lasts ${o.expiresInMinutes} minutes and can be used once.`,
      heading: 'Confirm removing this family',
      paragraphs: [
        `Somebody signed in as you asked to remove <strong style="font-weight:600;">${family}</strong> from ${esc(APP_NAME)}. Type this code into the confirmation to finish:`,
        // MONOSPACE AND SPACED OUT, because this is read off a screen and typed into
        // another one. The inline style is the same sanctioned exception every colour in
        // this module is: a mail client loads no stylesheet of ours.
        `<div style="font-family:'SF Mono',Consolas,Menlo,monospace; font-size:32px; font-weight:700; letter-spacing:8px; text-align:center; padding:8px 0;">${esc(o.code)}</div>`,
        'Removing a family closes it for everybody in it — nobody can open it, join it or accept an invitation to it. <strong style="font-weight:600;">Nothing is deleted.</strong> Every payment, photograph, event and person stays exactly where it is, and GENORRA support can put the family back.',
      ],
      fine: `This code lasts ${o.expiresInMinutes} minutes and can be used once.`,
      footnote:
        'If you did not ask for this, do nothing — the code expires on its own and the '
        + 'family stays exactly as it is. Then change your password, because somebody '
        + 'else is signed in as you.',
    }),
  }
}
