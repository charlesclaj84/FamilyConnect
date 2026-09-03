import 'server-only'

import { APP_NAME } from '@/lib/brand'
import { esc, renderEmailFrom } from '@/lib/email/layout'
import type { ComposedEmail } from '@/lib/email/templates'
import { emailT } from '@/lib/email/strings'
import { BASE_LOCALE } from '@/lib/i18n/locales'

/**
 * The five emails GoTrue used to render, composed here instead.
 *
 * ── WHY THESE MOVED, AND WHAT IT BOUGHT ────────────────────────────────────────────
 * `supabase/templates/*.html` are rendered and sent by GoTrue, which knows nothing about
 * `people.locale` and substitutes a handful of `{{ .Token }}`-shaped variables. One body is
 * one body: no amount of editing those files makes them per-reader. So the first mail a new
 * member ever received — the one that decides whether they get in at all — was English for
 * everybody, while every message the APP composes was already translated.
 *
 * `app/api/auth/send-email/route.ts` is the Send Email hook that replaces them, and these are
 * what it composes. The words are the ones those five templates carried, moved across rather
 * than rewritten, so a reader who saw the old mail sees the same message.
 *
 * ── THE TEMPLATES ARE DELETED, AND THIS FILE IS NOW THE ONLY COPY — 2026-09-03 ─────
 * This said "THE TEMPLATES ARE NOT DELETED, AND THAT IS DELIBERATE" while the hook was being
 * proven. It is proven, they are gone, and `npm run email:push` and its script went with
 * them: `supabase/config.toml` declares the five SUBJECTS and no `content_path`, so there is
 * nothing left in the repo for GoTrue to render.
 *
 * **SO THE ENGLISH EXISTS ONCE.** That was the whole cost of the fallback and the reason the
 * HTML was frozen rather than maintained — two copies both edited is how they come to
 * disagree. A wording change is made here and reaches production on the next deploy, with
 * nothing to keep in step.
 *
 * ── WHAT A ROLLBACK NOW FALLS BACK TO, WHICH IS NOT NOTHING ────────────────────────
 * `email:push` only ever wrote, so the bodies it last pushed are STILL STORED on the hosted
 * project. Disabling the hook therefore lands on correct English mail rather than on GoTrue's
 * defaults — which link with `{{ .ConfirmationURL }}`, pointing at GoTrue rather than at
 * `/auth/confirm`, and are wrong for this app. There is no longer a repo copy of those bytes,
 * so recovering or reading them is a dashboard operation.
 *
 * THE LOCAL STACK IS THE ONE PLACE THAT REGRESSED, and it is development-only:
 * `[auth.hook.send_email]` is `enabled = false` there on purpose, so a local signup now gets
 * GoTrue's default body and its fragment bug. `npm run auth-email:check` is the answer — it
 * turns the hook on, walks all five flows in all three languages, and turns it off again.
 *
 * ── EVERY LINK IS BUILT FROM `emailOrigin()`, NEVER FROM THE PAYLOAD ──────────────
 * `email_data.site_url` in the hook payload is GoTrue's OWN api url — measured as
 * `http://127.0.0.1:54321/auth/v1` locally, which is not a page a reader can open. The origin
 * comes from configuration, as it does for every other email in this folder: `Host` is
 * attacker-controlled and this string ends up in a link somebody is told to trust.
 *
 * ── THE `type=` IN EACH URL MATCHES THE OLD TEMPLATE EXACTLY ──────────────────────
 * `/auth/confirm` passes it to `verifyOtp`, which refuses a hash presented under the wrong
 * type. Getting one wrong produces a link that looks right and fails on click, for one flow
 * only, which is the sort of thing nobody notices until a member cannot get in.
 */

/** What `/auth/confirm` is told the hash is for. Mirrors the retired templates one for one. */
type ConfirmType = 'signup' | 'recovery' | 'invite' | 'email_change'

function confirmUrl(o: {
  origin: string
  tokenHash: string
  type: ConfirmType
  /** Where to land afterwards. Absent for the two that have their own screen. */
  next?: string
}): string {
  const next = o.next ? `&next=${encodeURIComponent(o.next)}` : ''
  return `${o.origin}/auth/confirm`
    + `?token_hash=${encodeURIComponent(o.tokenHash)}`
    + `&type=${o.type}${next}`
}

/**
 * The 8-digit code, in the monospace block the removal-code mail uses.
 *
 * A COPY OF `templates.ts`' PRIVATE HELPER rather than an import, and that is the one
 * duplication in this file worth arguing for: that one is `codeBlock` in a module this must
 * not import (it would drag six unrelated composers into the auth path), and the markup is
 * four attributes rather than a rule. Kept identical on purpose — a code block that looked
 * different in an auth email would read as a different product.
 */
function codeBlock(code: string): string {
  return '<div style="font-family:\'SF Mono\',Consolas,Menlo,monospace; font-size:30px;'
    + ' letter-spacing:6px; font-weight:600; color:#6b2d3a; text-align:center;'
    + ' padding:8px 0 2px 0;">' + code + '</div>'
}

/** 1. Confirm the address on a new account. */
export function authConfirmEmail(o: {
  origin: string
  tokenHash: string
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const app = esc(APP_NAME)
  return {
    subject: `${APP_NAME} - ${t('email.auth.confirm.subject')}`,
    tag: 'auth-confirm',
    html: renderEmailFrom(o.origin, {
      t,
      preheader: t('email.auth.confirm.preheader'),
      heading: t('email.auth.confirm.heading'),
      paragraphs: [
        t('email.auth.confirm.p1', { app }),
        t('email.auth.confirm.p2'),
      ],
      button: {
        // `next=/dashboard` — a confirmed member lands on the Dashboard, which is the holding
        // screen while their membership is pending and the real thing once it is not.
        href: confirmUrl({ ...o, type: 'signup', next: '/dashboard' }),
        label: t('email.auth.confirm.button'),
        widthPx: 290,
      },
      fine: t('email.auth.confirm.fine'),
      fallbackUrl: confirmUrl({ ...o, type: 'signup', next: '/dashboard' }),
      footnote: t('email.auth.confirm.footnote', { app }),
    }),
  }
}

/** 2. Choose a new password. */
export function authRecoveryEmail(o: {
  origin: string
  tokenHash: string
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const app = esc(APP_NAME)
  // NO `next`. `/auth/confirm` sends a recovery straight to `/update-password`, which is the
  // one screen that can act on it — a `next` here would take the member somewhere else with a
  // recovery session and nothing to do with it.
  const href = confirmUrl({ ...o, type: 'recovery' })
  return {
    subject: `${APP_NAME} - ${t('email.auth.recovery.subject')}`,
    tag: 'auth-recovery',
    html: renderEmailFrom(o.origin, {
      t,
      preheader: t('email.auth.recovery.preheader'),
      heading: t('email.auth.recovery.heading'),
      paragraphs: [t('email.auth.recovery.p1', { app })],
      button: { href, label: t('email.auth.recovery.button'), widthPx: 250 },
      fine: t('email.auth.recovery.fine'),
      fallbackUrl: href,
      footnote: t('email.auth.recovery.footnote'),
    }),
  }
}

/**
 * 3. GoTrue's own invite — `admin.inviteUserByEmail`, service role only.
 *
 * NOT the family invitation. `familyInvitationEmail` in `templates.ts` is what a member
 * actually sends, and it names the family and the person who invited them. This exists
 * because the hook must answer for every action type GoTrue can produce, and answering an
 * unhandled one with a failure would break that flow silently.
 */
export function authInviteEmail(o: {
  origin: string
  tokenHash: string
  /** The invited address. Shown, because it may not be the one the reader expected. */
  email: string
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const app = esc(APP_NAME)
  const href = confirmUrl({ ...o, type: 'invite', next: '/dashboard' })
  return {
    subject: `${APP_NAME} - ${t('email.auth.invite.subject')}`,
    tag: 'auth-invite',
    html: renderEmailFrom(o.origin, {
      t,
      preheader: t('email.auth.invite.preheader', { app }),
      heading: t('email.auth.invite.heading'),
      paragraphs: [
        t('email.auth.invite.p1', { email: esc(o.email), app }),
        t('email.auth.invite.p2'),
      ],
      button: { href, label: t('email.auth.invite.button'), widthPx: 250 },
      fine: t('email.auth.invite.fine'),
      fallbackUrl: href,
      footnote: t('email.auth.invite.footnote'),
    }),
  }
}

/**
 * 4. The reauthentication code.
 *
 * NO BUTTON AND NO LINK. The code is typed into a screen the reader already has open, and a
 * one-click confirmation reachable from a forwarded inbox would defeat the gate entirely —
 * the same argument `familyRemovalCodeEmail` and `processorDisconnectCodeEmail` both make.
 */
export function authReauthEmail(o: {
  origin: string
  /** The digits. Never logged, never in the subject, never stored. */
  token: string
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  return {
    subject: `${APP_NAME} - ${t('email.auth.reauth.subject')}`,
    tag: 'auth-reauth',
    html: renderEmailFrom(o.origin, {
      t,
      preheader: t('email.auth.reauth.preheader'),
      heading: t('email.auth.reauth.heading'),
      paragraphs: [
        t('email.auth.reauth.p1'),
        codeBlock(esc(o.token)),
      ],
      fine: t('email.auth.reauth.fine'),
      footnote: t('email.auth.reauth.footnote'),
    }),
  }
}

/**
 * 5. The address change, which is TWO emails.
 *
 * ── ONE HOOK CALL, TWO MESSAGES, AND THE PAYLOAD SAYS SO ──────────────────────────
 * Measured against GoTrue v2.195.0: `updateUser({ email })` fires the hook ONCE, with
 * `email_data.token_hash` for the address the account has now and `token_hash_new` for the
 * one it is moving to — and `user.email` is still the OLD address while `user.new_email`
 * holds the new one. So the route sends both from a single call, and a handler that sent one
 * would leave a change that can never complete: `secure_email_change_enabled` requires both
 * halves.
 *
 * `which` decides the copy AND the token, which is why it is one function rather than two:
 * the two messages differ by which address they are addressed to and nothing else, and
 * splitting them would be two places to keep one link shape.
 */
export function authEmailChangeEmail(o: {
  origin: string
  tokenHash: string
  /** The address the account has now. */
  email: string
  /** The address it is moving to. */
  newEmail: string
  which: 'old' | 'new'
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const app = esc(APP_NAME)
  const k = o.which === 'old' ? 'changeOld' : 'changeNew'
  const href = confirmUrl({ ...o, type: 'email_change' })
  return {
    subject: `${APP_NAME} - ${t(`email.auth.${k}.subject`)}`,
    tag: `auth-email-change-${o.which}`,
    html: renderEmailFrom(o.origin, {
      t,
      preheader: t(`email.auth.${k}.preheader`),
      heading: t(`email.auth.${k}.heading`),
      paragraphs: [
        t(`email.auth.${k}.p1`, { app, email: esc(o.email), newEmail: esc(o.newEmail) }),
        t(`email.auth.${k}.p2`),
      ],
      button: { href, label: t(`email.auth.${k}.button`), widthPx: 250 },
      fine: t(`email.auth.${k}.fine`),
      fallbackUrl: href,
      footnote: t(`email.auth.${k}.footnote`),
    }),
  }
}
