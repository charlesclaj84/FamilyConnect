import type { Catalogue } from '@/lib/i18n/t'

/**
 * The words in the mail the APP sends. English, the source.
 *
 * ── WHY THIS IS A SECOND BUNDLE AND NOT MORE KEYS IN `lib/i18n/en.ts` ───────────────
 * `lib/i18n/catalogues.ts` is a STATIC import, so every string in it ships in the browser
 * bundle — which is the right trade for the shell (a client component has to reach it with no
 * provider and no loading state) and the wrong one for this. Email prose is read by a server
 * action composing a message and by nothing else; putting it in the client bundle would send
 * every reader the text of six emails they will never see rendered in a browser.
 *
 * `lib/i18n/t.ts` names that threshold and this is the first case to cross it. The manual is
 * the second, in Phase 5, and it gets its own bundle for the same reason.
 *
 * **So this module must never be imported from a `'use client'` file.** `i18n:check` asserts
 * that, because the failure is silent: the import works, the strings render, and the bundle
 * quietly grows. Same shape as `lib/meta/no-client-secrets.test.ts` catching `ZONE_HINT_COOKIE`
 * dragging the service-role client across the boundary.
 *
 * ── THE INTERPOLATED VALUES ARE ALREADY ESCAPED ────────────────────────────────────
 * Every `{placeholder}` here lands inside an HTML email, and the caller escapes what it passes.
 * That division is deliberate and must hold: `esc()` is applied at the CALL SITE in
 * `templates.ts`, where it is visible next to the value being escaped, rather than inside the
 * catalogue where a translator editing a sentence could not see it.
 *
 * The strings themselves DO contain markup — `<strong>` around a family's name, a `<div>` for
 * the code block — because the emphasis is part of the sentence and moves with its word order.
 * A translator must keep the tags; `i18n:check` cannot verify that, which is why the tags are
 * kept few and simple.
 *
 * ── SUBJECTS ARE PLAIN TEXT ────────────────────────────────────────────────────────
 * No markup, and the caller passes the RAW value rather than the escaped one — a subject line
 * is not HTML and `&amp;` in one is a visible defect. Worth stating because every other string
 * here goes the other way.
 */
export const emailEn: Catalogue = {
  // ── MEMBERSHIP APPROVED ──────────────────────────────────────────────────────────
  'email.approved.subject': 'You have been approved to join {family}',
  'email.approved.preheader': 'You’re in. {family} is ready when you are.',
  'email.approved.heading': 'Welcome',
  'email.approved.headingNamed': 'Welcome, {name}',
  'email.approved.p1':
    'Your request to join <strong style="font-weight:600;">{family}</strong> on {app} has been '
    + 'approved.',
  'email.approved.p2':
    'Everything is open to you now — the family tree, photographs, gatherings, announcements and '
    + 'the rest. A good first step is filling in your own details, so the people who know you can '
    + 'find you.',
  'email.approved.button': 'Open GENORRA',
  'email.approved.footnote':
    'You are receiving this because someone with this address asked to join a family on {app}.',

  // ── FAMILY INVITATION ────────────────────────────────────────────────────────────
  // SENT IN THE INVITER'S LANGUAGE, which is a decision worth knowing while translating: the
  // reader here may not have chosen this language. See `familyInvitationEmail`'s header.
  'email.invitation.subject': '{inviter} invited you to join {family}',
  'email.invitation.subjectNoInviter': 'You are invited to join {family}',
  'email.invitation.preheader': '{family} kept a place for you. The invitation lasts {days} days.',
  'email.invitation.heading': 'Your family kept a place for you',
  'email.invitation.greeting': 'Hi {name},',
  'email.invitation.opening':
    '<strong style="font-weight:600;">{inviter}</strong> has invited you to join '
    + '<strong style="font-weight:600;">{family}</strong> on {app} — where a family keeps its '
    + 'stories, its photographs, its plans and the record of who belongs to whom.',
  'email.invitation.openingNoInviter':
    'You have been invited to join <strong style="font-weight:600;">{family}</strong> on {app} — '
    + 'where a family keeps its stories, its photographs, its plans and the record of who belongs '
    + 'to whom.',
  // The two versions say different things because they MEAN different things — an invitee told
  // "an administrator will review this" and then admitted instantly has been misled harmlessly;
  // one told the reverse turns up expecting access they do not have.
  'email.invitation.preApproved':
    'Accept below and you are in straight away. There is no family code to find and nothing to '
    + 'fill in first.',
  'email.invitation.needsReview':
    'Accept below to set up your account. An administrator will then admit you, so there may be a '
    + 'short wait after that step.',
  'email.invitation.button': 'Accept the invitation',
  'email.invitation.fine': 'This invitation is for this address only and expires in {days} days.',
  'email.invitation.footnote':
    'If this is not something you were expecting, you can safely ignore it. No account is created '
    + 'until you accept, and nobody is told either way.',

  // ── FAMILY REMOVAL CODE ──────────────────────────────────────────────────────────
  'email.removal.subject': 'Your code to remove {family}',
  'email.removal.preheader': 'The code lasts {minutes} minutes and can be used once.',
  'email.removal.heading': 'Confirm removing this family',
  'email.removal.p1':
    'Somebody signed in as you asked to remove <strong style="font-weight:600;">{family}</strong> '
    + 'from {app}. Type this code into the confirmation to finish:',
  'email.removal.p2':
    'Removing a family closes it for everybody in it — nobody can open it, join it or accept an '
    + 'invitation to it. <strong style="font-weight:600;">Nothing is deleted.</strong> Every '
    + 'payment, photograph, event and person stays exactly where it is, and GENORRA support can '
    + 'put the family back.',
  'email.removal.fine': 'This code lasts {minutes} minutes and can be used once.',
  'email.removal.footnote':
    'If you did not ask for this, do nothing — the code expires on its own and the family stays '
    + 'exactly as it is. Then change your password, because somebody else is signed in as you.',

  // ── STRIPE DISCONNECT CODE ───────────────────────────────────────────────────────
  'email.disconnect.subject': 'Your code to disconnect Stripe for {family}',
  'email.disconnect.preheader': 'The code lasts {minutes} minutes and can be used once.',
  'email.disconnect.heading': 'Confirm disconnecting Stripe',
  'email.disconnect.p1':
    'Somebody signed in as you asked to disconnect the Stripe account that '
    + '<strong style="font-weight:600;">{family}</strong> collects dues through. Type this code '
    + 'into the confirmation to finish:',
  'email.disconnect.p2':
    'Members will no longer be able to pay online, and every payment already recorded is kept. '
    + '<strong style="font-weight:600;">The family’s Stripe account itself is untouched</strong> — '
    + 'the money, the bank details and the Stripe dashboard all stay exactly as they are.',
  // ONE RELATIVE AND SEVERAL ARE TWO STRINGS, not one with a number in it. English needs
  // "relative"/"relatives" and "that relative"/"each of them"; a language with more plural forms
  // than two would need more, and this is where a translator can add them — a single string with
  // `{n}` would have forced English's two-way split onto every language.
  'email.disconnect.autopayOne':
    '<strong style="font-weight:600;">1 relative</strong> currently pays their dues automatically, '
    + 'and that arrangement will be cancelled at Stripe. Cancelled payments cannot be restarted — '
    + 'reconnecting brings the account back, but that relative would have to set their payment up '
    + 'again.',
  'email.disconnect.autopayMany':
    '<strong style="font-weight:600;">{n} relatives</strong> currently pay their dues '
    + 'automatically, and those arrangements will be cancelled at Stripe. Cancelled payments '
    + 'cannot be restarted — reconnecting brings the account back, but each of them would have to '
    + 'set their payment up again.',
  'email.disconnect.fine': 'This code lasts {minutes} minutes and can be used once.',
  'email.disconnect.footnote':
    'If you did not ask for this, do nothing — the code expires on its own and nothing changes. '
    + 'Then change your password, because somebody else is signed in as you.',

  // ── DISTRIBUTION ─────────────────────────────────────────────────────────────────
  // NO SUBJECT AND NO HEADING KEY. Both are the member's own subject line, verbatim — see
  // `distributionEmail`. What is translatable here is only the chrome around their words, and it
  // is sent in the SENDER's language for the reason that template's header gives.
  'email.distribution.preheaderFrom': 'From {sender}, to everyone in {family}.',
  'email.distribution.preheaderAnon': 'A message to everyone in {family}.',
  // Unreachable in practice — the action refuses an empty body — and cheaper than an email with
  // chrome and no content in it.
  'email.distribution.empty': '(No message was included.)',
  'email.distribution.footnoteFrom':
    '{sender} sent this to everyone in {family} on {app}. Reply to this email to answer them '
    + 'directly.',
  'email.distribution.footnoteAnon': 'This was sent to everyone in {family} on {app}.',

  // ── SAFETY CHECK-IN ──────────────────────────────────────────────────────────────
  // THE ONE DELIBERATELY BILINGUAL EMAIL. Sent in the READER's language, while the raiser's
  // title and detail come through in whatever language they wrote them — we cannot translate a
  // member's free text, and paraphrasing what somebody said about an emergency is the last thing
  // this feature should do. So the ASK is the reader's and the DESCRIPTION is the raiser's.
  'email.checkIn.subject': 'Are you safe? — {family}',
  'email.checkIn.preheader': '{title} — your family is asking you to check in.',
  'email.checkIn.heading': 'Are you safe?',
  // IT IS AN ASK, NOT AN ALERT. Neither version may assert that anything is happening near the
  // reader — see the template's header. A translation that tightens this into a warning is the
  // one edit that would break the feature.
  'email.checkIn.askRaiser':
    '{raiser} has asked everyone in {family} who may be affected by <strong>{title}</strong> to '
    + 'say whether they are safe.',
  'email.checkIn.askAnon':
    '{family} has asked everyone who may be affected by <strong>{title}</strong> to say whether '
    + 'they are safe.',
  'email.checkIn.answer':
    'Open the check-in and choose <strong style="font-weight:600;">I am safe</strong> or '
    + '<strong style="font-weight:600;">I need help</strong>. It takes one tap, and whoever asked '
    + 'will see your answer straight away.',
  'email.checkIn.button': 'Answer the check-in',
  'email.checkIn.footnoteRaiser':
    '{raiser} raised this check-in in {family} on {app}. If you cannot open the link, reply to '
    + 'this email and they will see it.',
  'email.checkIn.footnoteAnon':
    'This check-in was raised in {family} on {app}. If you cannot open the link, reply to this '
    + 'email.',
}
