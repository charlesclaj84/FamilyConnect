import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailOrigin } from '@/lib/email/send'
import { dunningEmail, retentionReminderEmail } from '@/lib/email/templates'
import { moneyFor } from '@/lib/currency-utils'
import { storedLocale, intlTagFor } from '@/lib/i18n/locales'
import { TIER_LABEL, normalizeTier, type FamilyTier } from '@/lib/tiers'
import {
  DELINQUENCY_DAYS, RETENTION_DAYS, catchUpQuote, daysUntilDrop,
} from '@/lib/platform-billing'

/**
 * Turning queued billing notices into mail.
 *
 * ── THE MAIL HALF OF TWO CLOCKS, AND IT DECIDES NOTHING ────────────────────────────
 * `20260901000002` §E: `pg_cron` owns the STATE and cannot send email (that would need `http`
 * or `pg_net`, neither installed and both argued in TODO.md); this owns the MAIL and decides
 * nothing at all. It claims rows the sweep already decided were due, sends them, and records
 * what happened. If it never runs, no notice is sent and — because both deletion paths refuse
 * without their notices — nothing is deleted either. That is the correct direction to fail.
 *
 * ── A PLAIN MODULE, NEVER A SERVER ACTION ──────────────────────────────────────────
 * AGENTS.md's rule about `lib/email/`: everything exported from a `'use server'` file gets a
 * URL, so a sender exported from one is an open relay carrying our SPF and DKIM. This is
 * `server-only` and is imported by exactly one route.
 *
 * ── THE RECIPIENTS ARE RESOLVED, NEVER PASSED ──────────────────────────────────────
 * Every notice goes to whoever holds `admin/settings:edit` — the exact grant that opens the
 * Billing panel and can actually pay, decided 2026-08-23. The caller names a family and this
 * resolves the people, which is `sendDistribution`'s rule ("the client names bodies and never
 * sends people") applied to a path with no client at all: there is no recipient parameter to
 * forge because there is no recipient parameter.
 *
 * ── AND A PLACEHOLDER ADDRESS IS NOT MAILED ────────────────────────────────────────
 * `placeholderEmail()` builds addresses on a REAL domain, so `sendEmail`'s reserved-TLD guard
 * does not catch them and sending one is a hard bounce against our own reputation. The
 * distribution queue calls that state `unreachable`; here it simply drops the recipient, and
 * an administrator with no real address is why `20260823000007` exists.
 */

/** One claimed notice, as the sweep left it. */
export interface ClaimedNotice {
  id: string
  family_code: string
  kind: 'dunning' | 'retention'
  stage: string
  cycle_on: string
  attempts: number
}

/** Who gets told, and in what language. */
interface BillingRecipient {
  email: string
  locale: string
}

/**
 * Every administrator who can actually pay, with their own language.
 *
 * ── IT ASKS THE PERMISSION GRID, NOT A TEMPLATE NAME ───────────────────────────────
 * A family can rename "Administrators" and can build a template that grants billing to
 * somebody else. What matters is the GRANT, so the query walks
 * `template_permissions` for `admin/settings` / `edit` at scope `'any'` — the same resolution
 * `canAny` performs, expressed as a join because this runs for a family rather than a caller.
 */
async function billingAdmins(familyCode: string): Promise<BillingRecipient[]> {
  const admin = createAdminClient()

  const { data: templates, error: tplError } = await admin
    .from('template_permissions')
    .select('template_id, permission_templates!inner(family_code)')
    .eq('resource_key', 'admin/settings')
    .eq('action', 'edit')
    .eq('scope', 'any')
    .eq('permission_templates.family_code', familyCode)

  // §8: the error is READ. A refused read here would report "no administrators" and the notice
  // would be marked failed for a family that has several — so it throws, the drain records the
  // error, and the row goes back to `pending` for the next run.
  if (tplError) throw new Error(`could not resolve billing admins: ${tplError.message}`)

  const ids = (templates ?? []).map(r => (r as { template_id: string }).template_id)
  if (ids.length === 0) return []

  const { data: people, error } = await admin
    .from('people')
    .select('primary_email, email_is_placeholder, locale')
    .eq('family_code', familyCode)
    .eq('membership_status', 'approved')
    .in('permission_template_id', ids)
  if (error) throw new Error(`could not resolve billing admins: ${error.message}`)

  return (people ?? [])
    .filter(p => {
      const row = p as { primary_email?: string | null; email_is_placeholder?: boolean | null }
      return Boolean(row.primary_email) && row.email_is_placeholder !== true
    })
    .map(p => {
      const row = p as { primary_email: string; locale?: string | null }
      return { email: row.primary_email, locale: storedLocale(row.locale) }
    })
}

/** What the sweep needs to compose a message: the family, its plan and its clocks. */
interface BillingContext {
  familyName: string
  tier: FamilyTier
  delinquentSince: string | null
  withheldSince: string | null
  withheldFromTier: FamilyTier | null
}

async function billingContext(familyCode: string): Promise<BillingContext | null> {
  const admin = createAdminClient()
  const [famRes, accRes] = await Promise.all([
    admin.from('families').select('family_name, tier').eq('family_code', familyCode).maybeSingle(),
    admin.from('platform_billing_accounts')
      .select('delinquent_since, withheld_since, withheld_from_tier')
      .eq('family_code', familyCode).maybeSingle(),
  ])
  if (famRes.error) throw new Error(`could not read the family: ${famRes.error.message}`)
  if (accRes.error) throw new Error(`could not read the billing row: ${accRes.error.message}`)
  if (!famRes.data) return null

  const fam = famRes.data as { family_name: string; tier?: string }
  const acc = (accRes.data ?? {}) as {
    delinquent_since?: string | null
    withheld_since?: string | null
    withheld_from_tier?: string | null
  }
  return {
    familyName: fam.family_name,
    tier: normalizeTier(fam.tier),
    delinquentSince: acc.delinquent_since ?? null,
    withheldSince: acc.withheld_since ?? null,
    withheldFromTier: acc.withheld_from_tier ? normalizeTier(acc.withheld_from_tier) : null,
  }
}

/**
 * Send one notice to every billing administrator.
 *
 * ── THE FIGURE IS RECOMPUTED HERE, NOT CARRIED ON THE ROW ─────────────────────────
 * `catchUpQuote` is asked at SEND time rather than at enqueue time, because a notice can sit
 * in the queue across a month boundary and a figure stamped in February is wrong in March. A
 * stored amount would be the `is_minor` trap with money attached.
 *
 * ── AND IN THE READER'S OWN LANGUAGE, PER RECIPIENT ───────────────────────────────
 * Two administrators of one family can read different languages, so the message is composed
 * once per recipient rather than once per family. `lib/i18n/locales.ts`' rule about a
 * recipient path reading the stored column and nothing else.
 *
 * ── THE PLATFORM'S OWN CURRENCY, WHICH IS USD ────────────────────────────────────
 * `moneyFor(DEFAULT_CURRENCY, …)` and never the family's. AGENTS.md's "MONEY HAS TWO
 * DIRECTIONS": this is what the family owes GENORRA, so `families.currency` — which is what
 * relatives pay the FAMILY in — must not reach it.
 */
async function sendNotice(notice: ClaimedNotice, today: string): Promise<void> {
  const ctx = await billingContext(notice.family_code)
  // A family that no longer exists has nothing to be told. Marked sent rather than failed, so
  // the row stops being retried forever — the notice is genuinely finished.
  if (!ctx) return

  const to = await billingAdmins(notice.family_code)
  if (to.length === 0) {
    // NOT AN ERROR, and not silently "sent" either. `20260823000007` keeps a family from ending
    // up with no billing administrator, so this means the guard has been circumvented or the
    // last one has a placeholder address — worth a log, and worth letting the row finish so the
    // ladder is not blocked forever by a family nobody can write to.
    console.error(
      `[billing] ${notice.family_code} has no reachable billing administrator; `
      + `${notice.kind}/${notice.stage} could not be delivered`,
    )
    return
  }

  const origin = emailOrigin()

  for (const person of to) {
    const money = moneyFor('usd', intlTagFor(person.locale))

    if (notice.kind === 'dunning') {
      const from = ctx.delinquentSince ?? notice.cycle_on
      const quote = catchUpQuote({ tier: ctx.tier, from, today })
      await sendEmail({
        to: person.email,
        ...dunningEmail({
          origin,
          familyName: ctx.familyName,
          stage: notice.stage as 'day5' | 'day10' | 'day30' | 'day45' | 'day59',
          amount: money(quote.totalCents),
          daysLeft: daysUntilDrop(from, today),
          locale: person.locale,
        }),
      })
      continue
    }

    // RETENTION. Priced at the tier they would be COMING BACK TO, which is the whole reason
    // `withheld_from_tier` is a column — see `catchUpQuote`.
    const backTo = ctx.withheldFromTier ?? ctx.tier
    const from = ctx.withheldSince ?? notice.cycle_on
    const quote = catchUpQuote({ tier: backTo, from, today })
    // `d30` -> 30. The stage IS the days-left, which is what keeps the reminder's number and
    // the sweep's schedule from being two facts.
    const daysLeft = Number(notice.stage.replace(/^d/, '')) || 0
    await sendEmail({
      to: person.email,
      ...retentionReminderEmail({
        origin,
        familyName: ctx.familyName,
        tierLabel: TIER_LABEL[backTo],
        daysLeft,
        amount: money(quote.totalCents),
        locale: person.locale,
      }),
    })
  }
}

export interface DrainResult {
  claimed: number
  sent: number
  failed: number
}

/**
 * Claim a bounded slice of due notices, send them, and record each outcome.
 *
 * ── BOUNDED, AND THE BOUND IS THE PROVIDER'S RATE LIMIT ───────────────────────────
 * `sendDistribution`'s arithmetic: exceeding the provider's per-second cap records 429s as
 * delivery failures, so a pacing bug presents as a mail problem and sends somebody looking at
 * DNS. This queue is far smaller than a distribution — a handful of families on a ladder, not
 * a hundred and forty relatives — so the slice is small and the caller runs again if there is
 * more.
 *
 * ── ONE FAILURE DOES NOT STOP THE REST ────────────────────────────────────────────
 * Each notice is finished individually, and a throw is recorded against that row and no other.
 * A single family with a broken permission grid must not hold up every other family's ladder.
 */
export async function drainBillingNotices(limit = 25): Promise<DrainResult> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await admin.rpc('claim_platform_billing_notices', { p_limit: limit })
  if (error) throw new Error(`could not claim notices: ${error.message}`)

  const claimed = (data ?? []) as ClaimedNotice[]
  let sent = 0
  let failed = 0

  for (const notice of claimed) {
    try {
      await sendNotice(notice, today)
      await admin.rpc('finish_platform_billing_notice', { p_id: notice.id, p_error: null })
      sent++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[billing] ${notice.kind}/${notice.stage} for ${notice.family_code}: ${message}`)
      await admin.rpc('finish_platform_billing_notice', { p_id: notice.id, p_error: message })
      failed++
    }
  }

  return { claimed: claimed.length, sent, failed }
}

/** The two ladders' shapes, re-exported so the route's log line can name them. */
export const LADDER_SUMMARY = {
  dunningDays: DELINQUENCY_DAYS,
  retentionDays: RETENTION_DAYS,
} as const
