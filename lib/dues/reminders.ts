import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { currentPeriodStart, duesPlanMath, type PayCadence } from '@/lib/dues-utils'
import { sendEmail, emailOrigin } from '@/lib/email/send'
import { duesReminderEmail } from '@/lib/email/templates'
import { authMailLocale } from '@/lib/auth/locale'
import { moneyFor } from '@/lib/currency-utils'
// THE PURE TIER PAIR, NOT `tierAllows`. That helper takes a `userId` and resolves the caller's
// family; a cron job has no `auth.uid()` and no caller at all, so it asks the question the
// other way round — what does this ROUTE require, and does this FAMILY's tier meet it.
import { requiredTier } from '@/lib/features'
import { tierMeets, type FamilyTier } from '@/lib/tiers'

/** The route whose tier governs reminders. `/reporting/dues-projections` is the screen. */
const REMINDER_ROUTE = '/reporting/dues-projections'

function familyHasReminders(tier: string): boolean {
  return tierMeets(tier as FamilyTier, requiredTier(REMINDER_ROUTE))
}

/**
 * Automatic dues reminders — the last unbuilt Premium bullet.
 *
 * ── WHY THE ENQUEUE IS HERE AND NOT IN `pg_cron` ───────────────────────────────────
 * The obvious shape is a SQL sweep, matching the billing ladder. It is wrong for this one.
 * The ladder asks a question SQL can answer — has this date passed — while a reminder needs
 * `duesPlanMath`: the cadence ladder, the month-end clamp that `setUTCMonth` overflows on,
 * arrears measured against settled cents, waivers, the age rule, the bloodline and the scope.
 * Writing that in plpgsql would be a SECOND implementation of a rule that already has a tested
 * one, and AGENTS.md §7c is a list of four things the first implementation got wrong.
 *
 * So this runs in Node on `/api/billing/notices`, which already runs daily with the service
 * key, and `20260901000007` ships the queue rather than a sweep function.
 *
 * ── THE KEY IS WHAT MAKES IT SAFE TO RUN EVERY DAY ─────────────────────────────────
 * `dues_reminders_one_per_installment` is unique on (person, schedule, due_on), so the enqueue
 * below is an `upsert` with `ignoreDuplicates` and running it twice on one day — or every day
 * for the fortnight before an installment falls — inserts nothing new. That is FutureFeature
 * §1's one decision, in the schema where it asked for it rather than in this file.
 *
 * ── §3 BY HAND, ON EVERY READ ──────────────────────────────────────────────────────
 * The admin client, because there is no caller: a cron job has no `auth.uid()`. Every query is
 * `.eq('family_code', …)` from a code this function read itself, never from an argument — this
 * function takes no family at all.
 *
 * ── AND THE OPEN-RELAY RULE, WHICH THIS COMES CLOSE TO ─────────────────────────────
 * `lib/email/`: never export a sender from a `'use server'` file, because everything exported
 * from one gets a URL. This is a plain module and nothing here is exported to an action. The
 * recipient is never a parameter — it is resolved from the `people` row the projection read —
 * which is the same rule `/community/distributions` keeps.
 */

/**
 * How far ahead a member is told. Fourteen days is the fortnight `/community/distributions`'
 * birthday composer uses, and the reasoning is the same: long enough to act on, short enough
 * that the reminder is still about something imminent when it arrives.
 *
 * WITH A DAILY DRAIN THIS IS NOT A CADENCE. The enqueue is idempotent, so a member is reminded
 * ONCE per installment — on the first day the installment falls inside the window — and not
 * again for fourteen days running.
 */
const LEAD_DAYS = 14

/** Bounded like every other drain here: the platform has a wall-clock ceiling. */
const FAMILIES_PER_RUN = 25
const SENDS_PER_RUN = 50

export interface ReminderResult {
  /** Rows newly queued by the enqueue pass. */
  queued: number
  /** Rows cancelled because the installment was settled before it went out. */
  cancelled: number
  sent: number
  failed: number
  /** Addressed to a generated placeholder, so never mailed. */
  unreachable: number
}

interface ScheduleRow {
  id: string
  label: string
  amount_cents: number
  frequency: string
  start_date: string | null
  end_date: string | null
  due_month: number | null
  due_day: number | null
  kind: string
}

/** `YYYY-MM-DD`, UTC. The clock every date here is measured against. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

/**
 * Queue a reminder for every installment falling inside the window that has not been queued.
 *
 * Returns the number of rows actually inserted — which is zero on the second run of the same
 * day, and is the observable proof that the key is doing its job.
 */
async function enqueue(): Promise<{ queued: number }> {
  const admin = createAdminClient()
  const today = todayUTC()
  let queued = 0

  // ONLY FAMILIES WHOSE PLAN INCLUDES THIS. The tier withholds the feature, and it is resolved
  // HERE rather than in a policy — no policy consults `families.tier` and none may. A family
  // that lapses keeps every row; it simply stops being reminded.
  const { data: families, error: familyError } = await admin
    .from('families')
    .select('family_code, tier, status')
    .eq('status', 'active')
    .limit(FAMILIES_PER_RUN)

  if (familyError) throw new Error(`could not read families: ${familyError.message}`)

  for (const family of families ?? []) {
    const code = family.family_code as string
    if (!familyHasReminders(family.tier as string)) continue

    const [schedulesRes, peopleRes, plansRes, paymentsRes] = await Promise.all([
      admin.from('dues_schedules')
        .select('id, label, amount_cents, frequency, start_date, end_date, due_month, due_day, kind')
        .eq('family_code', code).eq('active', true),
      // The projection's own roster rule: approved, and alive. `sunset_date` is why a dead
      // relative is not chased for money — the same conjunct `getUpcomingBirthdays` applies
      // for the same reason.
      admin.from('people')
        .select('id, primary_email, user_id')
        .eq('family_code', code).eq('membership_status', 'approved').is('sunset_date', null),
      admin.from('dues_member_plans')
        .select('person_id, schedule_id, cadence, opted_out, active')
        .eq('family_code', code),
      admin.from('dues_payments')
        .select('person_id, schedule_id, amount_cents, status, payment_date')
        .eq('family_code', code).not('schedule_id', 'is', null),
    ])

    // §8. A REFUSED READ MUST NOT LOOK LIKE AN EMPTY ONE, and here the consequence is
    // specific: a refused `dues_payments` makes every member look unpaid and would email the
    // whole family demanding money they have already sent. Skip the family and log it.
    const readError = schedulesRes.error ?? peopleRes.error ?? plansRes.error ?? paymentsRes.error
    if (readError) {
      console.error(`[reminders] skipping ${code}: ${readError.message}`)
      continue
    }

    const schedules = (schedulesRes.data ?? []).filter(s => s.kind !== 'donation') as ScheduleRow[]
    if (schedules.length === 0) continue

    const people = new Map(
      (peopleRes.data ?? []).map(p => [p.id as string, p as { id: string; primary_email: string | null }]),
    )

    // Settled money per (person, schedule) for the CURRENT period only. `duesPlanMath` measures
    // arrears from the period start, so counting last year's payments would report every
    // member as level and remind nobody.
    const settled = new Map<string, number>()
    for (const row of paymentsRes.data ?? []) {
      const p = row as {
        person_id: string; schedule_id: string; amount_cents: number
        status: string; payment_date: string | null
      }
      if (p.status !== 'paid' && p.status !== 'waived') continue
      const schedule = schedules.find(s => s.id === p.schedule_id)
      if (!schedule) continue
      const periodStart = currentPeriodStart(schedule)
      if (p.payment_date && p.payment_date < periodStart) continue
      const key = `${p.person_id}:${p.schedule_id}`
      settled.set(key, (settled.get(key) ?? 0) + p.amount_cents)
    }

    const rows: Record<string, unknown>[] = []
    for (const plan of plansRes.data ?? []) {
      const pl = plan as {
        person_id: string; schedule_id: string; cadence: string
        opted_out: boolean; active: boolean
      }
      // AN OPTED-OUT OR INACTIVE PLAN OWES NOTHING. Reminding somebody about a due they
      // declined is the fastest way to have the whole feature switched off.
      if (pl.opted_out || !pl.active) continue
      if (!people.has(pl.person_id)) continue
      const schedule = schedules.find(s => s.id === pl.schedule_id)
      if (!schedule) continue

      const math = duesPlanMath({
        schedule,
        cadence: pl.cadence as PayCadence,
        periodStart: currentPeriodStart(schedule),
        today,
        settledCents: settled.get(`${pl.person_id}:${pl.schedule_id}`) ?? 0,
      })

      // NOTHING OWED IS NOTHING TO SAY. `nextInstallmentCents` is zero for a member who has
      // paid the year, and the CHECK on the column refuses a reminder for zero anyway.
      if (!math.nextInstallmentDate || math.nextInstallmentCents <= 0) continue

      const lead = daysBetween(today, math.nextInstallmentDate)
      // `lead < 0` cannot happen — `nextInstallmentDate` is never in the past — but an
      // overdue member resolves to TODAY, which is `lead === 0` and is exactly who should be
      // reminded first.
      if (lead > LEAD_DAYS) continue

      rows.push({
        family_code: code,
        person_id: pl.person_id,
        schedule_id: pl.schedule_id,
        due_on: math.nextInstallmentDate,
        amount_cents: math.nextInstallmentCents,
      })
    }

    if (rows.length === 0) continue

    // `ignoreDuplicates` IS THE WHOLE IDEMPOTENCY. Without the unique index behind it this
    // would insert one row per member per day for a fortnight.
    const { data: inserted, error: insertError } = await admin
      .from('dues_reminders')
      .upsert(rows, { onConflict: 'person_id,schedule_id,due_on', ignoreDuplicates: true })
      .select('id')

    if (insertError) {
      console.error(`[reminders] could not queue for ${code}: ${insertError.message}`)
      continue
    }
    queued += (inserted ?? []).length
  }

  return { queued }
}

/** Send what is queued. */
async function drain(): Promise<Omit<ReminderResult, 'queued'>> {
  const admin = createAdminClient()
  const today = todayUTC()
  let sent = 0, failed = 0, unreachable = 0, cancelled = 0

  const { data, error } = await admin.rpc('claim_dues_reminders', { p_limit: SENDS_PER_RUN })
  if (error) throw new Error(`could not claim reminders: ${error.message}`)

  for (const claim of (data ?? []) as {
    id: string; family_code: string; person_id: string
    schedule_id: string; due_on: string; amount_cents: number
  }[]) {
    try {
      const [personRes, scheduleRes, familyRes, paidRes] = await Promise.all([
        admin.from('people')
          .select('id, first_name, primary_email, email_is_placeholder, locale, user_id')
          .eq('id', claim.person_id).eq('family_code', claim.family_code).maybeSingle(),
        admin.from('dues_schedules').select('id, label, due_month, due_day, start_date, end_date, frequency, amount_cents')
          .eq('id', claim.schedule_id).eq('family_code', claim.family_code).maybeSingle(),
        admin.from('families').select('family_name, currency, tier, status')
          .eq('family_code', claim.family_code).maybeSingle(),
        admin.from('dues_payments').select('amount_cents, status, payment_date')
          .eq('family_code', claim.family_code)
          .eq('person_id', claim.person_id).eq('schedule_id', claim.schedule_id),
      ])

      const readError = personRes.error ?? scheduleRes.error ?? familyRes.error ?? paidRes.error
      if (readError) throw new Error(readError.message)

      const person = personRes.data as {
        first_name: string; primary_email: string | null
        email_is_placeholder: boolean | null; locale: string | null; user_id: string | null
      } | null
      const schedule = scheduleRes.data as ScheduleRow | null
      const family = familyRes.data as {
        family_name: string; currency: string; tier: string; status: string
      } | null

      // The row went while this was queued, or the family was removed or downgraded. Not a
      // failure — there is simply nothing to send.
      if (!person || !schedule || !family || family.status !== 'active'
          || !familyHasReminders(family.tier)) {
        await admin.rpc('finish_dues_reminder', {
          p_id: claim.id, p_state: 'cancelled', p_error: null,
        })
        cancelled++
        continue
      }

      // ── SETTLED SINCE IT WAS QUEUED? THEN SAY NOTHING ─────────────────────────────
      // Re-computed at SEND time rather than trusted from the queue, because a member who
      // pays the day after the reminder is queued must not then be chased for it. This is the
      // difference between a reminder and a dunning notice.
      const periodStart = currentPeriodStart(schedule)
      const settledCents = (paidRes.data ?? [])
        .filter(p => (p.status === 'paid' || p.status === 'waived')
          && (!p.payment_date || p.payment_date >= periodStart))
        .reduce((n, p) => n + (p.amount_cents as number), 0)

      const math = duesPlanMath({
        schedule, cadence: 'annual', periodStart, today, settledCents,
      })
      if (math.nextInstallmentCents <= 0) {
        await admin.rpc('finish_dues_reminder', {
          p_id: claim.id, p_state: 'cancelled', p_error: null,
        })
        cancelled++
        continue
      }

      // ── A GENERATED ADDRESS IS NEVER MAILED ──────────────────────────────────────
      // `placeholderEmail()` builds these on `@genorra.com`, a REAL domain, so `sendEmail`'s
      // reserved-TLD guard does not catch one and mailing it is a hard bounce against our own
      // sending reputation. Its own state, so it does not sit in the failed column forever.
      const address = person.primary_email
      if (!address || person.email_is_placeholder) {
        await admin.rpc('finish_dues_reminder', {
          p_id: claim.id, p_state: 'unreachable', p_error: null,
        })
        unreachable++
        continue
      }

      // The READER's language. `authMailLocale` reads `people.locale` first and falls back
      // to the signup metadata hint — the resolver written for exactly this case, where there
      // is no request and no caller to resolve from.
      const locale = await authMailLocale({ userId: person.user_id, metadata: null })
      const money = moneyFor(family.currency, locale)  // a Money is the formatter itself
      const mail = duesReminderEmail({
        // FROM CONFIGURATION, NEVER A REQUEST HEADER — and here there is no request at all.
        // `Host` is attacker-controlled and would control the hostname inside a link an email
        // tells somebody to trust.
        origin: emailOrigin(),
        locale,
        firstName: person.first_name,
        familyName: family.family_name,
        scheduleLabel: schedule.label,
        amount: money(claim.amount_cents),
        dueOn: claim.due_on,
      })

      const result = await sendEmail({ to: address, subject: mail.subject, html: mail.html })
      // `sendEmail` FAILS SOFT and returns rather than throwing, so the result has to be read.
      // Reporting a send that did not happen would leave the member never reminded and the row
      // marked done.
      if (!result.sent) throw new Error(result.error ?? 'the message was not sent')

      await admin.rpc('finish_dues_reminder', { p_id: claim.id, p_state: 'sent', p_error: null })
      sent++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[reminders] ${claim.family_code}/${claim.person_id}: ${message}`)
      await admin.rpc('finish_dues_reminder', {
        p_id: claim.id, p_state: 'failed', p_error: message,
      })
      failed++
    }
  }

  return { sent, failed, unreachable, cancelled }
}

/**
 * One pass: queue what is due, then send what is queued.
 *
 * Enqueue FIRST, so a reminder queued today goes out today rather than tomorrow — with a daily
 * drain the other order would add a day to every reminder for no reason.
 */
export async function runDuesReminders(): Promise<ReminderResult> {
  const { queued } = await enqueue()
  const rest = await drain()
  return { queued, ...rest }
}
