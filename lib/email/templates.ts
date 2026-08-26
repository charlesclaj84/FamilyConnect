/**
 * The five emails the APPLICATION sends, as opposed to the five GoTrue sends.
 *
 * All five carry data GoTrue has never heard of — which family, who invited you, which
 * family somebody is about to switch off, what a relative typed into a distribution, what a
 * relative is asking everybody to check in about — which is the whole reason they cannot be
 * templates in `supabase/templates/`. Chrome and voice come from ./layout.ts; the reasoning
 * behind both is in supabase/templates/README.md.
 *
 * TWO OF THE FIVE ARE UNLIKE THE OTHER THREE and the difference is worth knowing before
 * editing anything here: `distributionEmail` and `safetyCheckInEmail` are the ones whose
 * CONTENT a member wrote. The other three compose their own prose and interpolate a name or a
 * token into it, so escaping there is hygiene; in those two it is the security boundary. Both
 * headers say so.
 *
 * A plain module, deliberately: see the header of ./send.ts.
 */

import { APP_NAME } from '@/lib/brand'
// The `@/` alias rather than './layout', matching the rest of the codebase. Not merely
// stylistic: tests/rls loads these modules through its own resolver, which does not
// resolve extensionless relative specifiers — a bare './layout' fails every case that
// touches invitations or approvals with "Cannot find module".
import { esc, renderEmailFrom } from '@/lib/email/layout'
import { emailT } from '@/lib/email/strings'
import { BASE_LOCALE } from '@/lib/i18n/locales'

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
/**
 * Six digits in a monospace box.
 *
 * ── NOT A TRANSLATABLE STRING, AND THAT IS THE POINT ──────────────────────────────
 * It holds no words, so there is nothing to translate — and putting the markup in a catalogue
 * would put CSS in front of a translator, who would then own a `letter-spacing` by accident.
 * The two code emails both call this, so the presentation cannot drift between them either.
 *
 * MONOSPACE AND SPACED OUT, because this is read off one screen and typed into another. The
 * inline style is the same sanctioned exception every colour in this module is: a mail client
 * loads no stylesheet of ours.
 */
function codeBlock(escapedCode: string): string {
  return '<div style="font-family:\'SF Mono\',Consolas,Menlo,monospace; font-size:32px; '
    + 'font-weight:700; letter-spacing:8px; text-align:center; padding:8px 0;">'
    + `${escapedCode}</div>`
}

export function membershipApprovedEmail(o: {
  origin: string
  firstName: string
  familyName: string
  /**
   * The RECIPIENT's language. They have an account and a `people.locale` by the time this is
   * sent — approval is the last step of joining — so this is the one email where the reader's
   * own stated preference is available. `approveApplicant` resolves it.
   */
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const name = o.firstName.trim()
  return {
    // RAW, not escaped: a subject line is not HTML, and `&amp;` in one is a visible defect.
    subject: t('email.approved.subject', { family: o.familyName }),
    tag: 'membership-approved',
    html: renderEmailFrom(o.origin, {
      preheader: t('email.approved.preheader', { family: esc(o.familyName) }),
      heading: name
        ? t('email.approved.headingNamed', { name })
        : t('email.approved.heading'),
      paragraphs: [
        t('email.approved.p1', { family: esc(o.familyName), app: esc(APP_NAME) }),
        t('email.approved.p2'),
      ],
      button: {
        href: `${o.origin}/dashboard`,
        label: t('email.approved.button'),
        widthPx: 200,
      },
      footnote: t('email.approved.footnote', { app: esc(APP_NAME) }),
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
  /**
   * THE INVITER'S LANGUAGE, WHICH IS THE ONE EMAIL WHERE IT IS NOT THE READER'S.
   *
   * ── WHY NOT ENGLISH ─────────────────────────────────────────────────────────────
   * The invitee has no account, so there is no `people.locale` to read and no request of
   * theirs to negotiate an `Accept-Language` from. English was the first answer here and it
   * is the worse one: a Spanish-speaking family inviting their cousin is inviting somebody
   * who almost certainly reads Spanish, and sending them English is a guess that ignores the
   * only evidence available.
   *
   * The inviter's language IS that evidence. It is not certain — a relative abroad may not
   * share it — but it is a far better prior than a default, and this message is a personal
   * one: it names the family and the person sending it, so the sender's language matches what
   * it already is.
   *
   * ── AND IT SELF-CORRECTS ────────────────────────────────────────────────────────
   * Whatever language the mail arrives in, the invitee lands on `/register` with their OWN
   * browser, so `resolveLocale` negotiates `Accept-Language` and the product speaks to them in
   * their language from the first screen. The mail is the only thing that has to guess.
   *
   * ── THE ONE THING THIS MUST NOT BECOME ──────────────────────────────────────────
   * A parameter the CALLER chooses freely. `inviteMember` resolves it from the session, the
   * same way it resolves everything else about the sender — a `locale` accepted from the wire
   * would be a caller picking the language of mail sent over our SPF and DKIM to an address
   * they also chose, which is a knob on the open-relay shape the email rules forbid.
   */
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const link = `${o.origin}/invite/${encodeURIComponent(o.token)}`
  const family = esc(o.familyName)
  const inviter = o.inviterName?.trim() ? esc(o.inviterName.trim()) : null
  const greetingName = o.inviteeFirstName?.trim() ? esc(o.inviteeFirstName.trim()) : null
  const greeting = greetingName ? t('email.invitation.greeting', { name: greetingName }) : null

  const opening = inviter
    ? t('email.invitation.opening', { inviter, family, app: esc(APP_NAME) })
    : t('email.invitation.openingNoInviter', { family, app: esc(APP_NAME) })

  const second = o.preApproved
    ? t('email.invitation.preApproved')
    : t('email.invitation.needsReview')

  return {
    // RAW values in the subject — not HTML.
    subject: inviter
      ? t('email.invitation.subject', {
        inviter: o.inviterName!.trim(), family: o.familyName,
      })
      : t('email.invitation.subjectNoInviter', { family: o.familyName }),
    tag: 'family-invitation',
    html: renderEmailFrom(o.origin, {
      preheader: t('email.invitation.preheader', { family, days: o.expiresInDays }),
      heading: t('email.invitation.heading'),
      // The greeting is its own paragraph and is DROPPED rather than defaulted when
      // there is no name — invitations created before 20260813000002 have none, and
      // "Hi ," reads worse than no greeting at all.
      paragraphs: greeting ? [greeting, opening, second] : [opening, second],
      button: { href: link, label: t('email.invitation.button'), widthPx: 240 },
      fine: t('email.invitation.fine', { days: o.expiresInDays }),
      fallbackUrl: esc(link),
      footnote: t('email.invitation.footnote'),
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
  /**
   * The RECIPIENT's language. `requestFamilyRemovalCode` takes no arguments and resolves the
   * address from the session, so the reader here is by construction the acting administrator —
   * whose `people.locale` the action reads. The one email where the reader is certainly the
   * caller.
   */
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const family = esc(o.familyName)
  return {
    subject: t('email.removal.subject', { family: o.familyName }),
    tag: 'family-removal-code',
    html: renderEmailFrom(o.origin, {
      preheader: t('email.removal.preheader', { minutes: o.expiresInMinutes }),
      heading: t('email.removal.heading'),
      paragraphs: [
        t('email.removal.p1', { family, app: esc(APP_NAME) }),
        codeBlock(esc(o.code)),
        t('email.removal.p2'),
      ],
      fine: t('email.removal.fine', { minutes: o.expiresInMinutes }),
      footnote: t('email.removal.footnote'),
    }),
  }
}

/**
 * The six-digit code that confirms disconnecting a family's Stripe account.
 *
 * ── THE SAME SHAPE AS THE REMOVAL CODE, AND FOR THE SAME REASONS ───────────────────
 * It goes to the person who asked, because `requestProcessorDisconnectCode` takes no
 * arguments and resolves the address from the session. There is NO BUTTON, because the code
 * is a factor in a confirmation already open in another window and a one-click disconnect
 * reachable from a forwarded inbox would defeat the gate. And it states plainly what the act
 * does, because if somebody else has got at the account this message is the first and
 * possibly only notice its owner gets. `familyRemovalCodeEmail` argues each of those.
 *
 * ── WHAT IT SAYS THAT THE SCREEN CANNOT ────────────────────────────────────────────
 * The irreversible half. Reconnecting is one click and brings the same Stripe account back —
 * so a reader who stopped at "you can undo this" would be right about the connection and
 * wrong about the money: every relative's recurring payment is CANCELLED at Stripe, and a
 * cancelled subscription cannot be un-cancelled. The count is interpolated because "4
 * relatives" is a different decision from "nobody", and the caller has already counted them.
 */
export function processorDisconnectCodeEmail(o: {
  origin: string
  familyName: string
  /** The digits. Never logged, never put in the subject, never stored in plaintext. */
  code: string
  /** How long it lasts, for the fine print. Comes from the action, so the two agree. */
  expiresInMinutes: number
  /** Members currently paying automatically, all of whom would be cancelled. */
  autopayCount: number
  /** The RECIPIENT's language — the acting administrator, as with the removal code. */
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const family = esc(o.familyName)
  // ONE AND SEVERAL ARE TWO KEYS, not one string with a number in it. English needs
  // "relative"/"relatives" and "that relative"/"each of them"; a language with more plural forms
  // than two can add them in its own catalogue, which a single `{n}` string could never allow.
  const autopay = o.autopayCount === 1
    ? t('email.disconnect.autopayOne')
    : t('email.disconnect.autopayMany', { n: o.autopayCount })

  return {
    subject: t('email.disconnect.subject', { family: o.familyName }),
    tag: 'processor-disconnect-code',
    html: renderEmailFrom(o.origin, {
      preheader: t('email.disconnect.preheader', { minutes: o.expiresInMinutes }),
      heading: t('email.disconnect.heading'),
      paragraphs: [
        t('email.disconnect.p1', { family }),
        codeBlock(esc(o.code)),
        t('email.disconnect.p2'),
        ...(o.autopayCount > 0 ? [autopay] : []),
      ],
      fine: t('email.disconnect.fine', { minutes: o.expiresInMinutes }),
      footnote: t('email.disconnect.footnote'),
    }),
  }
}

/**
 * One email distribution, to one relative.
 *
 * ── THE ONLY MESSAGE IN THIS MODULE WHOSE BODY A MEMBER WROTE ──────────────────────
 * Every other template here composes its own prose and interpolates a family name or a
 * token into it. This one's content arrives from a textarea, and is then rendered inside
 * somebody else's mail client — so `esc()` on `subject` and on every paragraph is not
 * defence in depth, it is the boundary. `bodyParagraphs()` deliberately returns PLAIN text
 * for exactly that reason: it cannot escape, because `lib/distribution-audience.ts` is a
 * pure module and importing the email layer to be correct would defeat the point of it.
 * The escaping is here, one line from the split, and it must stay visible.
 *
 * THE SUBJECT IS NOT ESCAPED, and that is right rather than an oversight: `subject` is a
 * mail header, not HTML, and `&amp;` in a subject line renders as those five characters in
 * every inbox in the world. The preheader and the heading ARE escaped, because both are
 * markup.
 *
 * ── NO BUTTON, AND NO LINK TO THE DISTRIBUTION ─────────────────────────────────────
 * The message IS the content. Every other template ends in a call to action because it is
 * asking somebody to come and do something; this one has already done it. A "read it on
 * GENORRA" button would also be a lie for most recipients — `community/distributions` is
 * restricted by default, so the great majority of the family cannot open the screen this
 * came from. The one link is to the dashboard, in the footnote, for somebody who wants to
 * see the family rather than the message.
 *
 * ── THE FOOTNOTE SAYS WHY THEY GOT IT, AND WHAT IT DOES NOT SAY IS DELIBERATE ──────
 * It names the family and the sender, because "why am I receiving this" has a real answer
 * here and it is not a marketing one: they are a member of that family and a relative sent
 * it. There is NO unsubscribe link, and inventing one would be inventing a feature — a
 * public endpoint, a token, a preference column, and a rule for what happens when the
 * family's treasurer opts out of dues mail. What the copy does instead is tell them who to
 * reply to, which the `reply_to` header makes real: a reply reaches the relative who wrote
 * it rather than a mailbox that cannot help them. FutureFeature.md carries the preference
 * decision; the copy here must not imply one exists.
 */
export function distributionEmail(o: {
  origin: string
  familyName: string
  subject: string
  /** The authored message, already split by `bodyParagraphs()`. Escaped here. */
  paragraphs: readonly string[]
  /** Display name of whoever sent it. Omitted rather than faked when unknown. */
  senderName?: string | null
  /**
   * The SENDER's language, not the reader's — the one template where that is the answer, and
   * the division is a rule rather than a convenience:
   *
   *   * **A message whose substance is OURS follows the READER's language.** A decision, a
   *     code, an ask. The approval, both action codes and the safety check-in.
   *   * **A message whose substance is one member's own WORDS follows THAT member's
   *     language.** Here the email *is* their message; a Spanish footnote wrapped around an
   *     English paragraph reads as a fault in the product rather than as a courtesy, and there
   *     is nothing we could translate to fix it — we do not paraphrase what a member wrote.
   *
   * The invitation looks like a third rule and is not: its substance is ours, and the inviter's
   * language is simply the only evidence available for a reader who has no account yet.
   *
   * It also keeps `sendDistributionBatch`'s one composition per BATCH intact. That is a
   * consequence, not the reason — if the rule pointed the other way the batch would have to
   * compose per recipient, and it would.
   */
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const family = esc(o.familyName)
  const sender = o.senderName?.trim() ? esc(o.senderName.trim()) : null

  return {
    // The member's own words, verbatim. A prefix like "[Family name]" was considered and
    // dropped: it eats the part of the subject an inbox actually shows on a phone, and the
    // From name already says who this is from. NOT A CATALOGUE KEY for the same reason: there
    // is no sentence of ours in it to translate.
    subject: o.subject,
    tag: 'distribution',
    html: renderEmailFrom(o.origin, {
      // NOT the first paragraph. A preheader that repeats the opening line wastes the one
      // extra sentence an inbox will show — the rule stated on `EmailOptions.preheader`.
      preheader: sender
        ? t('email.distribution.preheaderFrom', { sender, family })
        : t('email.distribution.preheaderAnon', { family }),
      heading: esc(o.subject),
      // ESCAPED, ONE BY ONE. See the header. An empty body cannot reach here — the action
      // refuses it and `bodyParagraphs` returns `[]` for whitespace — but a fallback line is
      // cheaper than an email with chrome and no content in it.
      paragraphs: o.paragraphs.length > 0
        ? o.paragraphs.map(esc)
        : [t('email.distribution.empty')],
      footnote: sender
        ? t('email.distribution.footnoteFrom', { sender, family, app: esc(APP_NAME) })
        : t('email.distribution.footnoteAnon', { family, app: esc(APP_NAME) }),
    }),
  }
}

/**
 * Sent when somebody raises an emergency check-in.
 *
 * ── THE ONE DESIGN DECISION IN THIS TEMPLATE, AND IT IS A SECURITY ONE ─────────────
 * The button does NOT answer. It links to the screen where the relative answers, and it
 * would be a much better product if pressing "I'm safe" in the email were the whole
 * interaction — one tap, no sign-in, done. That cannot be built as a link:
 *
 *   * A GET that mutates is prefetched. Gmail, Outlook and every corporate mail scanner
 *     fetch the URLs in a message to render previews and check for malware, so a
 *     one-tap-answer link would file half the family as SAFE within seconds of the email
 *     going out — automatically, with nobody having read anything. The one number this
 *     feature exists to drive to zero would drive itself to zero, wrongly, and the family
 *     would believe it.
 *   * And it would have to carry a bearer token in a URL, in an email, forever, for an
 *     action whose whole subject is somebody's safety.
 *
 * So the email's job is to get somebody to the screen, and it says which two answers are
 * waiting there so the ask is legible from the inbox.
 *
 * ── IT IS AN ASK, NOT AN ALERT, AND THE COPY MUST NOT DRIFT ────────────────────────
 * This product cannot tell anybody whether they are in danger — it has no geography beyond a
 * self-reported city, no feed, and no way to know what has happened. What it knows is that a
 * relative asked. So the subject names the person who asked and the body says what they asked,
 * and neither ever asserts that anything is happening near the reader. A family member who
 * receives *"Flood warning in your area"* from us when there is none has been given a reason
 * to stop reading these, which is the one failure this feature cannot recover from.
 */
export function safetyCheckInEmail(o: {
  origin: string
  familyName: string
  /** What is happening, in the raiser's words. Member-authored — escaped here. */
  title: string
  /** The optional extra detail. Member-authored — escaped here. */
  detail?: string | null
  /** Display name of whoever raised it. Omitted rather than faked when unknown. */
  raisedByName?: string | null
  /** Absolute URL of the screen where they answer. */
  link: string
  /**
   * The READER's language — resolved per recipient by the sender, which no other template needs
   * and this one earns twice over.
   *
   * ── IT IS THE ONE EMAIL COMPOSED INSIDE THE LOOP ALREADY ───────────────────────────
   * `sendCheckInAsks` builds a fresh message per relative because the `to` and the reply-to
   * differ, so a per-recipient locale costs one extra read of `people.locale` for the batch
   * rather than a change of shape. `distributionEmail` composes once per batch and is the
   * counter-example; see its header for the rule the two of them divide on.
   *
   * ── AND IT IS DELIBERATELY BILINGUAL ──────────────────────────────────────────────
   * `title` and `detail` are the raiser's own words and pass through untranslated. So a reader
   * whose language is Spanish gets the ask, the two answers and the footnote in Spanish, with
   * the description of what happened in whatever language it was written in. That is the honest
   * split: paraphrasing what somebody said about an emergency is the last thing this feature
   * should do, and leaving the ask in a language the reader does not use is the first.
   */
  locale?: string
}): ComposedEmail {
  const t = emailT(o.locale ?? BASE_LOCALE)
  const family = esc(o.familyName)
  const title = esc(o.title)
  const raiser = o.raisedByName?.trim() ? esc(o.raisedByName.trim()) : null
  const detail = o.detail?.trim() ? esc(o.detail.trim()) : null

  const paragraphs = [
    raiser
      ? t('email.checkIn.askRaiser', { raiser, family, title })
      : t('email.checkIn.askAnon', { family, title }),
  ]
  if (detail) paragraphs.push(detail)
  paragraphs.push(t('email.checkIn.answer'))

  return {
    // THE FAMILY NAME IS IN THE SUBJECT, unlike a distribution's — and the reason is the
    // opposite of that template's. There, the From name says who it is from and a prefix eats
    // the part of the subject a phone shows. Here the message has to be recognisable at a
    // glance in a crowded inbox during an actual emergency, when the reader may be getting
    // messages from several directions, so it says who is asking before it says why.
    subject: t('email.checkIn.subject', { family: o.familyName }),
    tag: 'safety-check-in',
    html: renderEmailFrom(o.origin, {
      // THE RAW TITLE, not the escaped one — a preheader is plain text, like a subject.
      preheader: t('email.checkIn.preheader', { title: o.title }),
      heading: t('email.checkIn.heading'),
      paragraphs,
      // THE BUTTON IS WIDER THAN ITS ENGLISH LABEL NEEDS, deliberately: *Responder el aviso*
      // and *Répondre à l'appel* are both longer, and a fixed pixel width is the only kind of
      // width a mail client reliably honours. Check a new language against this rather than
      // trusting it to wrap.
      button: { href: o.link, label: t('email.checkIn.button'), widthPx: 240 },
      // NO EXPIRY LINE. A check-in stays answerable until it is closed, and inventing a
      // deadline would tell somebody who reads this late that it is too late to answer —
      // which for this feature specifically is the worst possible thing to say.
      footnote: raiser
        ? t('email.checkIn.footnoteRaiser', { raiser, family, app: esc(APP_NAME) })
        : t('email.checkIn.footnoteAnon', { family, app: esc(APP_NAME) }),
    }),
  }
}
