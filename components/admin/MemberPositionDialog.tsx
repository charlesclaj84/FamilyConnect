'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import { formatBoardTitle, positionScopeLabel } from '@/lib/board-positions'
import {
  assignBoardPosition, revokeBoardPosition,
  type BoardPosition, type BoardPositionHolder,
} from '@/app/actions/admin/chapters'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * One member's board positions — give one, take one away.
 *
 * ── IT USED TO BE THE OTHER WAY ROUND ──────────────────────────────────────────────
 * Until 2026-08-20 this was done from the Organization pane: a "Held by" column listing every
 * officer under each office, an **Assign** button per POSITION opening a person picker, and an
 * × beside each name. That pane now does one job — deciding which offices the family keeps —
 * and this is the other half, reached from the member's own row.
 *
 * The split is by WHO THE READER IS THINKING ABOUT. "Which offices do we have" is a decision
 * about the family, revisited yearly, and belongs beside the regions and chapters. "Ada is the
 * Treasurer now" is a decision about ADA, and every other decision about Ada is on her row —
 * her permission template, whether her access is on, her profile. The old arrangement made an
 * administrator find the office in order to find the person.
 *
 * ── A POSITION IS NOT A SINGLE-VALUED FIELD, WHICH IS WHY THIS IS NOT A PICKER ──────
 * `user_roles` has no uniqueness on `(user_id, family_code)`: a member may hold the Treasurer's
 * job nationally AND chair the Austin chapter, and a family with four officers and twelve
 * chapters relies on it. So this dialog LISTS what they hold with a bin beside each, and adds
 * one at a time underneath — it is not a `<Select>` whose value is "their position", because
 * there is no such value.
 *
 * ── THE PLACE IS PART OF THE ASSIGNMENT, NOT PART OF THE POSITION ───────────────────
 * A position's `scope` says whether it is national, regional or per-chapter; WHICH region or
 * chapter is decided when it is given to somebody, and lives on the `user_roles` row. So
 * picking a regional position makes a second control appear, and the same title can be held
 * once in each region — see `20260820000000`, which is what made that possible.
 *
 * A family with no regions cannot fill a regional position at all, and the dialog says so
 * rather than offering an empty picker: the assignment would be refused, and being told why
 * before pressing is better than after.
 *
 * ── EVERY WRITE REFRESHES RATHER THAN PATCHING A LIST ───────────────────────────────
 * `router.refresh()`, like the pane this replaced. The holders list is a server prop shared
 * with the roster's Position column, so a locally patched copy here would leave the column
 * behind it stale — two views of one fact disagreeing, which is the thing `useServerState`
 * exists to prevent everywhere else. A refresh is one round trip and both are right.
 */
export function MemberPositionDialog({
  personName, personId, positions, holders, regions, chapters, mayAssign, onClose,
}: {
  personName: string
  /** `people.id` — what `assignBoardPosition` takes, never an auth id (§4b). */
  personId: string
  /** Every office the family keeps. Empty is a real state and is answered. */
  positions: BoardPosition[]
  /**
   * THIS MEMBER'S holdings only. The caller filters the family-wide list on `person_id`, so
   * this component never sees another member's assignments — which keeps the decision about
   * who is shown in one place rather than repeated here.
   */
  holders: BoardPositionHolder[]
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string }[]
  /**
   * `admin/members/board-positions:edit`. False makes this a read-only list — worth having
   * rather than hiding the whole dialog, because seeing who holds what is a `view` question
   * and the roster column already answers it in one line.
   */
  mayAssign: boolean
  onClose: () => void
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [positionId, setPositionId] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const chosen = positions.find(p => p.id === positionId) ?? null
  const needsPlace = chosen?.scope === 'chapter' || chosen?.scope === 'regional'
  const placeOptions = chosen?.scope === 'chapter' ? chapters : regions

  async function handleAssign() {
    if (!chosen) { setError(t('pos.choose')); return }
    if (needsPlace && !placeId) {
      setError(`Choose which ${chosen.scope === 'chapter' ? 'chapter' : 'region'}`)
      return
    }
    setBusy(true)
    setError('')
    const result = await assignBoardPosition({
      positionId: chosen.id,
      personId,
      chapterId: chosen.scope === 'chapter' ? placeId || null : null,
      regionId:  chosen.scope === 'regional' ? placeId || null : null,
    })
    setBusy(false)
    if (!result.success) { setError(result.error ?? t('pos.giveFailed')); return }
    setPositionId('')
    setPlaceId('')
    router.refresh()
  }

  async function handleRevoke(holder: BoardPositionHolder) {
    if (busy) return
    setError('')
    const ok = await confirm({
      title: t('pos.takeAway'),
      description: `Take "${holder.position_name}" away from ${personName}? `
        + t('pos.takeAwayBody'),
      confirmLabel: t('pos.takeItAway'),
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const result = await revokeBoardPosition(holder.assignment_id)
    setBusy(false)
    if (!result.success) { setError(result.error ?? t('pos.takeAwayFailed')); return }
    router.refresh()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${personName}’s positions`}
      description={t('pos.oneOrMore')}
      className="max-w-lg"
    >
      <div className="mt-2 space-y-5">
        {/* ── What they hold now ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('pos.holdsNow')}</h3>
          {holders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No position yet.{' '}
              {mayAssign ? t('pos.giveOneBelow') : t('pos.somebodyElse')}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {holders.map(h => (
                <li key={h.assignment_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {/* THE SAME PHRASE THE ROSTER COLUMN PRINTS, from the same function — see
                      `formatBoardTitle`. Two places composing "Austin Chapter Treasurer" by
                      hand is how one of them comes to say "Chapter Austin Treasurer". */}
                  <span className="min-w-0 flex-1">
                    {formatBoardTitle({
                      positionName: h.position_name,
                      scope: h.scope,
                      chapterName: h.chapter_name,
                      regionName: h.region_name,
                    })}
                  </span>
                  {mayAssign && (
                    // `p-1` and not a bare glyph: a 14px hit target on a destructive control is
                    // the mis-tap AGENTS.md makes the argument about for `PersonMultiSelect`'s
                    // chips, and these sit one line apart.
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRevoke(h)}
                      aria-label={`Take ${h.position_name} away from ${personName}`}
                      className="-my-1 shrink-0 p-1 text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Give them one ───────────────────────────────────────────────────────── */}
        {mayAssign && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">{t('pos.give')}</h3>

            {positions.length === 0 ? (
              // A DEAD END WITH A WAY OUT. The family has no offices, so there is nothing to
              // give — and the place to fix that is a tab away, so the sentence names it.
              <p className="text-sm text-muted-foreground">
                Your family has not set up any board positions yet. Add them under
                Members &amp; Access → Organization, then come back.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="member-position">{t('pos.position')}</Label>
                  <Select
                    id="member-position"
                    value={positionId}
                    disabled={busy}
                    onChange={e => {
                      setPositionId(e.target.value)
                      // The place belongs to the POSITION's scope, so a different position
                      // makes the old answer meaningless — a chapter id left over from the
                      // previous pick would otherwise be posted against a regional office.
                      setPlaceId('')
                      setError('')
                    }}
                  >
                    <option value="">{t('pos.chooseOne')}</option>
                    {positions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {positionScopeLabel(t, p.scope)}
                      </option>
                    ))}
                  </Select>
                </div>

                {needsPlace && (
                  <div className="space-y-1.5">
                    {/* THE LABEL ONLY EXISTS WHEN ITS CONTROL DOES: a family with no chapters
                        would otherwise get a dead click target and an `sr-only` "(required)"
                        for a `<Select>` that is not in the document. */}
                    {placeOptions.length > 0 && (
                      <Label required htmlFor="member-position-place">
                        {chosen?.scope === 'chapter' ? t('field.chapter') : t('dir.region')}
                      </Label>
                    )}
                    {placeOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Your family has no {chosen?.scope === 'chapter' ? 'chapters' : 'regions'} yet,
                        so this position cannot be given to anybody until it does. Set them up
                        under Members &amp; Access → Organization.
                      </p>
                    ) : (
                      <Select
                        id="member-position-place"
                        value={placeId}
                        disabled={busy}
                        onChange={e => { setPlaceId(e.target.value); setError('') }}
                      >
                        <option value="">{t('pos.chooseOne')}</option>
                        {placeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </Select>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <FormError message={error} />

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy} onClick={onClose}>{t('action.close')}</Button>
          {mayAssign && positions.length > 0 && (
            <Button
              variant="affirm"
              // Disabled when the position needs a place and the family has none, rather than
              // round-tripping to be told to choose from an empty list — under a paragraph that
              // has just explained there is nothing to choose.
              disabled={busy || !positionId || (needsPlace && placeOptions.length === 0)}
              onClick={handleAssign}
            >
              {busy ? t('action.saving') : t('pos.givePosition')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
