'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CircleSlash, Mail, RotateCcw, Send, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm'
import { FieldError, FormError } from '@/components/ui/form-message'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { cn } from '@/lib/utils'
import {
  cancelDistribution, deleteDistribution, getDistribution, getDistributions,
  requeueDistribution, sendDistribution, sendDistributionBatch,
  type AudienceOption, type DistributionDetail, type DistributionRights,
  type DistributionSummary,
} from '@/app/actions/distributions'
import type { DistributionProgress } from '@/lib/distribution-audience'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * Email distributions — compose one, watch it go out, and read what happened.
 *
 * ── THE CLIENT DRIVES THE SEND, AND THAT IS THE ARCHITECTURE RATHER THAN A SHORTCUT ─
 * There is no job runner in this product — no cron, no worker, no queue — and `sendEmail`
 * takes one recipient per call, so a hundred and forty relatives cannot be mailed inside one
 * request. `sendDistribution` writes the queue and mails nobody; this component then calls
 * `sendDistributionBatch` until nothing is pending, showing progress as it goes.
 *
 * Three properties of that are worth knowing before changing it:
 *
 *   * THE STATE IS IN THE DATABASE, NOT IN THIS COMPONENT. Closing the tab halfway leaves a
 *     half-sent distribution that says so, and "Try again" resumes it. The loop below is a
 *     driver, not the record.
 *   * THE LOOP STOPS ITSELF ON A FAILED CALL. A batch that errors is not retried in place —
 *     retrying a call that failed for a reason the client cannot see is how a rate limit turns
 *     into a hundred more requests. The screen reports it and offers Try again.
 *   * IT IS CANCELLED ON UNMOUNT. Navigating away must not leave a loop firing server actions
 *     against a page nobody is looking at, and the send resumes from the table when somebody
 *     comes back.
 *
 * ── WHAT THIS SCREEN MUST NEVER SAY ────────────────────────────────────────────────
 * "Sent" over mail that did not go. `sendEmail` fails soft by design, so honest reporting is
 * the caller's job and the per-recipient roster is what makes it possible — AGENTS.md's rule
 * for the whole email layer. Everything below follows from that: the counts are shown
 * separately rather than summed, `unreachable` is visually distinct from `failed`, and the
 * label comes from `distributionProgress()` so no copy here can disagree with the arithmetic.
 */
export function DistributionsClient({ initialDistributions, audiences, rights }: {
  /** `null` means the read was REFUSED, which is not the same as no distributions (§8). */
  initialDistributions: DistributionSummary[] | null
  audiences: AudienceOption[]
  rights: DistributionRights
}) {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()

  const [distributions, setDistributions] = useState(initialDistributions)
  const [composing, setComposing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DistributionDetail | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // WHICH SEND IS RUNNING, and the label it last reported. Held here rather than derived from
  // the rows because a batch's answer arrives before the list is refetched, and a progress
  // line that lags a round trip behind reads as a stalled send.
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendingLabel, setSendingLabel] = useState('')

  // The unmount latch. A ref rather than state: the loop reads it between awaits, and a state
  // read inside an async closure would see the value captured when the loop started.
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const refresh = useCallback(async () => {
    const next = await getDistributions()
    if (alive.current) setDistributions(next)
  }, [])

  /**
   * Send the next batch, and the next, until nothing is pending.
   *
   * The `while` is bounded by the server: each call claims at most a batch and reports whether
   * anything is still pending, so the loop ends when the queue empties. It also ends on any
   * unsuccessful call, and on unmount.
   */
  const drive = useCallback(async (id: string) => {
    setSendingId(id)
    setError('')
    // BOUNDED BY THE SERVER, not by this condition: every iteration claims at most one batch
    // and `result.sending` says whether the queue still holds anything. The two `break`s below
    // and the `alive` latch are the exits — there is no counter here on purpose, because a
    // client-side iteration cap would abandon a send partway through and report it as done.
    let more = true
    while (more) {
      const result = await sendDistributionBatch(id)
      if (!alive.current) return
      if (!result.success) {
        // REPORTED, NOT RETRIED. See the header: a blind retry of a call that failed for a
        // reason this component cannot see is how one rate limit becomes a hundred requests.
        setError(result.message ?? 'That send could not be continued.')
        break
      }
      setSendingLabel(result.progressLabel ?? '')
      more = result.sending === true
    }
    if (!alive.current) return
    setSendingId(null)
    setSendingLabel('')
    await refresh()
    // The rail's own counts and the dashboard do not read this, but the page's server data
    // does — and a member who navigates away and back must not see the pre-send list.
    router.refresh()
  }, [refresh, router])

  async function openDetail(id: string) {
    setOpenId(id)
    setDetail(null)
    const d = await getDistribution(id)
    if (alive.current) setDetail(d)
  }

  async function stop(row: DistributionSummary) {
    const ok = await confirm({
      title: `Stop sending “${row.subject}”?`,
      description:
        `${row.counts.sent} of ${row.progress.mailable} relatives have already been emailed. `
        + 'Those messages have gone and cannot be recalled. The rest will not be sent.',
      confirmLabel: 'Stop sending',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await cancelDistribution(row.id)
      if (!result.success) { setError(result.message ?? 'That could not be stopped.'); return }
      // ZERO IS SAID OUT LOUD. Pressing Stop on a send that had just finished must not report
      // "stopped" — nothing was, and the counts beside it would contradict the message.
      if (result.cancelled === 0) setError('That send had already finished, so nothing was stopped.')
      await refresh()
      router.refresh()
    })
  }

  async function retry(id: string) {
    setError('')
    const result = await requeueDistribution(id)
    if (!result.success) { setError(result.message ?? 'That could not be retried.'); return }
    if (result.requeued === 0) {
      setError('There is nothing left to retry on that distribution.')
      return
    }
    await drive(id)
  }

  async function remove(row: DistributionSummary) {
    const ok = await confirm({
      title: `Delete the record of “${row.subject}”?`,
      description:
        t('dist.emailsSentBeenSent'),
      confirmLabel: 'Delete the record',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteDistribution(row.id)
      if (!result.success) { setError(result.message ?? 'That could not be removed.'); return }
      if (openId === row.id) { setOpenId(null); setDetail(null) }
      await refresh()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-brand-ink">Distributions</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('dist.emailEveryoneFamilyOnce')}</p>
        </div>
        {rights.send && (
          <Button
            onClick={() => { setError(''); setComposing(true) }}
            className="bg-brand-affirm text-brand-on-affirm hover:bg-brand-affirm/90"
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />{t('dist.newDistribution')}</Button>
        )}
      </header>

      <FormError message={error} />

      {sendingId && (
        <div
          className="rounded-lg border bg-brand-soft px-4 py-3 text-sm text-brand-on-soft"
          // POLITE, NOT ASSERTIVE. This updates every few seconds for a minute or more, and an
          // assertive region would interrupt a screen reader on each batch.
          role="status"
          aria-live="polite"
        >
          {sendingLabel || 'Sending…'}
          <span className="ml-2 text-brand-on-soft/70">{t('dist.canLeavePageSend')}</span>
        </div>
      )}

      {distributions === null ? (
        /* §8. A REFUSED READ IS NOT AN EMPTY LOG, and the two must not render the same. */
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{t('dist.weCouldNotRead')}</p>
      ) : distributions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {rights.send
            ? 'Nothing has been sent yet. Press New distribution to write the first one.'
            : 'Nothing has been sent yet.'}
        </p>
      ) : (
        <DistributionTable
          rows={distributions}
          rights={rights}
          busy={isPending || sendingId !== null}
          onOpen={openDetail}
          onStop={stop}
          onRetry={retry}
          onRemove={remove}
        />
      )}

      {composing && (
        <ComposeDialog
          audiences={audiences}
          onClose={() => setComposing(false)}
          onSent={async (id) => { setComposing(false); await refresh(); await drive(id) }}
        />
      )}

      {openId && (
        <DetailDialog
          detail={detail}
          onClose={() => { setOpenId(null); setDetail(null) }}
        />
      )}
    </div>
  )
}

/** The brand role a progress tone maps to. One place, so no row can disagree with another. */
function toneClass(tone: DistributionProgress['tone']): string {
  switch (tone) {
    case 'affirm': return 'text-brand-affirm'
    // A CAPABILITY OR AN ACTION NOT YET COMPLETE — mail still queued, or a send stopped.
    // Never `--destructive`: nothing has gone wrong in either case.
    case 'withheld': return 'text-brand-withheld'
    // THE ONE ERROR IN THIS FEATURE. Mail that was meant to arrive did not.
    case 'destructive': return 'text-destructive'
    default: return 'text-muted-foreground'
  }
}

function DistributionTable({ rows, rights, busy, onOpen, onStop, onRetry, onRemove }: {
  rows: DistributionSummary[]
  rights: DistributionRights
  busy: boolean
  onOpen: (id: string) => void
  onStop: (row: DistributionSummary) => void
  onRetry: (id: string) => void
  onRemove: (row: DistributionSummary) => void
}) {
  const t = useT()
  return (
    /* NO `min-w-*` AND NO `overflow-x-auto`. "On a phone a table narrows. It does not scroll
     * sideways" — the columns that are not the row's subject collapse and are restated in a
     * `RowMeta` inside the first cell. */
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Subject</th>
            <th scope="col" className={cn('px-3 py-2 font-medium', COLLAPSING_CELL)}>{t('dist.sent')}</th>
            <th scope="col" className={cn('px-3 py-2 font-medium', COLLAPSING_CELL)}>{t('dist.sent2')}</th>
            <th scope="col" className="px-3 py-2 font-medium">Delivery</th>
            {/* A column with no heading to give still needs one. */}
            <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-t align-top sm:align-middle">
              <td className="px-3 py-2">
                {/* A REAL BUTTON ON THE SUBJECT, never a handler on the `<tr>`. A row that is
                  * only clickable is unreachable by keyboard and invisible to a screen reader,
                  * and the subject is the right element because its text IS the accessible
                  * name. Same reasoning as the member detail dialog. */}
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  aria-haspopup="dialog"
                  className="text-left font-medium text-brand-accent hover:underline"
                >
                  {row.subject}
                </button>
                <RowMeta>
                  <span>{row.audienceLabel}</span>
                  {row.senderName && <><MetaDot /><span>{row.senderName}</span></>}
                </RowMeta>
              </td>
              <td className={cn('px-3 py-2', COLLAPSING_CELL)}>
                {row.audienceLabel}
                <div className="text-xs text-muted-foreground">
                  {row.progress.addressed === 1
                    ? '1 relative'
                    : `${row.progress.addressed} relatives`}
                  {row.notAddressed > 0 && ` · ${row.notAddressed} not in this audience`}
                </div>
              </td>
              <td className={cn('px-3 py-2', COLLAPSING_CELL)}>
                {row.senderName ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2">
                <span className={toneClass(row.progress.tone)}>{row.progress.label}</span>
                {/* UNREACHABLE IS REPORTED SEPARATELY AND QUIETLY. It is not a failure —
                  * nobody should chase it — but it has to be visible, or the addressed count
                  * and the delivered count disagree with nothing to explain the gap. */}
                {row.counts.unreachable > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {row.counts.unreachable} with no email address on file
                  </div>
                )}
                {row.counts.duplicate > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {row.counts.duplicate} share an address with another relative
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap justify-end gap-2">
                  {/* STOP COMES FIRST WHILE ANYTHING IS PENDING. It is the control somebody
                    * needs in a hurry, and it is behind `create` rather than `delete` because
                    * whoever may start a send may stop one. */}
                  {rights.send && row.progress.sending && (
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => onStop(row)}>
                      <CircleSlash className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Stop
                    </Button>
                  )}
                  {rights.send && !row.progress.sending
                    && (row.counts.failed > 0 || row.counts.pending > 0) && (
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => onRetry(row.id)}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />{t('dist.tryAgain')}</Button>
                  )}
                  {rights.remove && !row.progress.sending && (
                    <Button size="sm" variant="ghost" disabled={busy}
                      onClick={() => onRemove(row)}
                      aria-label={`Delete the record of ${row.subject}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Write one and send it.
 *
 * ── THE AUDIENCE PICKER SHOWS ITS HEAD COUNT, AND THAT IS THE POINT OF IT ──────────
 * "Everyone in the family (141)" beside "Texas region (38)" is what lets somebody check the
 * audience against what they meant BEFORE the mail goes, which is the only moment checking is
 * any use. An unlabelled picker over a hundred and forty relatives is how a regional message
 * reaches everybody.
 *
 * THE COUNTS COME FROM THE SERVER, resolved against the same roster the send will use, so the
 * number on the control and the number that gets mailed cannot disagree.
 */
function ComposeDialog({ audiences, onClose, onSent }: {
  audiences: AudienceOption[]
  onClose: () => void
  onSent: (id: string) => Promise<void>
}) {
  const t = useT()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [choice, setChoice] = useState('family:')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [isPending, startTransition] = useTransition()

  const selected = audiences.find(a => `${a.scope}:${a.id ?? ''}` === choice) ?? audiences[0]

  function submit() {
    setError('')
    setFieldError('')
    if (!subject.trim()) { setFieldError('Give the message a subject'); return }
    if (!body.trim()) { setError('Write something to send'); return }
    if (!selected) { setError('Choose who this is going to'); return }

    startTransition(async () => {
      const result = await sendDistribution({
        subject,
        body,
        scope: selected.scope,
        areaId: selected.id,
      })
      if (!result.success || !result.distributionId) {
        setError(result.message ?? 'That could not be sent.')
        return
      }
      await onSent(result.distributionId)
    })
  }

  const mailable = selected ? selected.addressed - selected.unreachable : 0

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('dist.newDistribution')}
      description="This goes out by email straight away. There is no draft to come back to."
    >
      <div className="space-y-4 px-6 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="dist-audience" required>{t('dist.whoGoes')}</Label>
          <select
            id="dist-audience"
            value={choice}
            onChange={e => setChoice(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {audiences.map(a => (
              <option key={`${a.scope}:${a.id ?? ''}`} value={`${a.scope}:${a.id ?? ''}`}>
                {a.label} ({a.addressed})
              </option>
            ))}
          </select>
          {selected && (
            <p className="text-xs text-muted-foreground">
              {mailable === 1 ? '1 relative will be emailed' : `${mailable} relatives will be emailed`}
              {/* SAID IN ADVANCE, DELIBERATELY. The same figure discovered in the roster
                * afterwards reads as a delivery problem; said here it is a fact about the
                * family, and one somebody can go and fix. */}
              {selected.unreachable > 0
                && `. ${selected.unreachable} more are on the family tree without an email address `
                  + 'and cannot be emailed.'}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dist-subject" required>Subject</Label>
          <Input
            id="dist-subject"
            value={subject}
            maxLength={200}
            onChange={e => setSubject(e.target.value)}
            placeholder={t('dist.reunionDetails4th')}
          />
          <FieldError message={fieldError} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dist-body" required>Message</Label>
          <Textarea
            id="dist-body"
            value={body}
            rows={9}
            maxLength={20_000}
            onChange={e => setBody(e.target.value)}
            placeholder={'Leave a blank line between paragraphs.\n\nReplies come straight back to you.'}
          />
          <p className="text-xs text-muted-foreground">{t('dist.plainTextLeaveBlank')}</p>
        </div>
      </div>

      {/* THE MESSAGE SITS WITH THE BUTTONS, not with the field it is about: the body of a
        * dialog scrolls and the footer does not, so a refusal beside an input can be off-screen
        * at the moment somebody presses the button again. */}
      <FormError message={error} className="mx-6 mt-2 shrink-0" />

      <div className="flex justify-end gap-2 px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          onClick={submit}
          disabled={isPending || mailable === 0}
          className="bg-brand-affirm text-brand-on-affirm hover:bg-brand-affirm/90"
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          {isPending ? 'Preparing…' : `Send to ${mailable}`}
        </Button>
      </div>
    </Dialog>
  )
}

/**
 * How one recipient's state reads, and how loudly.
 *
 * A FUNCTION since the labels are translated — the six STATES are the contract (they are
 * `distribution_recipients.state` values) and the words are looked up. See `tiles.ts` for
 * the same conversion and the same argument.
 */
function stateCopy(t: T): Record<string, { label: string; className: string }> {
  return {
    sent: { label: 'Sent', className: 'text-brand-affirm' },
    pending: { label: t('dist.waitingSend'), className: 'text-brand-withheld' },
    sending: { label: 'Sending', className: 'text-brand-withheld' },
    // THE ONE DESTRUCTIVE STATE. Mail that was meant to arrive did not.
    failed: { label: t('dist.couldNotDelivered'), className: 'text-destructive' },
    // NOT AN ERROR. Nothing went wrong and nobody should chase it — the whole reason this state
    // exists rather than being folded into `failed`.
    unreachable: { label: t('dist.noEmailAddressFile'), className: 'text-muted-foreground' },
    duplicate: { label: t('dist.sharesAddress'), className: 'text-muted-foreground' },
    cancelled: { label: t('dist.notSentStopped'), className: 'text-brand-withheld' },
  }
}

/**
 * One distribution's message and its roster.
 *
 * THE ROSTER IS WHY THIS DIALOG EXISTS. It is where somebody finds out that four relatives
 * have no address on file and two bounced, which no aggregate can say — and which is the only
 * honest answer available from a sender that fails soft.
 */
function DetailDialog({ detail, onClose }: {
  detail: DistributionDetail | null
  onClose: () => void
}) {
  const t = useT()
  return (
    <Dialog
      open
      onClose={onClose}
      title={detail?.subject ?? 'Distribution'}
      description={detail ? `${detail.audienceLabel} · ${detail.progress.label}` : undefined}
      className="max-w-3xl"
    >
      {!detail ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">{t('dist.loading')}</p>
      ) : (
        <div className="space-y-5 px-6 pb-6">
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-brand-accent">{t('dist.whatSent')}</h3>
            {/* `whitespace-pre-line` so the paragraph breaks the author typed survive. The
              * email itself is built by `bodyParagraphs()` and escaped there; this is the
              * stored text rendered as text, never as markup. */}
            <p className="whitespace-pre-line rounded-lg border bg-muted/30 p-3 text-sm">
              {detail.body}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-medium text-brand-accent">
              <Users className="h-4 w-4" aria-hidden="true" />{t('dist.whoWent')}</h3>
            {detail.notAddressed > 0 && (
              <p className="text-xs text-muted-foreground">
                {detail.notAddressed} {detail.notAddressed === 1 ? 'relative was' : 'relatives were'}
                {' '}not in this audience.
              </p>
            )}
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Relative</th>
                    <th scope="col" className={cn('px-3 py-2 font-medium', COLLAPSING_CELL)}>
                      Email
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recipients.map(r => {
                    const copy = stateCopy(t)[r.state]
                      ?? { label: r.state, className: 'text-muted-foreground' }
                    return (
                      <tr key={r.id} className="border-t align-top sm:align-middle">
                        <td className="px-3 py-2">
                          {r.name}
                          <RowMeta><span>{r.email}</span></RowMeta>
                        </td>
                        <td className={cn('px-3 py-2', COLLAPSING_CELL)}>{r.email}</td>
                        <td className={cn('px-3 py-2', copy.className)}>{copy.label}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Dialog>
  )
}
