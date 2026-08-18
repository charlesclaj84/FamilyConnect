import { describe, expect, it } from 'vitest'
import {
  scopeAttachedMessage, NO_SCOPE_ATTACHMENTS, type ScopeAttached,
} from '@/lib/scope-attached'

/**
 * The PURE half of the region/chapter guard. `scopeAttachedTo` and `scopeAttachmentsFor`
 * need a database and belong in `tests/rls`; this does not and belongs here (AGENTS.md §7b).
 *
 * Its sibling `lib/money-attached.test.ts` is the model, and the one thing worth repeating
 * from its header applies here too: nothing under vitest can prove the guard is WIRED. That
 * `deleteChapter` calls it before deleting is asserted in `tests/rls`, against real policies
 * with a real chapter somebody is in.
 *
 * CHECKED BY MUTATION (2026-08-18). Three tripped; observed, not expected:
 *   * the plural branch fixed to the singular                  3 failed
 *   * the final "and" collapsed to `join(', ')`                3 failed
 *   * `?? 'something'` removed from the empty case             1 failed — an `undefined`
 *                                                              in the sentence a reader sees
 *
 * AND ONE SURVIVED, stated rather than quietly omitted. Adding `chaptersMoving` to the
 * module's `BLOCKING` list — which would refuse to delete a region BECAUSE it has chapters
 * in it, the one reference that is supposed to permit the delete — changes nothing here.
 * `summarize` is not exported, so the last test below can only build a `ScopeAttached`
 * literal and assert about the message; it cannot exercise the rule that computes `any`.
 *
 * THAT RULE IS ASSERTED IN `tests/rls` INSTEAD, and it has to be, because the honest test of
 * it is a real region delete: `admin/chapters.deleteRegion` has a control that deletes a
 * region with a chapter in it and watches the chapter arrive under National. If that case is
 * ever removed, this file goes green over a guard that could refuse every region in the
 * product.
 */

const attached = (over: Partial<ScopeAttached>): ScopeAttached => ({
  ...NO_SCOPE_ATTACHMENTS, ...over, any: true,
})

describe('scopeAttachedMessage', () => {
  it('names one kind of thing, singular', () => {
    const m = scopeAttachedMessage('The Houston chapter', attached({ members: 1 }))
    expect(m).toContain('The Houston chapter still has 1 member attached')
    // Not a bare `not.toContain('members')`: the advice at the end of the sentence says
    // "Move the members to another chapter", which is correct prose and would fail it.
    expect(m).not.toContain('1 members')
  })

  it('pluralises', () => {
    expect(scopeAttachedMessage('The Houston chapter', attached({ members: 14 })))
      .toContain('14 members attached')
  })

  it('joins exactly two kinds without a comma', () => {
    expect(scopeAttachedMessage('The Texas region', attached({ schedules: 1, positions: 2 })))
      .toContain('1 dues schedule and 2 board positions')
  })

  it('joins several kinds with a final "and"', () => {
    const m = scopeAttachedMessage('The Houston chapter', attached({
      members: 3, schedules: 1, announcements: 2, positions: 1,
    }))
    expect(m).toContain('3 members, 1 dues schedule, 2 announcements and 1 board position')
  })

  it('says "something" rather than nothing when the counts are all zero', () => {
    // Reachable: `scopeAttachedTo` sets `any` with no count when a query is REFUSED and it
    // fails toward refusing. The sentence still has to read as English rather than leaking
    // an `undefined` at somebody trying to tidy up their family.
    const m = scopeAttachedMessage('The Texas region', attached({}))
    expect(m).toContain('still has something attached')
    expect(m).not.toContain('undefined')
  })

  it('never names the chapters that would MOVE, because they are not in the way', () => {
    // Deleting a region moves its chapters to National — that is the product, not an
    // obstacle. A message that listed them would be explaining a refusal with the one
    // reference that permits the delete.
    //
    // THIS ASSERTS THE MESSAGE AND NOT `any`. Building the literal below cannot test the
    // rule that computes `any` — see the header, and the surviving mutation recorded there.
    const moving: ScopeAttached = { ...NO_SCOPE_ATTACHMENTS, chaptersMoving: 4 }
    expect(scopeAttachedMessage('The Texas region', moving)).not.toContain('4')
    expect(scopeAttachedMessage('The Texas region', moving)).toContain('something attached')
  })
})
