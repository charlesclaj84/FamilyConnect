'use client'

import { cn } from '@/lib/utils'
import { formatInstant } from '@/lib/tz'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import type { CheckInReach, CheckInResponse, RosterRow } from '@/lib/safety-check-in'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * Who was asked, and what came back.
 *
 * ── A REAL `<table>`, WITH NO `min-w` FLOOR ────────────────────────────────────────
 * AGENTS.md, "A table is a table" and "On a phone a table narrows. It does not scroll sideways".
 * Both matter more here than on any other list in the product, because **a phone is the device
 * this is read on** — FutureFeature.md says so in the build list — and the column that a
 * sideways scroll would park off-screen is the one saying whether somebody is alive.
 *
 * SO THE ROW'S SUBJECT AND ITS ANSWER NEVER COLLAPSE. Name and Answer are the two columns that
 * survive below `sm`; how the ask reached them and when they replied fold into the meta line
 * under the name. That is the test the pattern sets — keep what the table ANSWERS — applied to
 * a table whose question is "who have we heard from".
 *
 * ── THE ORDER IS THE INTERFACE, AND IT IS DECIDED ON THE SERVER ────────────────────
 * `getCheckIn` sorts needs-help first, then the people nobody could reach, then the silent, then
 * the safe — the order this list is ACTED ON. It is deliberately not re-sorted here and there is
 * no column-sort control: a screen being read under pressure should not be able to hide the
 * person who needs help behind an alphabetical sort somebody left on.
 *
 * ── FOUR STATES, FOUR TREATMENTS, AND NONE OF THEM IS `--destructive` ──────────────
 *   needs help    `--brand-urgent`   the one call to action on the screen
 *   not reached   `--brand-withheld` something has not happened yet, and it needs a PHONE CALL
 *                                    rather than a retry — the token for a thing withheld
 *   waiting       muted              asked, silent. The number this feature drives to zero
 *   safe          `--brand-affirm`   a state that has been reached
 *
 * `--destructive` appears nowhere. Nothing on this table is an error or a deletion, and AGENTS.md
 * is explicit that reporting a failure belongs to `form-message.tsx`. A relative who has not
 * answered is not a fault.
 */

/** What the row is really saying, collapsing `state` and `reach` into one bucket. */
type Bucket = 'needs_help' | 'unreached' | 'waiting' | 'safe'

function bucketOf(row: RosterRow): Bucket {
  // ORDER MATTERS AND MATCHES THE SERVER'S SORT. An answer beats a delivery problem: somebody
  // who said they need help from a phone we could not reach by email has still said it.
  if (row.state === 'needs_help') return 'needs_help'
  if (row.state === 'safe') return 'safe'
  if (row.reach === 'skipped' || row.reach === 'failed') return 'unreached'
  return 'waiting'
}

function answerLabel(t: T, bucket: Bucket): string {
  switch (bucket) {
    case 'needs_help': return t('safety.needsHelp')
    case 'unreached': return t('safety.notReached')
    case 'waiting': return t('safety.waiting')
    case 'safe': return t('safety.safe')
  }
}

const ANSWER_CLASS: Record<Bucket, string> = {
  needs_help: 'text-brand-urgent font-semibold',
  unreached: 'text-brand-withheld font-medium',
  waiting: 'text-muted-foreground',
  safe: 'text-brand-affirm font-medium',
}

/**
 * How the ask reached them, in words rather than a state name.
 *
 * `skipped` and `failed` are DIFFERENT SENTENCES and that is the whole reason the schema has two
 * columns rather than one. One is a phone call and the other is an address to check, and telling
 * somebody to "try again" on a relative who has no mailbox is how a list stops being worked
 * through.
 */
function reachText(reach: CheckInReach, state: CheckInResponse, t: T): string | null {
  switch (reach) {
    case 'skipped':  return t('safety.noEmailPhone')
    case 'failed':   return t('safety.emailFailed')
    case 'pending':  return t('safety.notAsked')
    case 'sent':     return state === 'awaiting' ? t('safety.askedByEmail') : null
    // `sending` IS A REAL COLUMN VALUE THAT `CheckInReach` DELIBERATELY DOES NOT NAME. The
    // migration explains why: it is the claim held by `claim_safety_check_in_asks()` for a few
    // seconds, and nothing outside that transaction should be reasoning about it. So it arrives
    // here as an unmodelled string, exactly as `countStates` in `lib/distribution-audience.ts`
    // lets an unrecognised state fall through rather than mis-reporting it.
    //
    // "Sending" IS THE HONEST WORD FOR IT, and this is the one branch a reader might delete as
    // unreachable — the type says it cannot happen and the database says it can.
    default:         return t('safety.sending')
  }
}

export function CheckInRoster({ rows, zone }: {
  rows: readonly RosterRow[]
  /** The reader's timezone. `responded_at` is an instant, not a wall-clock label. */
  zone: string
}) {
  const t = useT()
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('safety.nobodyOn')}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-start">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">{t('safety.relative')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('safety.answer')}</th>
            <th scope="col" className={cn('px-3 py-2 font-medium', COLLAPSING_CELL)}>
              {t('safety.howAsked')}
            </th>
            <th scope="col" className={cn('px-3 py-2 font-medium', COLLAPSING_CELL)}>
              {t('safety.answered')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const bucket = bucketOf(row)
            const reach = reachText(row.reach, row.state, t)
            const when = row.respondedAt
              // A TIME, NOT JUST A DATE, and the one place in this product where that is
              // right: everything else here is a DATE column with no time of day (AGENTS.md,
              // "DATES ARE `DATE`"), but `responded_at` is a real timestamptz and during an
              // emergency the hour is the fact somebody needs.
              //
              // Read in the READER's zone rather than the runtime's. It was
              // `toLocaleString(undefined, …)`, which takes the browser's zone in a client
              // component and UTC on the server — so during the one event where the hour is
              // load-bearing, two coordinators could read different times off the same row.
              ? formatInstant(row.respondedAt, zone)
              : null

            return (
              <tr key={row.personId} className="border-t align-top sm:align-middle">
                <td className="px-3 py-2">
                  <span className="font-medium">{row.name}</span>
                  {/*
                    THE META LINE IS WHERE THE TWO COLLAPSED COLUMNS GO, per the pattern — the
                    same cells, restated, not a second rendering of the row. The note goes here
                    too rather than in a column of its own: it is free text of unpredictable
                    length and a fifth column of it would force exactly the `min-w` floor this
                    pattern exists to remove.
                  */}
                  <RowMeta>
                    {reach && <span>{reach}</span>}
                    {reach && when && <MetaDot />}
                    {when && <span>{when}</span>}
                  </RowMeta>
                  {row.note && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      &ldquo;{row.note}&rdquo;
                    </p>
                  )}
                </td>
                <td className={cn('px-3 py-2', ANSWER_CLASS[bucket])}>
                  {answerLabel(t, bucket)}
                </td>
                <td className={cn('px-3 py-2 text-muted-foreground', COLLAPSING_CELL)}>
                  {reach ?? '—'}
                </td>
                <td className={cn('px-3 py-2 text-muted-foreground', COLLAPSING_CELL)}>
                  {when ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
