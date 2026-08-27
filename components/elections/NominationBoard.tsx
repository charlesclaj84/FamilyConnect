'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle, Clock, Plus, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { PersonPicker } from '@/components/ui/person-picker'
import { useConfirm } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
import {
  retractNomination, submitNomination,
  type Election, type ElectionPosition, type ElectionNomination, type ElectionNominee,
} from '@/app/actions/elections'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The nominations half of a member's ballot, rebuilt 2026-08-21.
 *
 * ── IT IS ORGANISED BY OFFICE, WHICH IS THE WHOLE CHANGE ────────────────────────────
 * What this replaced was three controls in a column — "Put Yourself on the Ballot" with its
 * own position `<select>`, "Nominate Someone Else" with a second one, and a read-only
 * "Current Candidates" list underneath — so the thing a member came to do was split across
 * two forms and the thing they came to READ was a third list they could not act on. Choosing
 * an office happened twice and choosing a person happened somewhere else.
 *
 * Now the office is the heading, the people standing for it are under it, and both actions
 * hang off the office they belong to. There is no position picker at all: which office you
 * are nominating for is which heading you pressed.
 *
 * ── ONE RULE DECIDES EVERY CONTROL ON A ROW ─────────────────────────────────────────
 * *You may retract a nomination you made. Not one somebody else made, and not one the nominee
 * has already accepted — unless the nominee is you.*
 *
 * It is resolved SERVER-SIDE as `nomination.retractable` and not recomputed here.
 * `20260821000004` §4c is the same rule as a policy, `getElectionDetail` is the same rule as
 * a field, and a third copy in TSX is the one that drifts. It also depends on the nominations
 * window, which depends on the clock — and reading the clock during render makes a
 * component's output depend on when it happened to render, which is what `BallotForm`'s
 * header argues at length about `phase`.
 *
 * ── WHY A COUNT AND NOT NAMES ───────────────────────────────────────────────────────
 * A row says "nominated by you and 2 others", never who the two are. `getElectionDetail`
 * publishes `nominator_count` and `i_nominated` rather than the list, and that is a §5
 * decision made there: the screen needs the answer, not the rows, and a family reading off
 * who nominated whom is more than this feature was asked for.
 *
 * ── THE DIALOG DOES NOT HIDE PEOPLE WHO ARE ALREADY STANDING ────────────────────────
 * Filtering them out of the picker would be the obvious tidy-up and it would remove the
 * feature: a second member nominating the same person is exactly the case
 * `election_nomination_supporters` exists for. So they stay in the list, the dialog says who
 * is already standing, and picking one of them adds your name to their candidacy —
 * `submitNomination` turns the UNIQUE collision into that (see its comment on 23505).
 */

interface Props {
  election: Election
  positions: ElectionPosition[]
  nominations: ElectionNomination[]
  /** Only the members who may stand in THIS election, resolved server-side. */
  nominees: ElectionNominee[]
  myPersonId: string | null
}

export function NominationBoard({
  election, positions, nominations, nominees, myPersonId,
}: Props) {
  const t = useT()
  const confirm = useConfirm()
  const [openFor, setOpenFor] = useState<ElectionPosition | null>(null)
  const [nomineeId, setNomineeId] = useState('')
  // TWO ERROR SLOTS, because the two surfaces cannot share one. A refusal from inside the
  // dialog has to be read while the dialog is still open — beside the button that caused it —
  // and a refusal from a row's withdraw control has to be read on the page. One slot would
  // put the dialog's message behind the scrim, or the page's message on a panel nobody has
  // open. AGENTS.md's rule about a message inside a scrolling panel, one level up.
  const [dialogError, setDialogError] = useState('')
  const [boardError, setBoardError] = useState('')
  const [isPending, startTransition] = useTransition()

  // position_id -> the people standing for it. A DECLINED nomination is not a candidacy and
  // is dropped here rather than rendered greyed out: the member said no, and a ballot that
  // keeps showing them invites a vote for somebody who has refused the office.
  const byPosition = useMemo(() => {
    const map = new Map<string, ElectionNomination[]>()
    for (const n of nominations) {
      if (n.accepted === false) continue
      map.set(n.position_id, [...(map.get(n.position_id) ?? []), n])
    }
    // Accepted first, then alphabetically. A member scanning an office wants to know who is
    // actually standing before who has been asked.
    for (const [k, list] of map) {
      map.set(k, [...list].sort((a, b) =>
        Number(b.accepted === true) - Number(a.accepted === true)
        || a.nominee_name.localeCompare(b.nominee_name)))
    }
    return map
  }, [nominations])

  function nominate(positionId: string, personId: string) {
    setDialogError('')
    startTransition(async () => {
      const result = await submitNomination(election.id, positionId, personId)
      if (!result.success) setDialogError(result.message ?? t('elec.nominateFailed'))
      else { setNomineeId(''); setOpenFor(null) }
    })
  }

  async function withdraw(nomination: ElectionNomination) {
    const position = positions.find(p => p.id === nomination.position_id)
    const isMe = nomination.nominee_id === myPersonId
    const others = nomination.nominator_count - 1
    const ok = await confirm({
      title: isMe ? t('elec.withdrawYours') : t('elec.takeNameOff'),
      // WHAT IT SAYS DEPENDS ON WHETHER ANYBODY ELSE NOMINATED THEM, because the two cases
      // have different consequences and a member pressing this has to know which one they
      // are in. With others behind it the candidate stays on the ballot; alone, they come off.
      description: isMe
        ? `Stand down from ${position?.title ?? 'this position'}?`
        : others > 0
          ? `${nomination.nominee_name} was also nominated by ${others} other `
            + `${others === 1 ? 'member' : 'members'}, so they stay on the ballot for `
            + `${position?.title ?? 'this position'} — only your name comes off.`
          : `You are the only person who nominated ${nomination.nominee_name} for `
            + `${position?.title ?? 'this position'}, so they will come off the ballot.`,
      confirmLabel: isMe ? t('elec.withdraw') : t('elec.takeMyNameOff'),
      destructive: true,
    })
    if (!ok) return
    setBoardError('')
    startTransition(async () => {
      const result = await retractNomination(nomination.id, election.id)
      if (!result.success) setBoardError(result.message ?? t('elec.withdrawFailed'))
    })
  }

  // Whether the caller can stand for an office themselves: they have a person row, that row
  // is in the election's area (which is what `nominees` already is), and they are not already
  // standing for it. The third is what turns the dialog's shortcut off rather than letting it
  // produce "you have already nominated them".
  const iAmEligible = Boolean(myPersonId && nominees.some(n => n.id === myPersonId))
  const iAmStandingFor = (positionId: string) =>
    (byPosition.get(positionId) ?? []).some(n => n.nominee_id === myPersonId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold">{t('elec.nominations')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Put a relative forward for any office below, or stand for one yourself. You can take
          your own name off a nomination while nominations are open.
        </p>
      </div>

      <FormError message={boardError} />

      {positions.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('elec.noOffices')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map(position => {
            const standing = byPosition.get(position.id) ?? []
            return (
              <section key={position.id} className="rounded-xl border bg-card">
                <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm">{position.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {standing.length === 0
                        ? t('elec.nobodyNominated')
                        : `${standing.length} ${standing.length === 1 ? 'person' : 'people'} nominated`}
                      {position.max_winners > 1 && ` · ${position.max_winners} to be elected`}
                    </p>
                  </div>
                  <Button size="sm" variant="affirm" disabled={isPending}
                    onClick={() => { setNomineeId(''); setDialogError(''); setOpenFor(position) }}>
                    <Plus /> {t('elec.nominate')}
                  </Button>
                </header>

                {standing.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    {t('elec.noNominations')}
                  </p>
                ) : (
                  <ul className="divide-y">
                    {standing.map(nomination => (
                      <li key={nomination.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                        {nomination.accepted === true
                          ? <CheckCircle className="h-4 w-4 shrink-0 text-brand-affirm" />
                          : <Clock className="h-4 w-4 shrink-0 text-brand-accent" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {nomination.nominee_name}
                            {nomination.nominee_id === myPersonId && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {nomination.accepted === true ? t('elec.accepted') : t('elec.waitingAnswer')}
                            {' · '}
                            {nominatedByLabel(nomination)}
                          </p>
                        </div>
                        {nomination.retractable && (
                          <Button size="sm" variant="ghost" disabled={isPending}
                            onClick={() => withdraw(nomination)}>
                            <X /> {nomination.nominee_id === myPersonId
                              ? t('elec.withdraw')
                              : t('elec.takeMyNameOff')}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* ── The popup ─────────────────────────────────────────────────────── */}
      <Dialog
        open={openFor !== null}
        onClose={() => setOpenFor(null)}
        title={openFor ? `Nominate for ${openFor.title}` : t('elec.nominate')}
        description={election.scope === 'national'
          ? t('elec.anybodyMayBe')
          : `Only ${election.scope_label} may be nominated in this election.`}
      >
        {openFor && (
          <div className="space-y-4">
            {/* STANDING FOR YOURSELF IS ONE PRESS, and it is here rather than as a second
                panel on the page because it is the same act: it was a separate form with its
                own position picker, which asked the member to choose an office they had
                already chosen. Offered only when they are eligible AND not already standing —
                a button that can only answer "you have already nominated them" is not a
                control. */}
            {iAmEligible && !iAmStandingFor(openFor.id) && (
              <div className="rounded-lg border border-brand-primary/20 bg-brand-soft/40 p-3">
                <Button size="sm" variant="default" disabled={isPending}
                  onClick={() => myPersonId && nominate(openFor.id, myPersonId)}>
                  <UserPlus /> {t('elec.putMyselfForward')}
                </Button>
                <p className="mt-2 text-xs text-brand-on-soft">
                  Standing for an office yourself needs nobody else&rsquo;s agreement, and it
                  counts as accepted straight away.
                </p>
              </div>
            )}

            {/* WHO IS ALREADY STANDING, stated inside the dialog. Without it a member picks a
                name, is told "you have already nominated them", and has to close the dialog to
                find out who else is on the list. */}
            {(byPosition.get(openFor.id) ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Already nominated:{' '}
                {(byPosition.get(openFor.id) ?? []).map(n => n.nominee_name).join(', ')}.
                Choosing one of them adds your name to their nomination.
              </p>
            )}

            <PersonPicker
              people={nominees}
              value={nomineeId}
              onChange={setNomineeId}
              label={t('elec.whoNominating')}
              emptyMessage={`Nobody in ${election.scope_label} can be nominated yet.`}
            />

            <FormError message={dialogError} />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenFor(null)} disabled={isPending}>
                {t('action.cancel')}
              </Button>
              <Button variant="affirm" disabled={isPending || !nomineeId}
                onClick={() => nominate(openFor.id, nomineeId)}>
                {t('elec.nominate')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

/**
 * "nominated by you", "by you and 2 others", "by 3 members".
 *
 * A count, never names — see the module header. The caller's own part is named because it is
 * what the withdraw control on the same row is about, and a row that offers "take my name
 * off" without saying your name is on it is asking somebody to take it on trust.
 */
function nominatedByLabel(n: ElectionNomination): string {
  const others = n.nominator_count - (n.i_nominated ? 1 : 0)
  if (n.i_nominated && others === 0) return 'nominated by you'
  if (n.i_nominated) return `nominated by you and ${others} ${others === 1 ? 'other' : 'others'}`
  // A candidacy with no supporter rows is possible and legitimate — `nominated_by` is
  // nullable, so an organizer-authored nomination has nobody behind it — and "nominated by 0
  // members" is not a sentence.
  if (n.nominator_count === 0) return 'on the ballot'
  return `nominated by ${n.nominator_count} ${n.nominator_count === 1 ? 'member' : 'members'}`
}
