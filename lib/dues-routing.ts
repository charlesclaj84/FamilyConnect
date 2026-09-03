import { createAdminClient } from '@/lib/supabase/admin'
import { routeContribution, type RoutingFund } from '@/lib/fund-routing'
import type { ScheduleKind } from '@/lib/dues-utils'

/**
 * Splitting a paid dues payment across a family's funds — the waterfall, as a module.
 *
 * ── WHY IT MOVED OUT OF `app/actions/dues.ts` ───────────────────────────────────────
 * It has a second caller. `recordPayment` posts a payment somebody keyed in by hand; the
 * Stripe Connect webhook posts one a card actually paid, and both owe the family the same
 * split into the same funds. Two implementations of a waterfall is how two screens come to
 * disagree about a fund balance, and AGENTS.md §8b's chapter-propagation entry is the worked
 * example of this exact call being made once before:
 *
 *     *"It is a MODULE, not a second copy. Writing the propagation into the new surface
 *     would have left a correct implementation beside a broken one, which is how two answers
 *     to one rule start."*
 *
 * ── AND WHY IT IS IN `lib/` RATHER THAN EXPORTED FROM THE ACTION FILE ───────────────
 * Everything exported from a `'use server'` file gets a URL. `routePaidPayment` takes a
 * family code and a payment id and writes `fund_contributions` rows — published as an
 * endpoint it would be a way to route arbitrary money into arbitrary funds, which is the same
 * open-relay argument `lib/email/send.ts` makes about a sender. A plain module can be
 * imported by both callers and reached by neither browser.
 *
 * NO `import 'server-only'`, for the reason `lib/chapter-propagation.ts` gives: `tests/rls`
 * imports action modules through a plain Node import where `server-only` is not resolvable at
 * all. It is kept out of the browser by never being imported from a `'use client'` file, and
 * by naming `createAdminClient`, which nothing client-reachable may.
 *
 * ── THE FUNCTIONS ARE VERBATIM ─────────────────────────────────────────────────────
 * Both bodies and every comment moved unchanged, deliberately: a refactor that also "tidies"
 * the thing being moved makes the diff unreviewable, and the comments below are a record of
 * four decisions that each cost something to learn. The only edits are the `export` keywords
 * and the local `AdminClient` alias.
 */

/** Matching the alias every module that takes the service role declares for itself. */
type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Load active funds with allocation % and current balance, ordered for routing.
 *
 * SYSTEM FUNDS ARE EXCLUDED, and the exclusion is load-bearing rather than tidy. The
 * Donations fund (20260807000003) is a dedicated pot for gifts; leaving it in this pool
 * would let it collect dues, and `effectiveAllocations()` makes that the DEFAULT
 * outcome — with nothing configured it hands 100% to the highest-priority fund, so a
 * family that never touched the routing screen could have had every dues payment land
 * in Donations.
 */
export async function getActiveFundsForRouting(admin: AdminClient, familyCode: string): Promise<RoutingFund[]> {
  const [fundsRes, allocRes, contribRes, disbRes, xferRes] = await Promise.all([
    // ── THE DONATIONS FUND IS IN THE WATERFALL SINCE 2026-08-20 ─────────────────────
    // This carried `.is('system_key', null)` and so excluded it, on the argument that the
    // Donations fund "takes donations, whole" and had no business in a dues split. A family
    // that wants some of its dues going to the general pot had nowhere to send it — and the
    // pot they mean is exactly the one every donation already lands in.
    //
    // IT IS SAFE BECAUSE OF ITS PRIORITY, and that was decided in advance rather than
    // discovered: `seed_family_system_funds()` creates it at priority 1000 with the comment
    // "last in priority order … belt-and-braces in case it ever is not [excluded]". This is
    // that case. `effectiveAllocations` hands 100% to the FIRST fund by priority when nothing
    // is configured, so at 1000 the Donations fund can never become the default recipient
    // while the family has any other fund — an unconfigured family's dues keep going exactly
    // where they went yesterday. 20260820000001 restates that comment, because the version
    // above was about to become false.
    //
    // THE ONE BEHAVIOUR THAT DOES CHANGE is a family with NO custom funds at all: this query
    // used to answer `[]`, `routeContribution` returned nothing, and the dues payment landed
    // in no fund whatsoever. It now lands in Donations. That is the better answer — money the
    // family collected being in the pot rather than nowhere — and it is what makes the feature
    // work out of the box rather than only for families that had already built a fund.
    //
    // DONATIONS THEMSELVES ARE UNTOUCHED: `kind === 'donation'` above still routes the whole
    // payment to this fund by `system_key` and never consults the waterfall. What changed is
    // that DUES may now be given a share of it.
    admin.from('funds').select('id, priority, minimum_cents, created_at')
      .eq('family_code', familyCode).eq('active', true),
    admin.from('fund_allocations').select('fund_id, basis_points').eq('family_code', familyCode),
    admin.from('fund_contributions').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('fund_disbursements').select('fund_id, amount_cents').eq('family_code', familyCode),
    admin.from('fund_transfers').select('from_fund_id, to_fund_id, amount_cents').eq('family_code', familyCode),
  ])

  // THE BALANCE THE WATERFALL SEES IS THE FUND'S ACTUAL BALANCE, TODAY — the same sum
  // fund_balance_cents() and getFunds() compute, on the admin client so it cannot vary
  // with who is looking. That is what makes minimums behave the way a family expects:
  // money that routed into a fund STAYS there, a payout reduces that fund alone, and
  // the gap the payout opened is refilled by the NEXT payment, ahead of everything
  // below it. Nothing here re-derives where past money should have gone.
  //
  // Transfers are the only term that moves money BETWEEN funds after routing, so leaving
  // them out would make the waterfall refill a fund that has already been topped up by
  // hand — and drain past a minimum that has already been emptied by hand.
  //
  // THERE WERE FIVE TERMS UNTIL 2026-08-19. The fifth was `event_expenses`, dropped with the
  // Events product (`20260819000006`) along with its term in `fund_balance_cents()` — so
  // this sum and the database's own answer still match, which is the property the paragraph
  // above is really about.
  const bpsByFund = new Map<string, number>((allocRes.data ?? []).map(a => [a.fund_id, a.basis_points]))
  const balByFund = new Map<string, number>()
  const add = (id: string | null, delta: number) => { if (id) balByFund.set(id, (balByFund.get(id) ?? 0) + delta) }
  for (const c of contribRes.data ?? []) add(c.fund_id, c.amount_cents)
  for (const d of disbRes.data ?? []) add(d.fund_id, -d.amount_cents)
  for (const t of xferRes.data ?? []) { add(t.to_fund_id, t.amount_cents); add(t.from_fund_id, -t.amount_cents) }

  return (fundsRes.data ?? [])
    .sort((a, b) =>
      a.priority - b.priority ||
      String(a.created_at).localeCompare(String(b.created_at)) ||
      a.id.localeCompare(b.id))
    .map(f => ({
      id: f.id,
      priority: f.priority,
      minimum_cents: f.minimum_cents,
      basis_points: bpsByFund.get(f.id) ?? 0,
      balance_cents: balByFund.get(f.id) ?? 0,
    }))
}

/**
 * Split a paid payment into fund_contributions and stamp routed_at. Idempotent on
 * routed_at.
 *
 * A DONATION DOES NOT GET SPLIT. It goes whole into the family's Donations fund — the
 * one 20260807000003 guarantees exists and refuses to let anyone delete. Before that
 * fund existed a gift went through the dues waterfall, so money given to the
 * Scholarship Drive was divided between the Reunion fund and whatever else the routing
 * table happened to say, and there was no pot whose balance answered "what have we been
 * given?".
 *
 * ── AND SINCE `20260903000001` A DUES SCHEDULE MAY NAME ONE FUND TOO ───────────────
 * `directFundId` is `dues_schedules.fund_id`, and it is the GENERAL FORM of the paragraph
 * above: the whole payment goes into that one fund and the waterfall is skipped. The
 * argument transfers without a word changed — a building-fund levy divided between the
 * Reunion fund and whatever else the routing table said had exactly the donation's problem,
 * and there was no pot whose balance answered "how much have we raised for the roof?".
 *
 * THE DONATION BRANCH IS LEFT ALONE rather than rewritten in terms of this one, and that is
 * deliberate: a donation's destination is a SYSTEM fund the family cannot delete and did not
 * choose, so it is resolved by `system_key` and needs no column. Folding them would make a
 * drive's destination look configurable when a CHECK holds it.
 *
 * ── BOTH COME FROM THE CALLER, WHICH READ THEM OFF THE SCHEDULE ROW ───────────────
 * Never from a client, for the same reason the permission check does not. `directFundId` is
 * the sharper case: a fund id arriving from a browser would be a way to route arbitrary money
 * into an arbitrary fund, which is the argument this module's own header makes for why none
 * of it is exported from a `'use server'` file. `dues_schedules_guard_fund` refuses a
 * cross-family value underneath (§4) and `belongsToFamily` refuses it in the action above
 * that, so by the time it reaches here it has been checked twice and is still not trusted
 * from a caller — it is read off a row.
 */
export async function routePaidPayment(
  admin: AdminClient,
  familyCode: string,
  payment: { id: string; amount_cents: number; payment_date: string; routed_at?: string | null },
  recordedBy: string | null,
  kind: ScheduleKind,
  /**
   * `dues_schedules.fund_id` — the one fund this schedule's payments go into, whole.
   *
   * OPTIONAL, AND UNDEFINED MEANS THE WATERFALL, which is what every caller did before this
   * existed and what a NULL column means. Defaulted rather than required so a caller that
   * has not been updated keeps the old behaviour instead of failing to compile into one that
   * silently routes nothing.
   */
  directFundId?: string | null,
): Promise<void> {
  if (payment.routed_at) return
  if (!payment.amount_cents || payment.amount_cents <= 0) return

  if (kind === 'donation') {
    const { data: fund } = await admin
      .from('funds').select('id')
      .eq('family_code', familyCode).eq('system_key', 'donations')
      .maybeSingle()
    // Unreachable in a migrated database, and deliberately not fatal if it happens: the
    // payment is already posted and the member is already credited. Leaving routed_at
    // unstamped means a later call can still route it once the fund is there, which is
    // the better failure than losing the row.
    if (!fund) return
    await admin.from('fund_contributions').insert({
      fund_id: fund.id,
      family_code: familyCode,
      amount_cents: payment.amount_cents,
      source: 'dues_routing',
      dues_payment_id: payment.id,
      contributed_date: payment.payment_date,
      recorded_by: recordedBy,
    })
    await admin.from('dues_payments').update({ routed_at: new Date().toISOString() }).eq('id', payment.id)
    return
  }

  // ── ONE NAMED FUND, WHOLE, AND THE WATERFALL SKIPPED ────────────────────────────
  // Checked against `family_code` HERE as well as by the guard trigger and by the action —
  // §3, and it is not redundant: this runs on the admin client, so nothing above it is a
  // policy. A miss means the fund was deleted between the payment and the routing, and the
  // answer is to FALL THROUGH to the waterfall rather than to return: `ON DELETE SET NULL`
  // returns a schedule to the waterfall for exactly that case, and a payment that routed
  // nowhere would leave the family's money credited to the member and in no fund at all.
  if (kind === 'dues' && directFundId) {
    const { data: fund } = await admin
      .from('funds').select('id')
      .eq('id', directFundId).eq('family_code', familyCode)
      .maybeSingle()
    if (fund) {
      await admin.from('fund_contributions').insert({
        fund_id: fund.id,
        family_code: familyCode,
        amount_cents: payment.amount_cents,
        source: 'dues_routing',
        dues_payment_id: payment.id,
        contributed_date: payment.payment_date,
        recorded_by: recordedBy,
      })
      await admin.from('dues_payments').update({ routed_at: new Date().toISOString() }).eq('id', payment.id)
      return
    }
    console.error(
      `[dues-routing] schedule fund ${directFundId} is not in ${familyCode} — `
      + 'routing through the waterfall instead',
    )
  }

  const funds = await getActiveFundsForRouting(admin, familyCode)
  const allocations = routeContribution(payment.amount_cents, funds)
  if (allocations.length > 0) {
    await admin.from('fund_contributions').insert(
      allocations.map(a => ({
        fund_id: a.fund_id,
        family_code: familyCode,
        amount_cents: a.amount_cents,
        source: 'dues_routing',
        dues_payment_id: payment.id,
        contributed_date: payment.payment_date,
        recorded_by: recordedBy,
      })),
    )
  }
  await admin.from('dues_payments').update({ routed_at: new Date().toISOString() }).eq('id', payment.id)
}
