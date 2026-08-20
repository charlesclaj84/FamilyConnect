import { describe, expect, it } from 'vitest'
import { isUuid, moneyAttachedMessage } from '@/lib/money-attached'

/**
 * The two PURE halves of the money guard. `moneyAttachedTo` needs a database and belongs in
 * `tests/rls`; these do not and belong here (AGENTS.md §7b).
 *
 * `isUuid` is the one with teeth. It is not a validation nicety — it is what makes the
 * PostgREST `or` filter built from a client-supplied id safe, and the direction it fails in
 * if it is too permissive is "no money attached", which permits an irreversible delete. So
 * it is tested against the things an attacker would actually send.
 *
 * CHECKED BY MUTATION (2026-08-17). Five tripped:
 *   * anchors dropped from the regex (`^`/`$`)                       3 failed
 *   * `{12}` widened to `+`                                          1 failed
 *   * the hex class widened to `\w`                                  1 failed
 *   * `moneyAttachedMessage`'s plural branch fixed to the singular    2 failed
 *   * the `parts.length > 1` join collapsed to `join(', ')`           1 failed
 *
 * AND ONE MORE WITH THE FIFTH COUNT (2026-08-19), which is the count a fund deletion
 * needs and the four above did not have:
 *   * the `attached.gatherings` branch deleted from the message       1 failed
 *
 * AND ONE SURVIVED, which is worth stating rather than quietly omitting: deleting the
 * `isUuid(id)` call from `moneyAttachedTo` itself changes nothing here, because that
 * function needs a database and this file has none. Nothing under vitest can prove the
 * guard is WIRED — only that it works when called. The wiring is asserted in `tests/rls`,
 * where a case passes a crafted id to a real delete against real policies. If that case is
 * ever removed, this file goes green over an unguarded filter.
 */

describe('isUuid', () => {
  it('accepts the canonical form, in either case', () => {
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(isUuid('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toBe(true)
  })

  it('rejects anything with a character a PostgREST filter treats as syntax', () => {
    // THE CASES THAT MATTER. Each of these, unguarded, rewrites the `or` expression it is
    // interpolated into — and a rewritten expression that matches no rows reads as "no
    // money attached", which is what permits the delete.
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301,fund_id.eq.0')).toBe(false)
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301)')).toBe(false)
    expect(isUuid('*')).toBe(false)
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301 or true')).toBe(false)
  })

  it('rejects a value that merely contains a uuid', () => {
    // The anchors. Without them a crafted prefix or suffix passes.
    expect(isUuid(' 3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(false)
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c3301x')).toBe(false)
  })

  it('rejects the wrong shape', () => {
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c330')).toBe(false)   // 11 in the last group
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c33012')).toBe(false) // 13
    expect(isUuid('3f2504e04f8911d39a0c0305e82c3301')).toBe(false)      // no dashes
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c330g')).toBe(false)  // g is not hex
    expect(isUuid('3f2504e0-4f89-11d3-9a0c-0305e82c330_')).toBe(false)  // \w would admit this
  })

  it('rejects empty, null and undefined', () => {
    expect(isUuid('')).toBe(false)
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
  })
})

describe('moneyAttachedMessage', () => {
  // Every count stated, `any: true` — the shape `moneyAttachedTo` returns on an early exit.
  // It is not annotated `MoneyAttached` on purpose: passing it to the function is what
  // type-checks it, so a field added to the interface and not added here is a compile error
  // in this file rather than a silently under-tested message.
  const none = {
    any: true, payments: 0, contributions: 0, disbursements: 0, transfers: 0,
    gatherings: 0,
  }

  it('names one kind of money, singular', () => {
    const m = moneyAttachedMessage('This due', { ...none, payments: 1 })
    expect(m).toContain('This due has 1 payment recorded against it')
    // The way out is named, because a refusal with no route forward is what gets worked
    // around with a database console.
    expect(m).toContain('Mark it inactive instead')
  })

  it('pluralises', () => {
    expect(moneyAttachedMessage('This due', { ...none, payments: 4 }))
      .toContain('4 payments')
    expect(moneyAttachedMessage('A fund', { ...none, transfers: 2 }))
      .toContain('2 transfers')
  })

  it('joins several kinds with a final "and"', () => {
    const m = moneyAttachedMessage('Reunion Fund', {
      ...none, contributions: 3, disbursements: 1, transfers: 2,
    })
    expect(m).toContain('3 contributions, 1 disbursement and 2 transfers')
  })

  it('joins exactly two kinds without a comma', () => {
    // `expenses` was the second kind here until 2026-08-19 — `event_expenses`, dropped with
    // the Events product. A disbursement is the same shape of fact and keeps the assertion
    // about the JOINER, which is what this case is for.
    expect(moneyAttachedMessage('A fund', { ...none, contributions: 1, disbursements: 1 }))
      .toContain('1 contribution and 1 disbursement')
  })

  it('names a gathering drawing on the fund, which is a commitment rather than a ledger row', () => {
    // The one count that is not money already spent or received: a
    // gathering's budget is drawn on the fund, `gatherings.fund_id` is ON DELETE SET NULL,
    // and `gatherings_budget_needs_fund` forbids a budget with no fund. Measured: the
    // constraint is enforced on the RI SET NULL update, so with a budget set the fund
    // DELETE is REFUSED with a bare 23514 — this sentence is what stands in front of it —
    // and with no budget set the link is severed silently, which is the other reason the
    // count exists. Either way the refusal reads as a bug unless the message names it.
    expect(moneyAttachedMessage('Reunion Fund', { ...none, gatherings: 1 }))
      .toContain('Reunion Fund has 1 gathering recorded against it')
    expect(moneyAttachedMessage('Reunion Fund', { ...none, contributions: 2, gatherings: 3 }))
      .toContain('2 contributions and 3 gatherings')
  })

  it('falls back to the word "money" when the counts say nothing', () => {
    // Reachable: `moneyAttachedTo` returns `{ any: true }` with every count at zero on an
    // early exit — a bad uuid, a missing family code, a refused query. The message must
    // still be a sentence rather than "has  recorded against it".
    expect(moneyAttachedMessage('This due', none)).toContain('has money recorded against it')
  })
})
