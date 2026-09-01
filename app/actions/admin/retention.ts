'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireEdit } from '@/lib/auth/guard'
import { currentUser } from '@/lib/auth/current-user'
import { sendEmail, emailOrigin, deliveryNote } from '@/lib/email/send'
import { familyRemovalCodeEmail } from '@/lib/email/templates'
import { resolveLocale } from '@/lib/auth/locale'
import { hashChallengeCode, mintChallenge } from '@/lib/action-challenge'
import { normalizeTier, TIER_LABEL, type FamilyTier } from '@/lib/tiers'
import { catchUpQuote, daysUntilDataDeleted } from '@/lib/platform-billing'

/**
 * The sixty days after a downgrade, and the two ways out of them.
 *
 * ── WHAT THE WINDOW IS ─────────────────────────────────────────────────────────────
 * Decided 2026-08-23, built in `20260901000002`. A downgrade withholds the tier's data rather
 * than deleting it; four reminders arrive at 30, 15, 5 and 1 days; on day 60 it goes. Coming
 * back inside the window is the family's choice of two:
 *
 *   KEEP    Move back to the tier and pay for the months you were away, so the tier's billing
 *           has no hole in it. That is a PURCHASE and lives in `startPlanCheckout`, which
 *           prices it with `catchUpQuote` and settles it when the money actually lands.
 *   FRESH   Let it go. Nothing is charged and the data is deleted, today.
 *
 * ── THIS FILE IS THE SECOND ONE, AND IT IS THE ONE THAT NEEDS A GATE ──────────────
 * *"'START FRESH' DELETES IMMEDIATELY AND MUST SAY SO IRREVERSIBLY … it needs the strongest
 * confirmation in the product … a plain confirm dialog is not enough for a button that
 * destroys a family tree."* So it goes behind the same emailed six-digit code as removing a
 * family and disconnecting Stripe — `family_action_challenges`, purpose `data_start_fresh`,
 * added by `20260901000003`.
 *
 * ── WHY IT IS NOT SIMPLY LEFT TO THE CLOCK ───────────────────────────────────────
 * Because the reminders keep arriving until it fires, and a family that has decided is being
 * asked four more times about a decision they have made. Bringing it forward is a real thing
 * to want; it is just not a thing to do on one click.
 */

const BILLING = 'admin/settings'

export type StartFreshCodeResult =
  | {
      success: true
      /** The caller's OWN address, from their session. Discloses nothing new. */
      sentTo: string
      /** False when the mail did not go — `sendEmail` fails soft and the UI owes the truth. */
      emailed: boolean
      note: string | null
      minutes: number
      /** What is about to go, so the screen can name it rather than say "your data". */
      tierLabel: string
      /** How many rows, per table. From the SAME function that will do the deleting. */
      counts: Record<string, number>
    }
  | { success: false; message: string }

/**
 * Ask for the code that confirms letting the withheld data go.
 *
 * ── THE DRY RUN IS PART OF THE CONFIRMATION, NOT A COURTESY ──────────────────────
 * `delete_family_data_above_tier(..., p_dry_run => true)` counts exactly what the real call
 * will delete, from the same function and the same map — so the screen can say "412
 * relationships, 96 payments, 210 photographs" rather than "your data". A second query built
 * to describe it could disagree with the one that does it, on the day that matters most.
 */
export async function requestStartFreshCode(): Promise<StartFreshCodeResult> {
  const g = await requireEdit(BILLING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode) return { success: false, message: t('act.youDoNotBelongFamily') }
  // The challenge resolves on (family_code, requested_by, purpose), so a caller with no
  // `people` row has nothing to resolve against. Refused rather than written as a NULL.
  if (!g.personId) return { success: false, message: t('act.youDoNotBelongFamily') }

  const admin = createAdminClient()

  const window = await openWindow(admin, g.familyCode)
  if (!window) return { success: false, message: t('act.nothingWithheldToLetGo') }

  const { data: famRow, error: famError } = await admin
    .from('families')
    .select('family_name, tier')
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (famError || !famRow) {
    console.error(`[retention] could not read ${g.familyCode}: ${famError?.message ?? 'no row'}`)
    return { success: false, message: t('act.couldNotSendCodeJust2') }
  }
  const fam = famRow as { family_name: string; tier?: string }

  // WHAT WILL GO, counted by the function that will remove it.
  const { data: counts, error: countError } = await admin
    .rpc('delete_family_data_above_tier', {
      p_family_code: g.familyCode,
      p_tier: normalizeTier(fam.tier),
      p_dry_run: true,
    })
  if (countError) {
    console.error(`[retention] dry run failed for ${g.familyCode}: ${countError.message}`)
    return { success: false, message: t('act.couldNotSendCodeJust2') }
  }

  // The SESSION's address, never `people.primary_email` — that row may hold a generated
  // placeholder (AGENTS.md §4b) and mailing one is mailing nobody. `requestFamilyRemovalCode`
  // makes the same choice for the same reason.
  const { user } = await currentUser()
  const to = user?.email
  if (!to) return { success: false, message: t('act.couldNotSendCodeJust2') }

  const minted = await mintChallenge(admin, {
    familyCode: g.familyCode,
    personId: g.personId,
    purpose: 'data_start_fresh',
    logTag: '[retention]',
  })
  if (!minted.ok) return { success: false, message: t('act.couldNotSendCodeJust2') }

  // ── THE REMOVAL EMAIL, DELIBERATELY ─────────────────────────────────────────────
  // Same shape, same gate, same reader — the administrator who asked, at the address they sign
  // in with — and it says what it is for in the family name it carries. A third near-identical
  // template would be a third place for the code's lifetime and the "cannot be undone" line to
  // drift, which is the argument `dunningEmail` makes about its own five rungs.
  const mail = familyRemovalCodeEmail({
    origin: emailOrigin(),
    familyName: fam.family_name,
    code: minted.code,
    expiresInMinutes: minted.minutes,
    locale: await resolveLocale(g.userId),
  })
  const sent = await sendEmail({ to, subject: mail.subject, html: mail.html, tag: mail.tag })

  return {
    success: true,
    sentTo: to,
    emailed: sent.sent,
    note: deliveryNote(sent),
    minutes: minted.minutes,
    tierLabel: TIER_LABEL[window.from],
    counts: (counts ?? {}) as Record<string, number>,
  }
}

export type StartFreshResult =
  | { success: true; deleted: Record<string, number> }
  | { success: false; message: string }

/**
 * Delete the withheld data now, on a code the caller typed back.
 *
 * ── THE ONE HARD-DELETE PATH, THIRD CALLER ───────────────────────────────────────
 * `delete_family_data_above_tier`. The sixty-day sweep and day 60 of the delinquency ladder
 * are the other two, and writing this one separately is how one of them ends up missing a
 * table — which is the brief's own reason for insisting on one.
 *
 * ── AT THE FAMILY'S CURRENT TIER, NOT AT FREE ────────────────────────────────────
 * A family that dropped Premium → Plus and lets Premium's data go keeps Plus's. Deleting to
 * Free here would take two tiers' worth on one tier's decision.
 *
 * ── NO CHALLENGE ID CROSSES FROM THE CLIENT ──────────────────────────────────────
 * The only argument is the six digits. The row is resolved from (family_code, requested_by,
 * purpose), all three derived from the session — `removeFamily`'s shape, and the reason a
 * guessed code cannot spend another family's challenge.
 */
export async function startFresh(code: string): Promise<StartFreshResult> {
  const g = await requireEdit(BILLING)
  if (!g.ok) return { success: false, message: g.message }
  const { t } = g
  if (!g.familyCode || !g.personId) {
    return { success: false, message: t('act.youDoNotBelongFamily') }
  }

  const typed = String(code ?? '').trim()
  if (!/^\d{6}$/.test(typed)) {
    return { success: false, message: t('act.enterSixDigitCode') }
  }

  const admin = createAdminClient()

  // ── THE WINDOW IS RE-READ, BEFORE THE CODE IS SPENT ─────────────────────────────
  // A code minted while data was withheld must not delete anything once the window has closed
  // — the family may have paid to keep it in the fifteen minutes since. Checked first so a
  // valid code is not consumed by a call that was going to do nothing anyway.
  const window = await openWindow(admin, g.familyCode)
  if (!window) return { success: false, message: t('act.nothingWithheldToLetGo') }

  const { data: challenge, error: challengeError } = await admin
    .rpc('consume_family_action_challenge', {
      p_family_code: g.familyCode,
      p_person_id: g.personId,
      p_purpose: 'data_start_fresh',
      p_code_hash: hashChallengeCode(typed),
    })
    .maybeSingle<{ ok: boolean; message: string | null; attempts_left: number }>()

  // §8: a refused RPC and a refused CODE are opposite facts and `null` from `maybeSingle()` is
  // what both look like.
  if (challengeError) {
    console.error(`[retention] challenge failed for ${g.familyCode}: ${challengeError.message}`)
    return { success: false, message: t('act.couldNotConfirmCodePlease') }
  }
  if (!challenge?.ok) {
    return { success: false, message: challenge?.message ?? t('act.thatCodeNotRight') }
  }

  const { data: famRow } = await admin
    .from('families').select('tier').eq('family_code', g.familyCode).maybeSingle()
  const tier = normalizeTier((famRow as { tier?: string } | null)?.tier)

  const { data: counts, error } = await admin
    .rpc('delete_family_data_above_tier', {
      p_family_code: g.familyCode, p_tier: tier, p_dry_run: false,
    })
  if (error) {
    console.error(`[retention] start-fresh purge failed for ${g.familyCode}: ${error.message}`)
    return { success: false, message: t('act.couldNotDeleteRecordsPlease') }
  }

  // THE AUDIT ROW, and it names the person — unlike the two sweeps, which have no `auth.uid()`
  // at all. `genorra_staff_deletions`' argument: a destruction nobody can account for
  // afterwards is worse than one nobody can undo.
  await admin.from('platform_data_deletions').insert({
    family_code: g.familyCode,
    reason: 'start_fresh',
    tier_kept: tier,
    withheld_from_tier: window.from,
    deleted: counts ?? {},
    acted_by: g.userId,
  })

  // The clock stops: there is nothing left to withhold, so the four reminders must not keep
  // arriving. Pending ones are cancelled rather than deleted, for the reason the queue's own
  // header gives — a cancelled row records that the warning was owed and then was not needed.
  await admin.from('platform_billing_notices')
    .update({ state: 'cancelled' })
    .eq('family_code', g.familyCode)
    .eq('kind', 'retention')
    .in('state', ['pending', 'sending'])

  await admin.from('platform_billing_accounts')
    .update({ withheld_since: null, withheld_from_tier: null })
    .eq('family_code', g.familyCode)

  revalidatePath('/admin/settings')
  return { success: true, deleted: (counts ?? {}) as Record<string, number> }
}

/** The open retention window for a family, or null. Family-scoped by hand (§3). */
async function openWindow(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
): Promise<{ since: string; from: FamilyTier } | null> {
  const { data, error } = await admin
    .from('platform_billing_accounts')
    .select('withheld_since, withheld_from_tier')
    .eq('family_code', familyCode)
    .maybeSingle()
  // §8: a refused read must not read as "nothing is withheld" — that answer would let this
  // action report there is nothing to delete on a family whose data is about to go.
  if (error) {
    console.error(`[retention] could not read the window for ${familyCode}: ${error.message}`)
    return null
  }
  const row = (data ?? {}) as { withheld_since?: string | null; withheld_from_tier?: string | null }
  if (!row.withheld_since || !row.withheld_from_tier) return null
  return { since: row.withheld_since, from: normalizeTier(row.withheld_from_tier) }
}

/** What the retention band on the Billing panel renders. Null when nothing is withheld. */
export interface RetentionView {
  withheldSince: string
  withheldFromTier: FamilyTier
  tierLabel: string
  /** Days until the data goes. Negative when the sweep is overdue — see `daysUntilDataDeleted`. */
  daysLeft: number
  /** What coming back and keeping it costs, in cents, at the returning tier's rate. */
  catchUpCents: number
  monthsAway: number
}

/**
 * The family's retention window, for the screen.
 *
 * READ-ONLY and gated on the same grant as the rest of the Billing panel. It publishes nothing
 * a member without that grant could not already infer from their own tier — but it names a
 * figure and a deadline, which is exactly what §5 says to fetch only for somebody entitled to
 * it.
 */
export async function getRetentionView(): Promise<RetentionView | null> {
  const g = await requireEdit(BILLING)
  if (!g.ok || !g.familyCode) return null

  const admin = createAdminClient()
  const window = await openWindow(admin, g.familyCode)
  if (!window) return null

  const today = new Date().toISOString().slice(0, 10)
  const quote = catchUpQuote({ tier: window.from, from: window.since, today })

  return {
    withheldSince: window.since,
    withheldFromTier: window.from,
    tierLabel: TIER_LABEL[window.from],
    daysLeft: daysUntilDataDeleted(window.since, today) ?? 0,
    catchUpCents: quote.totalCents,
    monthsAway: quote.monthsBehind,
  }
}
