/**
 * The funnel events product code actually calls, above checkout.
 *
 * One function per business fact, rather than `trackServerEvent` at each call site. That is
 * not decoration: each of these owns the three decisions that are easy to get wrong and
 * impossible to notice being wrong — which event name, which key the id is derived from,
 * and which of the account holder's fields are permitted. Spread across call sites, those
 * drift, and the symptom is a funnel that under-reports for months.
 *
 * NOT A SERVER ACTION. Plain module, imported by the actions that own each transition.
 *
 * ── EVERY ONE OF THESE IS CALLED AFTER THE FACT, NEVER BEFORE ───────────────────────
 * `trackRegistrationCompleted` is called when an account row exists, not when a form was
 * submitted. `trackFamilyCreated` is called when the family row is committed, not when the
 * button was pressed. A conversion that fires on intent is a conversion the optimiser
 * learns from and cannot deliver on.
 */

import { metaEventId } from '@/lib/meta/event-id'
import { trackServerEvent, type TrackServerEventResult } from '@/lib/meta/dispatch'
import type { MetaAccountHolder } from '@/lib/meta/identity'

/**
 * A real GENORRA account now exists.
 *
 * KEYED ON THE ACCOUNT ID, so the event id is the same one forever. A registration cannot
 * happen twice for one account, and if some future path re-enters this — a retried signup,
 * a re-run of the confirmation flow — the ledger recognises the id and nothing is
 * double-counted.
 *
 * `route` is which door they came through: `join`, `create`, or `invite`. It rides in
 * `content_category`, which is safe and useful — a family founder and an invited cousin are
 * very different prospects, and being able to build an audience of one and not the other is
 * the difference between optimising for organisers and optimising for headcount. It names
 * a DOOR, never a family.
 */
export async function trackRegistrationCompleted(input: {
  userId: string
  holder: MetaAccountHolder
  route: 'join' | 'create' | 'invite'
  sourcePath?: string
}): Promise<TrackServerEventResult> {
  return trackServerEvent({
    event: 'CompleteRegistration',
    eventId: metaEventId('CompleteRegistration', input.userId),
    sourcePath: input.sourcePath ?? '/register',
    holder: input.holder,
    customData: {
      content_name: 'GENORRA Account',
      content_category: `Registration: ${input.route}`,
    },
  })
}

/**
 * A family workspace now exists — the activation signal, and the strongest one this product
 * has short of a payment.
 *
 * ── WHAT IS DELIBERATELY NOT SENT ───────────────────────────────────────────────────
 * Not the family name. Not the family code. Not a surname, a member count, a number of
 * children, a location, or anything else about who is in it. The event says that the action
 * occurred, and `content_name` is the product-wide literal `'Family Workspace'` — identical
 * for every family in the product, which is the property that makes it safe.
 *
 * The family CODE is used to derive the event id, and it is hashed before it leaves (see
 * lib/meta/event-id.ts). What reaches Meta is `family_<32 hex characters>`, which identifies
 * the event and nothing about the family.
 */
export async function trackFamilyCreated(input: {
  familyCode: string
  holder: MetaAccountHolder
  sourcePath?: string
}): Promise<TrackServerEventResult> {
  return trackServerEvent({
    event: 'CreateFamily',
    eventId: metaEventId('CreateFamily', input.familyCode),
    sourcePath: input.sourcePath ?? '/dashboard',
    holder: input.holder,
    customData: { content_name: 'Family Workspace', content_category: 'Activation' },
  })
}

/**
 * Somebody asked to be contacted — a waitlist, a demo request, a marketing signup.
 *
 * NOT WIRED TO ANYTHING TODAY, and that is a statement about the product rather than about
 * the integration: GENORRA has no waitlist form, no demo request and no newsletter, so there
 * is no genuine lead action to fire on. It is implemented, typed and tested so that the day
 * one of those ships, the correct event is one import away — and so that nobody reaches for
 * `Lead` to mean "viewed the pricing page", which is the misuse this event usually suffers
 * and which makes a Lead-optimised campaign chase readers instead of prospects.
 *
 * `key` is whatever makes the lead unique — a submission id, or the address it was made
 * with. It is hashed into the event id and never sent.
 */
export async function trackLead(input: {
  key: string
  holder: MetaAccountHolder
  sourcePath: string
  contentName: string
}): Promise<TrackServerEventResult> {
  return trackServerEvent({
    event: 'Lead',
    eventId: metaEventId('Lead', input.key),
    sourcePath: input.sourcePath,
    holder: input.holder,
    customData: { content_name: input.contentName, content_category: 'Lead' },
  })
}
