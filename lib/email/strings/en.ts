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
  // ── THE LAYOUT'S OWN CHROME ─────────────────────────────────────────────────────
  // `lib/email/layout.ts` renders these, not a caller. All three were English for every
  // reader in EVERY email — including the six that were already translated — and invisible to
  // `i18n:literals`, which deliberately does not sweep `lib/`.
  //
  // `email.chrome.values` is PIPE-SEPARATED because the layout joins them with a gold bullet
  // and the count is not fixed by anything: a language wanting two or four says so. Trimmed
  // per item, so the separator can be padded for readability.
  'email.chrome.values': 'Connect | Plan | Celebrate',
  'email.chrome.lead': 'Where every generation belongs.',
  'email.chrome.fallback': 'If the button does not work, paste this into your browser:',

  // ── THE FIVE AUTH EMAILS, WHICH GoTrue USED TO RENDER ───────────────────────────
  // `supabase/templates/*.html` still holds the English of each, as the fallback for a
  // deployment where the Send Email hook is not enabled — see that folder's README. These are
  // what `app/api/auth/send-email/route.ts` composes instead, and the words are the same ones,
  // carried across rather than rewritten.
  //
  // NO SUBJECT IS A QUESTION AND NONE NAMES THE FAMILY. A subject line is the one part of an
  // email that shows up in a notification on a locked screen, and "Your family kept a place
  // for you" is as much as should be visible there — which is also why the confirmation code
  // is never in one.

  // 1. Signup confirmation.
  'email.auth.confirm.subject': 'You’re almost in',
  'email.auth.confirm.preheader': 'One tap and you’re set. The link is good for one hour.',
  'email.auth.confirm.heading': 'You’re almost in',
  'email.auth.confirm.p1':
    'Welcome. Confirm this address and your {app} account is ready — your family’s stories, '
    + 'photographs and plans, kept in one place.',
  // THE WAIT IS NAMED HERE AND NOWHERE ELSE IN THE FLOW. Somebody who confirms and then lands
  // on a holding screen with no warning reads it as the product being broken.
  'email.auth.confirm.p2':
    'One thing to expect next: your family reviews new members before admitting them, so there '
    + 'may be a short wait after this step.',
  'email.auth.confirm.button': 'Confirm my email address',
  'email.auth.confirm.fine': 'This link works once and expires in one hour.',
  'email.auth.confirm.footnote':
    'If you did not create a {app} account, you can ignore this — nothing happens until the '
    + 'link is opened, and it expires on its own.',

  // 2. Password reset.
  'email.auth.recovery.subject': 'Reset your password',
  'email.auth.recovery.preheader': 'Choose a new password. The link is good for one hour.',
  'email.auth.recovery.heading': 'Choose a new password',
  'email.auth.recovery.p1':
    'Somebody asked to reset the password on the {app} account for this address. Open the link '
    + 'below and choose a new one.',
  'email.auth.recovery.button': 'Choose a new password',
  'email.auth.recovery.fine': 'This link works once and expires in one hour.',
  // IT SAYS THE PASSWORD DOES NOT CHANGE. That is the sentence that stops somebody who did not
  // ask for this from panicking, and it is true: nothing moves until the link is opened.
  'email.auth.recovery.footnote':
    'If you didn’t ask for this, you can safely ignore it. Your password won’t change, and the '
    + 'link expires on its own.',

  // 3. The GoTrue invite. NOT the family invitation — see `familyInvitationEmail`, which is
  //    what a member actually sends and which carries the family's name. This one is
  //    `admin.inviteUserByEmail`, reachable only with the service role, and is here because
  //    the hook must answer for every action type GoTrue can produce.
  'email.auth.invite.subject': 'Your family kept a place for you',
  'email.auth.invite.preheader': 'Accept the invitation to join them on {app}.',
  'email.auth.invite.heading': 'Your family kept a place for you',
  'email.auth.invite.p1':
    'Someone in your family invited <strong style="font-weight:600;">{email}</strong> to join '
    + 'them on {app} — where a family keeps its stories, its photographs, its plans and the '
    + 'record of who belongs to whom.',
  'email.auth.invite.p2':
    'Accept below and your account is set up for you. There is no family code to find and '
    + 'nothing to fill in first.',
  'email.auth.invite.button': 'Accept the invitation',
  'email.auth.invite.fine': 'This link works once and expires in one hour.',
  'email.auth.invite.footnote':
    'If you were not expecting this, you can ignore it. No account is created until the link '
    + 'is opened.',

  // 4. The reauthentication code. NO BUTTON and NO LINK, deliberately: the code is typed into
  //    a screen the reader already has open, and a one-click confirmation reachable from a
  //    forwarded inbox would defeat the gate. Same argument as `familyRemovalCodeEmail`.
  'email.auth.reauth.subject': 'Just checking it’s you',
  'email.auth.reauth.preheader':
    'Your confirmation code is below. It works once and expires in one hour.',
  'email.auth.reauth.heading': 'Just checking it’s you',
  'email.auth.reauth.p1':
    'You’re making a change that needs a second look. Type this code into the screen that '
    + 'asked for it:',
  'email.auth.reauth.fine': 'This code works once and expires in one hour.',
  // THE ONE FOOTNOTE THAT IS A WARNING RATHER THAN A REASSURANCE, because a code arriving
  // unasked means somebody else is signed in.
  'email.auth.reauth.footnote':
    'We’ll never ask you for this code by phone, text or email. If you weren’t expecting it, '
    + 'don’t share it — someone may know your password, and changing it is the thing to do.',

  // 5. The address change. TWO EMAILS FROM ONE HOOK CALL — see the route: GoTrue fires once
  //    carrying both tokens, and both addresses have to confirm.
  'email.auth.changeOld.subject': 'Confirm your new address',
  'email.auth.changeOld.preheader': 'Confirm the change from the address you have now.',
  'email.auth.changeOld.heading': 'Confirm this change',
  'email.auth.changeOld.p1':
    'A request was made to move the {app} account from '
    + '<strong style="font-weight:600;">{email}</strong> to '
    + '<strong style="font-weight:600;">{newEmail}</strong>.',
  'email.auth.changeOld.p2':
    'Both addresses have to confirm. This is the half from the address you have now.',
  'email.auth.changeOld.button': 'Confirm this change',
  'email.auth.changeOld.fine': 'This link works once and expires in one hour.',
  'email.auth.changeOld.footnote':
    'If you didn’t ask for this, do nothing and the address on your account stays as it is. '
    + 'It’s worth changing your password too — a request like this can only be made from a '
    + 'signed-in session.',

  'email.auth.changeNew.subject': 'Confirm your new address',
  'email.auth.changeNew.preheader': 'Confirm the new address on the account.',
  'email.auth.changeNew.heading': 'Confirm this address',
  'email.auth.changeNew.p1':
    'A request was made to move the {app} account from '
    + '<strong style="font-weight:600;">{email}</strong> to this address.',
  'email.auth.changeNew.p2':
    'Both addresses have to confirm. This is the half from the new one.',
  'email.auth.changeNew.button': 'Confirm this address',
  'email.auth.changeNew.fine': 'This link works once and expires in one hour.',
  'email.auth.changeNew.footnote':
    'If you were not expecting this, you can ignore it — the account keeps the address it has '
    + 'until both halves are confirmed.',
  // ── THE STAFF FAMILY-DELETION CODE, 2026-08-31 ───────────────────────────
  // The one challenge email whose reader is a GENORRA owner rather than a family's
  // administrator, and the one where nothing is sent to the family at all.
  'email.staffDelete.subject': 'Your code to permanently delete {code}',
  'email.staffDelete.preheader': 'Six digits, good for {minutes} minutes.',
  'email.staffDelete.heading': 'Confirm a permanent deletion',
  'email.staffDelete.p1': 'Somebody signed in to the GENORRA staff console asked to permanently delete <strong>{family}</strong> (<strong>{code}</strong>). Type this code into the confirmation still open in that window.',
  'email.staffDelete.p2': 'This destroys every record that family holds, and there is no restore. If you did not ask for this, do not use the code — and treat your console session as compromised.',
  'email.staffDelete.fine': 'The code lasts {minutes} minutes, works once, and allows five attempts.',
  'email.staffDelete.footnote': 'Sent because a staff console session asked for it. Nobody in the family receives this message.',
}
