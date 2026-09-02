import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Has money already been recorded against this record?
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────
 * A dues schedule with $4,000 collected against it could be deleted from the Accounting
 * screen, and the delete SUCCEEDED. Reported 2026-08-17, and it is the shape rather than
 * the one screen: records in this schema can be deleted while money points at them, and the
 * schema does two DIFFERENT wrong things depending on which:
 *
 *   dues_schedules      dues_payments.schedule_id      ON DELETE SET NULL   ORPHANS it
 *   fund_milestones     fund_disbursements.milestone_id ON DELETE SET NULL  ORPHANS it
 *   funds               fund_contributions.fund_id      ON DELETE CASCADE   DESTROYS it
 *                       fund_disbursements.fund_id      ON DELETE CASCADE   DESTROYS it
 *
 * The SET NULL cases leave the ledger rows intact and unattributable — the money is still
 * counted, and nothing says what it was for. The CASCADE cases are worse: the rows go, so
 * the family's collected total silently DROPS. Both are irreversible, and both survived
 * every existing guard because the append-only triggers on `dues_payments` and
 * `fund_disbursements` permit exactly one delete path — the cascade from a parent that is
 * already gone — which is the path being taken.
 *
 * TWO OF THE FIVE WERE `events` AND `event_budget_items`, and both are gone with the Events
 * product (`20260819000006`) along with `event_expenses`, the table that was the money in
 * both rows. Their entries here are deleted rather than left as documentation, because this
 * list is what a delete action is checked AGAINST — a row naming a dropped table would make
 * a query fail rather than a reader wiser.
 *
 * So: one rule, in one place, consulted by every delete action that can reach money.
 * A copy per action would be a chance per action to omit one, which is how there came to be
 * three.
 *
 * ── WHY THE GUARD IS HERE AND NOT A FOREIGN-KEY CONSTRAINT ─────────────────────────
 * `ON DELETE RESTRICT` is the obvious fix and this codebase has already rejected it, with
 * a reason worth preserving. `deleteFund`'s existing transfer check states it: RESTRICT
 * would make the record permanently undeletable with a bare 23503 for a message, and it
 * would deadlock the RLS fixture's teardown against the append-only triggers, whose only
 * permitted delete path is precisely that cascade. The same is true of the two destructive
 * scripts in `supabase/scripts/`, which delete parents and let the cascade clear the
 * children.
 *
 * So the cascade stays as the cleanup path of last resort, and the decision is made here,
 * in words, where the person clicking Delete can read them.
 *
 * WHAT THAT COSTS, stated plainly: these deletes run on the SERVICE-ROLE client, so there
 * is no policy underneath them and this check is the ONLY thing standing between a
 * mis-click and destroyed money. A `BEFORE DELETE` trigger would be the second layer
 * AGENTS.md would normally insist on, and it is not free — it entangles both destructive
 * scripts, which would each need to stand it down the way `reset_families.sql` already
 * stands down the two immutability triggers, and update the assertion that counts them
 * back. TODO.md carries it.
 *
 * ── NOT A SERVER ACTION, and it must not become one ────────────────────────────────
 * A plain module has no URL. It reads through the SERVICE ROLE deliberately: the question
 * is "does ANY money point at this row", and the answer must not depend on whether the
 * caller holds view permission on the ledger — a family that restricts Transactions would
 * otherwise be told its funded schedule is safe to delete. Same reasoning, and the same
 * client, as `belongsToFamily`.
 *
 * NO `import 'server-only'`, matching `lib/auth/family.ts` and `lib/notifications.ts`,
 * which reach for the same client and carry none. `createAdminClient()` reads its key at
 * CALL time and throws without it, so the module imports cleanly under vitest — which is
 * what lets the two pure exports below be tested at all (AGENTS.md §7b). A `server-only`
 * import would buy a build error for a mistake nothing in the tree has made, at the cost of
 * making the testable half untestable.
 */

/** What money is attached, so a message can name it rather than say "something". */
export interface MoneyAttached {
  /** True when anything below is non-zero. The only field most callers need. */
  any: boolean
  /** Dues or donation payments recorded against it, reversals included. */
  payments: number
  /** Contributions into it. */
  contributions: number
  /** Disbursements out of it, or attributed to it. */
  disbursements: number
  /** Transfers it has been either side of. */
  transfers: number
  /**
   * Gatherings drawing on it — a budget the family has committed against this fund.
   *
   * The only entry here that is not a LEDGER row, and the one whose absence would have
   * been silent. It is also the only one where the schema refuses the delete on its own,
   * and the two cases are opposite — MEASURED on Postgres 15 rather than reasoned about,
   * because the mechanism is not the obvious one:
   *
   *   budget set     `DELETE FROM funds` is REFUSED, 23514, naming
   *                  `gatherings_budget_needs_fund`. `ON DELETE SET NULL` is carried out
   *                  by an internal RI trigger as an ordinary UPDATE, and every constraint
   *                  on the referencing table is enforced on that UPDATE — the same reason
   *                  a NOT NULL column with SET NULL raises at PARENT-delete time. So the
   *                  row is never left in the forbidden state, and what the treasurer sees
   *                  is a bare constraint name. That is what this count is for: to get
   *                  there first and say it in a sentence.
   *   no budget set  the delete SUCCEEDS and severs the link SILENTLY. Nothing objects,
   *                  because nothing is wrong: a gathering with no amount typed in and no
   *                  fund is a legal row.
   *
   * COUNTED IN BOTH CASES, deliberately, and the second is why it has to be. A gathering
   * pointing at a fund has already answered "which pot is this coming out of", and losing
   * that answer with no error anywhere is the harm; the amount arriving later is ordinary.
   * Same asymmetry the header states — a false "nothing attached" is irreversible and a
   * false "money attached" is a retry.
   *
   * `20260819000000`'s verify block probes both directions against real rows, so the two
   * paragraphs above are asserted rather than described. An earlier version of this comment
   * said the row was left FROZEN, raising on its next unrelated update; that is not what
   * happens in either branch.
   */
  gatherings: number
}

const NONE: MoneyAttached = {
  any: false, payments: 0, contributions: 0, disbursements: 0, transfers: 0,
  gatherings: 0,
}

/**
 * The records this rule covers. Adding a sixth means adding it here AND consulting it in
 * that record's delete action — the audit in `scripts/money-guard.mjs` is what notices when
 * only one of the two is done.
 */
export type MoneyBearing =
  | 'dues_schedule'
  | 'fund'
  | 'fund_milestone'
  | 'person'

/**
 * COUNT-ONLY QUERIES, one per referencing table, `head: true` so no rows come back.
 *
 * `family_code` is on every one of these tables and is applied to every query — not
 * decoration: the service role has no RLS, so without it an id from another family would
 * answer honestly about that family's money and this guard would report "nothing attached"
 * for a row it cannot see. §3.
 *
 * Every count reads the error and treats a REFUSED query as money present. That is the
 * opposite of this file's usual §8 advice and it is deliberate: the failure modes are not
 * symmetric. Reporting "no money attached" because PostgREST was unhappy deletes a funded
 * record; reporting "money attached" because PostgREST was unhappy refuses a delete that a
 * retry will allow. One is irreversible.
 */
export async function moneyAttachedTo(
  kind: MoneyBearing,
  id: string,
  familyCode: string,
): Promise<MoneyAttached> {
  // FAIL TOWARD REFUSING, on every early exit in this function. See the note above about
  // the asymmetry: a false "nothing attached" deletes a funded record irreversibly, and a
  // false "money attached" refuses a delete a retry will allow.
  if (!familyCode || !isUuid(id)) return { ...NONE, any: true }

  const admin = createAdminClient()

  /**
   * `filter` is a PostgREST `or` expression, and one code path covers both shapes — a
   * single equality and the two-column transfer test — because `.or()` accepts either.
   *
   * WHICH IS WHY `id` IS UUID-CHECKED ABOVE. A filter STRING built from a value that
   * arrived in an HTTP request is an injection surface: a crafted `id` could rewrite the
   * expression, and the direction it would fail in is "no money attached", which permits
   * the delete. `deleteFund` has carried the same `.or()` since transfers shipped, without
   * the check; this is where it gets one. A uuid contains no character `.or()` treats as
   * syntax, so validating the shape closes it completely rather than by escaping.
   */
  const count = async (table: string, filter: string): Promise<number> => {
    const { count: n, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('family_code', familyCode)
      .or(filter)
    if (error) {
      console.error(`[money-attached] ${table} count refused for ${kind} ${id}: ${error.message}`)
      return 1
    }
    return n ?? 0
  }

  switch (kind) {
    case 'dues_schedule': {
      // Both kinds of schedule live in this table — a due and a donation drive — and both
      // are paid into `dues_payments`. One query covers them.
      const payments = await count('dues_payments', `schedule_id.eq.${id}`)
      return { ...NONE, payments, any: payments > 0 }
    }
    case 'fund': {
      // FOUR referencing tables, and every one of them matters. Contributions and
      // disbursements CASCADE, so deleting the fund destroys them; transfers CASCADE and
      // would rewrite the OTHER fund's balance. `deleteFund` refused on transfers alone.
      //
      // There was a FIFTH, `event_expenses` (SET NULL, leaving an event's spend charged to
      // nothing), and that table is dropped — `20260819000006`.
      //
      // `gatherings` IS NOT A LEDGER — it is a COMMITMENT, which is why it took a schema to
      // find it. 20260819000000 gives a gathering a budget drawn on a fund, `fund_id` SET
      // NULL, and a CHECK (`gatherings_budget_needs_fund`) that a budget names a fund. So it
      // does something none of the three above do, and in two opposite ways depending on
      // whether an amount has been typed in: with a budget set, the fund DELETE is REFUSED
      // outright with a bare 23514 (the RI SET NULL is an ordinary UPDATE and the CHECK is
      // enforced on it); with no budget set, the link is severed with no error at all. This
      // count is what turns the first into a sentence and what notices the second. Both
      // measured; see the field's comment.
      const [contributions, disbursements, transfers, gatherings] = await Promise.all([
        count('fund_contributions', `fund_id.eq.${id}`),
        count('fund_disbursements', `fund_id.eq.${id}`),
        count('fund_transfers', `from_fund_id.eq.${id},to_fund_id.eq.${id}`),
        count('gatherings', `fund_id.eq.${id}`),
      ])
      return {
        ...NONE,
        contributions, disbursements, transfers, gatherings,
        any: contributions + disbursements + transfers + gatherings > 0,
      }
    }
    case 'fund_milestone': {
      const disbursements = await count('fund_disbursements', `milestone_id.eq.${id}`)
      return { ...NONE, disbursements, any: disbursements > 0 }
    }
    case 'person': {
      // ── ADDED 2026-09-02 FOR `deletePersonRecord` ────────────────────────────────
      // A `people` row is the fourth money-bearing record, and it is the one where the
      // schema does the MOST damage on its own: `dues_payments.person_id` is ON DELETE
      // CASCADE, so deleting a person destroys their ledger. `dues_payments` is append-only
      // by design (`20260806000002`) — a correction is a negative row, never an edit — and a
      // cascade walks straight past that intent.
      //
      // MEASURED rather than reasoned about, because the outcome is not the obvious one:
      // `dues_payments_immutable` refuses a DELETE, and an RI cascade is not exempt, so the
      // parent delete comes back as a bare trigger exception naming a table the administrator
      // has never heard of. So this count is what gets there first and says it in a sentence —
      // the same job it does for `gatherings` on a fund.
      //
      // THREE TABLES, and the third is the quiet one. Payments and disbursements CASCADE, so
      // the rows would go; `fund_contributions.contributor_person_id` is SET NULL, so the
      // money SURVIVES and stops being attributed to anybody — a contribution the family can
      // still see in its total and can no longer credit. Counted for that reason: losing the
      // attribution silently is the harm, and it is exactly the asymmetry this file's header
      // is about.
      //
      // NOT `fund_transfers` — it has no person column, only `recorded_by`, which is SET NULL
      // and is a fact about who typed it rather than about whose money it is. NOT
      // `gatherings` either, for the same reason: `created_by`, not a beneficiary.
      const [payments, contributions, disbursements] = await Promise.all([
        count('dues_payments', `person_id.eq.${id}`),
        count('fund_contributions', `contributor_person_id.eq.${id}`),
        count('fund_disbursements', `person_id.eq.${id}`),
      ])
      return {
        ...NONE,
        payments, contributions, disbursements,
        any: payments + contributions + disbursements > 0,
      }
    }
  }
}

/**
 * Exactly the canonical 8-4-4-4-12 hex form, which is what `gen_random_uuid()` produces
 * and what every id in this schema is.
 *
 * Deliberately strict rather than permissive: its whole job is to guarantee the value
 * carries no character a PostgREST filter expression treats as syntax, so anything it is
 * unsure about must fail.
 */
export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * The sentence an administrator reads, naming what is actually in the way.
 *
 * `noun` is what they pressed Delete on, in their words — "this due", "the Reunion fund".
 * The message says what exists, what deleting would do to it, and what to do instead,
 * because "cannot be deleted" with no reason reads as a bug.
 *
 * DEACTIVATION IS THE ALTERNATIVE and it is named, because it exists: `funds.active` and
 * `dues_schedules.active` both stop a record being used without touching a row. A refusal
 * that offers no route forward is the thing that gets worked around with a DB console.
 */
export function moneyAttachedMessage(noun: string, attached: MoneyAttached): string {
  const parts: string[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  if (attached.payments) parts.push(plural(attached.payments, 'payment', 'payments'))
  if (attached.contributions) parts.push(plural(attached.contributions, 'contribution', 'contributions'))
  if (attached.disbursements) parts.push(plural(attached.disbursements, 'disbursement', 'disbursements'))
  if (attached.transfers) parts.push(plural(attached.transfers, 'transfer', 'transfers'))
  // "1 gathering" rather than "1 gathering budget": the count includes a gathering that
  // names this fund and has not had an amount typed into it yet (see the field comment),
  // and naming a budget that does not exist yet would be the one part of this sentence a
  // treasurer could go and check and find wrong. The gathering is the thing they can find.
  if (attached.gatherings) parts.push(plural(attached.gatherings, 'gathering', 'gatherings'))

  const what = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0] ?? 'money'

  return `${noun} has ${what} recorded against it, so it cannot be deleted — the family's `
    + 'books have to keep adding up. Mark it inactive instead, which stops it being used '
    + 'and leaves every figure where it is.'
}
