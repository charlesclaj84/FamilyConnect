'use client'

import {
  useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-message'
import { useConfirm } from '@/components/ui/confirm'
import { AnswerCheckIn } from '@/components/safety/AnswerCheckIn'
import { CheckInRoster } from '@/components/safety/CheckInRoster'
import { RaiseCheckInDialog } from '@/components/safety/RaiseCheckInDialog'
import {
  closeCheckIn, deleteCheckIn, getCheckIn, retryCheckInAsks, sendCheckInAsks,
  type CheckInAudienceOption, type CheckInDetail, type CheckInPickerPerson,
  type CheckInRights, type CheckInSummary, type MyCheckIn,
} from '@/app/actions/safety-check-ins'
import { openedAgo } from '@/lib/safety-check-in'
import { cn } from '@/lib/utils'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * A clock that ticks once a minute, for `openedAgo`.
 *
 * ── `useSyncExternalStore`, NOT `useState` IN AN EFFECT ────────────────────────────
 * The obvious version — `setNow(new Date())` at the top of a `useEffect` — is a cascading render
 * that React Compiler REFUSES as an error, and AGENTS.md records the same trap against
 * `ThemeToggle`: *"reading `localStorage` during render is a hydration mismatch; correcting it
 * from an effect is a cascading render that React Compiler rejects as an error."* A clock is that
 * problem exactly — the value lives outside React, and the server's answer is not the browser's.
 *
 * THE SNAPSHOT IS A MINUTE BUCKET RATHER THAN A `Date`, because `useSyncExternalStore` compares
 * snapshots by identity: a fresh `Date` every call is a new object every time and React would
 * re-render in a loop. A number that only changes once a minute is stable by construction.
 *
 * `getServerSnapshot` ANSWERS 0, and the callers render no relative time for it. That is the
 * honest answer for a server that has no idea what time it is in the reader's browser, and it is
 * why every consumer of this takes `Date | null` — "12 minutes ago" rendered on the server and
 * corrected on hydration is a flash of a wrong number on the one screen where a wrong number
 * about elapsed time matters.
 */
function useMinuteClock(): Date | null {
  const bucket = useSyncExternalStore(
    useCallback((onChange: () => void) => {
      const t = setInterval(onChange, 60_000)
      return () => clearInterval(t)
    }, []),
    () => Math.floor(Date.now() / 60_000),
    () => 0,
  )
  return bucket === 0 ? null : new Date(bucket * 60_000)
}

/**
 * `/community/safety-check-ins`.
 *
 * ── THREE BANDS, IN THE ORDER SOMEBODY NEEDS THEM ──────────────────────────────────
 *   1. CHECK-INS ASKING ME. First, unconditionally, for everybody — no grant is involved. If
 *      your family is asking whether you are alive, that is the only thing on this screen that
 *      matters, and it must not be below a list of past emergencies.
 *   2. THE OPEN CHECK-IN, with its roster. Only where the caller may read a roster.
 *   3. THE PAST ONES, closed.
 *
 * ── THE ASK QUEUE IS DRIVEN FROM HERE, AND IT SAYS SO ──────────────────────────────
 * There is no cron, worker or queue in this product, so the client drives the fan-out a batch at
 * a time — the arrangement `app/actions/distributions.ts` argues at length. Two things about
 * doing it on THIS feature that are not true of a newsletter:
 *
 *   * IT REPORTS WHAT IS HAPPENING WHILE IT HAPPENS. "Asking — 24 of 141 contacted", from the
 *     server's own tally rather than from a client counter, because somebody standing over this
 *     screen during an emergency needs to know whether it is still working.
 *   * IT SURVIVES THE TAB CLOSING. The rows are the queue, so `Ask the rest` picks up where it
 *     stopped. Nobody watching a progress bar during a hurricane is the normal case.
 *
 * ── AND IT NEVER CLAIMS DELIVERY ───────────────────────────────────────────────────
 * `sendEmail` fails soft by design. So the tally distinguishes asked, could-not-ask and
 * never-had-an-address, and no string on this screen says "everybody has been asked".
 * FutureFeature.md §5: *"a check-in nobody receives is worse than none, because it is believed."*
 */
export function SafetyCheckInsClient({
  initialCheckIns,
  myCheckIns,
  audiences,
  people,
  rights,
  zone,
}: {
  /** `null` from the action means a REFUSED read, not an empty list. §8. */
  initialCheckIns: CheckInSummary[] | null
  myCheckIns: readonly MyCheckIn[]
  audiences: readonly CheckInAudienceOption[]
  people: readonly CheckInPickerPerson[]
  rights: CheckInRights
  /** The reader's timezone. `responded_at` on a roster row is an instant. */
  zone: string
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [raiseOpen, setRaiseOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<CheckInDetail | null>(null)
  const [sendingFor, setSendingFor] = useState<string | null>(null)

  const checkIns = initialCheckIns ?? []
  const open = checkIns.filter(c => c.status === 'open')
  const past = checkIns.filter(c => c.status === 'closed')

  const now = useMinuteClock()

  /**
   * Drive the ask queue until it is empty.
   *
   * The loop is bounded rather than `while (more)`: a bug on the server that always reported
   * `more: true` would otherwise mean an unbounded stream of provider calls, which on a metered
   * mail account is the one failure mode worth spending a constant on. 40 batches of 12 is 480
   * relatives, comfortably past any real family.
   */
  const drive = useCallback(async (checkInId: string) => {
    setSendingFor(checkInId)
    setError('')
    try {
      for (let batch = 0; batch < 40; batch += 1) {
        const result = await sendCheckInAsks(checkInId)
        if (!result.success) {
          setError(result.message ?? t('safety.askFailed'))
          break
        }
        router.refresh()
        if (!result.more) break
      }
    } finally {
      setSendingFor(null)
      router.refresh()
    }
  }, [router, t])

  // AUTO-DRIVE ONCE, WHEN A NEWLY RAISED CHECK-IN STILL HAS A QUEUE. Somebody who has just
  // pressed "Ask them" should not then have to find and press a second button — that is exactly
  // the moment they are least able to. It runs once per id per mount, guarded by a ref, so a
  // `router.refresh()` mid-flight cannot start a second loop over the same queue.
  const driven = useRef<Set<string>>(new Set())
  useEffect(() => {
    const next = open.find(c => c.tally.queued > 0 && !driven.current.has(c.id))
    if (!next || sendingFor) return
    driven.current.add(next.id)
    void drive(next.id)
  }, [open, sendingFor, drive])

  const loadDetail = (checkInId: string) => {
    if (expanded === checkInId) { setExpanded(null); setDetail(null); return }
    setExpanded(checkInId)
    setDetail(null)
    startTransition(async () => {
      const loaded = await getCheckIn(checkInId)
      // `null` HERE IS A REFUSAL OR AN OUTAGE, and the panel says "could not be loaded" rather
      // than rendering an empty roster over a check-in with forty people on it.
      setDetail(loaded)
    })
  }

  const act = (fn: () => Promise<{ success: boolean; message?: string }>) => {
    setError(''); setNotice('')
    startTransition(async () => {
      const result = await fn()
      if (!result.success) setError(result.message ?? t('safety.didNotWork'))
      else if (result.message) setNotice(result.message)
      router.refresh()
    })
  }

  /**
   * Deleting, behind the shared `confirm()`.
   *
   * WHAT IS ACTUALLY LOST IS NAMED, per this codebase's rule for every destructive control:
   * deleting destroys the account of who answered and who was never reached, which is the only
   * record a family reviewing a bad night has. `destructive: true` is what draws the red
   * treatment — the one legitimate `--destructive` on this feature, because this genuinely is an
   * irreversible deletion rather than an emergency.
   */
  const remove = (row: CheckInSummary) => {
    startTransition(async () => {
      const ok = await confirm({
        title: t('safety.deleteConfirm'),
        description: t('safety.deleteNamedBody', { title: row.title }),
        confirmLabel: t('action.delete'),
        destructive: true,
      })
      if (!ok) return
      const result = await deleteCheckIn(row.id)
      if (!result.success) setError(result.message ?? t('safety.deleteFailed'))
      else setNotice(result.message ?? t('safety.deleted'))
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-brand-ink">{t('safety.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('safety.lede')}
          </p>
        </div>
        {rights.raise && (
          <Button
            onClick={() => setRaiseOpen(true)}
            className="bg-brand-urgent text-brand-on-urgent hover:opacity-90"
          >
            <ShieldAlert aria-hidden="true" />
            {t('safety.raise')}
          </Button>
        )}
      </header>

      {/* ── 1. ASKING ME ────────────────────────────────────────────────────────────── */}
      {myCheckIns.length > 0 && (
        <section className="space-y-3" aria-labelledby="asking-me">
          <h2 id="asking-me" className="text-sm font-semibold tracking-wide text-brand-ink uppercase">
            {t('safety.askingAboutYou')}
          </h2>
          {myCheckIns.map(mine => (
            <div
              key={mine.checkInId}
              className="rounded-xl border border-brand-urgent bg-brand-urgent/10 p-4"
            >
              <p className="font-semibold text-brand-urgent">{mine.title}</p>
              {mine.raisedByName && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Raised by {mine.raisedByName}
                  {now ? ` · ${openedAgo(mine.createdAt, now)}` : ''}
                </p>
              )}
              {mine.detail && <p className="mt-2 text-sm">{mine.detail}</p>}
              <div className="mt-3">
                <AnswerCheckIn
                  checkInId={mine.checkInId}
                  myState={mine.myState}
                  myNote={mine.myNote}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* §8: a refused read is not an empty family, and the two are different sentences. */}
      {initialCheckIns === null && (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t('safety.listFailed')}
        </p>
      )}

      <FormError message={error} />
      {notice && <p className="text-sm text-brand-affirm">{notice}</p>}

      {/* ── 2. OPEN ─────────────────────────────────────────────────────────────────── */}
      {initialCheckIns !== null && (
        <section className="space-y-3" aria-labelledby="open-check-ins">
          <h2 id="open-check-ins" className="text-sm font-semibold tracking-wide text-brand-ink uppercase">
            {t('safety.open')}
          </h2>
          {open.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t('safety.nothingOpen')}
            </p>
          ) : (
            open.map(row => (
              <CheckInCard
                key={row.id}
                row={row}
                now={now}
                rights={rights}
                expanded={expanded === row.id}
                detail={expanded === row.id ? detail : null}
                busy={pending || sendingFor === row.id}
                sending={sendingFor === row.id}
                zone={zone}
                onToggle={() => loadDetail(row.id)}
                onAskRest={() => void drive(row.id)}
                onRetry={() => act(() => retryCheckInAsks(row.id))}
                onClose={() => act(() => closeCheckIn(row.id))}
                onDelete={() => remove(row)}
              />
            ))
          )}
        </section>
      )}

      {/* ── 3. PAST ─────────────────────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <section className="space-y-3" aria-labelledby="past-check-ins">
          <h2 id="past-check-ins" className="text-sm font-semibold tracking-wide text-brand-ink uppercase">
            {t('safety.closed')}
          </h2>
          {past.map(row => (
            <CheckInCard
              key={row.id}
              row={row}
              now={now}
              rights={rights}
              expanded={expanded === row.id}
              detail={expanded === row.id ? detail : null}
              busy={pending}
              sending={false}
              zone={zone}
              onToggle={() => loadDetail(row.id)}
              onDelete={() => remove(row)}
            />
          ))}
        </section>
      )}

      {rights.raise && (
        <RaiseCheckInDialog
          open={raiseOpen}
          onClose={() => setRaiseOpen(false)}
          audiences={audiences}
          people={people}
          onRaised={id => { router.refresh(); void drive(id) }}
        />
      )}

    </div>
  )
}

/** One check-in, with its counts and — where the caller may read it — its roster. */
function CheckInCard({
  row, now, rights, expanded, detail, busy, sending, zone,
  onToggle, onAskRest, onRetry, onClose, onDelete,
}: {
  row: CheckInSummary
  now: Date | null
  /** The reader's timezone — a roster row's `responded_at` is an instant. */
  zone: string
  rights: CheckInRights
  expanded: boolean
  detail: CheckInDetail | null
  busy: boolean
  sending: boolean
  onToggle: () => void
  onAskRest?: () => void
  onRetry?: () => void
  onClose?: () => void
  onDelete: () => void
}) {
  const t = useT()
  // RENAMED FROM `t` in Phase 5: that name now belongs to the translator in every
  // component in the product, and a local shadowing it here made `t('…')` unreachable.
  const tally = row.tally
  // THE TONE COMES FROM `checkInProgress`, which is the pure module's decision and not this
  // component's. `urgent` outranks everything including a queue still running — somebody needing
  // help is the thing this screen leads with.
  const toneClass = {
    urgent: 'border-brand-urgent bg-brand-urgent/10',
    withheld: 'border-brand-withheld/40',
    affirm: 'border-brand-affirm/40',
    plain: '',
  }[row.progress.tone]

  return (
    <div className={cn('rounded-xl border p-4', toneClass)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{row.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {row.scope === 'family' ? t('safety.everyone')
              : row.scope === 'named' ? t('safety.handPicked')
                : row.areaName ?? t('safety.oneArea')}
            {row.raisedByName
              ? ` · ${t('safety.raisedBy', { name: row.raisedByName })}`
              : ''}
            {now ? ` · ${openedAgo(row.createdAt, now)}` : ''}
          </p>
          {row.detail && <p className="mt-2 text-sm">{row.detail}</p>}
        </div>
        <p
          className={cn(
            'shrink-0 text-sm font-medium',
            row.progress.tone === 'urgent' ? 'text-brand-urgent'
              : row.progress.tone === 'withheld' ? 'text-brand-withheld'
                : row.progress.tone === 'affirm' ? 'text-brand-affirm'
                  : 'text-muted-foreground',
          )}
        >
          {sending ? t('safety.asking') : row.progress.label}
        </p>
      </div>

      {/*
        THE FOUR NUMBERS, and `rosterVisible` decides whether they are shown at all rather than
        shown as zeroes. §5 and §8 together: a caller at scope 'own' gets no roster read, so their
        counts would all be zero — and "0 safe, 0 waiting" over a live check-in is a WRONG figure
        rather than a withheld one, which is the argument the four activity reports make.
      */}
      {row.rosterVisible ? (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Figure label={t('safety.safe')} value={tally.safe} className="text-brand-affirm" />
          <Figure label={t('safety.needHelp')} value={tally.needsHelp} className="text-brand-urgent" />
          <Figure label={t('safety.waiting')} value={tally.awaiting} className="text-muted-foreground" />
          {tally.undelivered > 0 && (
            <Figure label={t('safety.notReached')} value={tally.undelivered} className="text-brand-withheld" />
          )}
          {row.notAddressed > 0 && (
            <Figure
              label={t('safety.notAddressed')}
              value={row.notAddressed}
              className="text-muted-foreground"
            />
          )}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('safety.notShownToYou')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.rosterVisible && (
          <Button variant="outline" size="sm" onClick={onToggle} disabled={busy}>
            {expanded ? t('safety.hideRoster') : t('safety.seeRoster')}
          </Button>
        )}
        {row.status === 'open' && rights.raise && tally.queued > 0 && onAskRest && (
          <Button variant="outline" size="sm" onClick={onAskRest} disabled={busy}>
            {sending
              ? t('safety.asking')
              : t('safety.askRemaining', { n: String(tally.queued) })}
          </Button>
        )}
        {/*
          "Try again" IS OFFERED ONLY WHERE A DELIVERY ACTUALLY FAILED — not for `skipped`. A
          relative with no mailbox needs a phone call, and offering a retry would tell somebody a
          machine was going to handle it. `retryCheckInAsks` refuses to touch those rows for the
          same reason; this is the UI half of the same rule.
        */}
        {row.status === 'open' && rights.raise && tally.undelivered > tally.unreachable && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={busy}>
            {t('safety.retryFailed')}
          </Button>
        )}
        {row.status === 'open' && rights.raise && onClose && (
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {t('safety.close')}
          </Button>
        )}
        {rights.remove && (
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={busy}
            className="text-destructive">
            {t('action.delete')}
          </Button>
        )}
      </div>

      {tally.unreachable > 0 && row.rosterVisible && (
        // THE SENTENCE THIS WHOLE FEATURE IS BUILT AROUND. Somebody has to be told, in words,
        // that a machine cannot reach these relatives — otherwise they sit in a column nobody
        // works through and "everybody is safe" gets read over them.
        <p className="mt-3 text-sm text-brand-withheld">
          {tally.unreachable === 1
            ? t('safety.unreachableOne')
            : t('safety.unreachableMany', { n: String(tally.unreachable) })}
        </p>
      )}

      {expanded && (
        <div className="mt-4">
          {detail
            ? <CheckInRoster zone={zone} rows={detail.roster} />
            : <p className="text-sm text-muted-foreground">{t('safety.loadingRoster')}</p>}
        </div>
      )}
    </div>
  )
}

function Figure({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', className)}>{value}</dd>
    </div>
  )
}
