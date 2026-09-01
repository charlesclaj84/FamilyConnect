import { describe, expect, it } from 'vitest'

import { notificationText } from '@/lib/notification-text'
import { tFor } from '@/lib/i18n/catalogues'

/**
 * `lib/notification-text.ts`, under `npm test` — a `verify.yml` step, so this gates a PR.
 *
 * ── WHAT IS WORTH TESTING IS THE THREE FALLBACK STATES ─────────────────────────────
 * The happy path is one `t` call. What earns a test is the case that would put
 * `notify.taskSubmitted.title` on somebody's bell: `t` echoes an unknown key back, so a naive
 * `t(key ?? '')` renders the key. That is worse than the English it replaced, and it is exactly
 * what a half-finished catalogue produces.
 *
 * ── MUTATION-CHECKED (2026-09-01) ──────────────────────────────────────────────────
 *   * dropping `rendered !== key`  -> the unknown-key test
 *   * returning `''` instead of `fallback` -> the no-key and unknown-key tests
 *   * ignoring `params`            -> the interpolation test
 */

describe('notificationText', () => {
  const t = tFor('en')

  it('renders the key in the reader’s language, with its params', () => {
    const es = notificationText(
      'notify.membershipRequest.body', 'IGNORED ENGLISH',
      { who: 'Martha Allen', family: 'The Allens' }, tFor('es'),
    )
    expect(es).toContain('Martha Allen')
    expect(es).toContain('The Allens')
    // The Spanish, not the row's English — which is the whole point of the column.
    expect(es).not.toBe('IGNORED ENGLISH')
    expect(es).toContain('ha pedido')
  })

  it('falls back to the row’s English when there is no key', () => {
    // Rows written before 20260901000004. There are real ones on any database that has been
    // running, and they must keep saying what they said.
    expect(notificationText(null, 'A new member is waiting for approval', null, t))
      .toBe('A new member is waiting for approval')
  })

  it('falls back when the key DOES NOT RESOLVE, which is the case that matters', () => {
    // `t` echoes an unknown key. Rendering that puts `notify.somethingNew.title` on a bell —
    // worse than the English it replaced, and precisely what a `type` added without a
    // catalogue entry produces.
    expect(notificationText('notify.doesNotExist.title', 'A gathering task was reopened', null, t))
      .toBe('A gathering task was reopened')
    // And the echo is real, so the guard is not hypothetical.
    expect(t('notify.doesNotExist.title')).toBe('notify.doesNotExist.title')
  })

  it('answers null for a body that is absent in both forms', () => {
    // A title is NOT NULL; a body is optional. `null` is how the bell knows not to draw the
    // second line, and an empty string would draw an empty one.
    expect(notificationText(null, null, null, t)).toBeNull()
    expect(notificationText(undefined, undefined, undefined, t)).toBeNull()
  })

  it('keys every notification type the product writes, in every language', () => {
    // THE COUPLING WORTH ASSERTING. `lib/notifications.ts` names these keys and nothing else
    // checks that all three catalogues hold them — a missing one falls back to English
    // silently, which is the failure this whole change exists to remove.
    const keys = [
      'notify.membershipRequest.title', 'notify.membershipRequest.body',
      'notify.membershipAppeal.title', 'notify.membershipAppeal.body',
      'notify.membershipAppeal.bodyNote',
      'notify.membershipApproved.title', 'notify.membershipRejected.title',
      'notify.taskAssigned.title', 'notify.taskAssigned.body', 'notify.taskAssigned.bodyDue',
      'notify.taskSubmitted.title', 'notify.taskSubmitted.body',
      'notify.taskApproved.title', 'notify.taskApproved.body', 'notify.taskApproved.bodyNotes',
      'notify.taskDenied.title', 'notify.taskDenied.body', 'notify.taskDenied.bodyNotes',
      'notify.taskReopened.title', 'notify.taskReopened.body', 'notify.taskReopened.bodyReason',
      'notify.meeting.title', 'notify.meeting.body', 'notify.meeting.bodyWhen',
      'notify.safety.title', 'notify.safety.body',
    ]
    for (const locale of ['en', 'es', 'fr']) {
      const tl = tFor(locale)
      for (const key of keys) {
        expect(tl(key), `${key} in ${locale}`).not.toBe(key)
      }
    }
  })

  it('never calls a sent-back task “denied” in any language', () => {
    // The product decision `lib/notifications.ts` argues at its own call site: the task is open
    // to the member again and they are being asked to change something, so the sentence
    // describes what happened to the WORK. A translation is the easiest place to lose that.
    expect(tFor('en')('notify.taskDenied.body').toLowerCase()).toContain('sent back')
    expect(tFor('es')('notify.taskDenied.body').toLowerCase()).not.toContain('rechaz')
    expect(tFor('fr')('notify.taskDenied.body').toLowerCase()).not.toContain('refus')
  })
})
