import { CheckCircle, Clock, Trophy, Users, Vote, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ELECTION_PHASE_PILL } from '@/components/elections/status'
import { ELECTION_PHASE_LABEL } from '@/lib/election-phase'
import { formatDateRange } from '@/lib/date-utils'
import type { ElectionSummary as Summary } from '@/app/actions/elections'
import type { T } from '@/lib/i18n/t'

/**
 * What a published election looks like while it is running.
 *
 * ── A SERVER COMPONENT, because nothing here is interactive ─────────────────────────
 * Four figures and a list per office. There is no control on this screen at all — the ones
 * that change an election live on `/admin/elections`, where the row and its guards are — so
 * there is nothing to hydrate and nothing to send to the browser but the numbers themselves.
 *
 * ── IT SHOWS A LIVE TALLY, AND THAT IS NOT A CHANGE TO THE SECRET BALLOT ────────────
 * `getElectionSummary`'s header has the argument: `20260821000001` put `election_votes`'
 * cross-member SELECT behind `admin/elections:view` precisely so an organizer can see the
 * votes, so the holder of that key could already read every row off PostgREST. This shows
 * them the aggregate instead of making them do it by hand.
 *
 * WHAT IS NOT HERE, and must not arrive: any list of PEOPLE against votes. `notVoted` is a
 * count, because a roster of who has not voted yet is the beginning of a roster of who voted
 * for whom — and an organizer who wants to chase people has the Directory.
 *
 * ── "WHO IS WINNING" IS SHOWN AS A LEAD, NOT AS A RESULT ───────────────────────────
 * While voting is open the figures are a snapshot and the screen says so. Nothing here
 * declares a winner: the marker on the leading candidates is `Trophy` up to `max_winners`,
 * which is the same shape the member's own results block uses, and the caption changes with
 * the phase so an organizer reading it mid-poll is not reading it as final.
 */
export function ElectionSummary({ summary, t }: {
  summary: Summary
  /** The reader's language, bound. A prop — this is a Server Component. */
  t: T
}) {
  const { election, nominations, electorate, positions } = summary
  const closed = election.phase === 'closed'
  const turnout = electorate.eligible > 0
    ? Math.round((electorate.voted / electorate.eligible) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* ── The four figures ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          icon={<Users className="h-4 w-4" />}
          label={t('esum.canVote')}
          value={String(electorate.eligible)}
          hint={t('esum.canVoteHint')}
        />
        <Figure
          icon={<Vote className="h-4 w-4" />}
          label={t('esum.haveVoted')}
          value={String(electorate.voted)}
          hint={`${turnout}% turnout`}
        />
        <Figure
          icon={<Clock className="h-4 w-4" />}
          label={t('esum.haveNot')}
          value={String(electorate.notVoted)}
          hint={t('esum.chaseFromDirectory')}
        />
        <Figure
          icon={<CheckCircle className="h-4 w-4" />}
          label={t('esum.onBallot')}
          value={`${nominations.accepted} of ${nominations.total}`}
          hint={t('esum.onBallotHint')}
        />
      </div>

      {/* ── The nomination breakdown, which the figure above compresses ───── */}
      <div className="rounded-xl border bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('elec.nominations')}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-brand-affirm" />
            {nominations.accepted} accepted
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-brand-accent" />
            {nominations.pending} waiting to be answered
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            {nominations.declined} declined
          </span>
        </div>
        {nominations.pending > 0 && (
          // SAID OUT LOUD, because it is the one thing on this screen an organizer can still
          // do something about and the figure alone does not imply it: a nomination nobody
          // answered is not on the ballot, so a candidate can be missing from the poll while
          // appearing in the nomination total.
          <p className="mt-2 text-xs text-brand-withheld">{t('adm.nominationNobodyAnsweredNot')}</p>
        )}
      </div>

      {/* ── Per office ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {closed ? t('esum.results') : t('esum.whereVotingStands')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {closed
              ? `Voting closed ${formatDateRange(election.voting_open_on, election.voting_close_on)}.`
              : 'A snapshot while the poll is open — nothing here is final until voting closes.'}
          </p>
        </div>

        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('esum.noOffices')}</p>
        ) : positions.map(pos => (
          <Card key={pos.position_id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>{pos.title}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {pos.votes_cast} vote{pos.votes_cast === 1 ? '' : 's'} cast
                  {pos.max_winners > 1 && ` · ${pos.max_winners} to be elected`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pos.candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('esum.nobodyStanding')}</p>
              ) : (
                <ul className="space-y-2">
                  {pos.candidates.map((c, i) => {
                    // THE MARKER IS "LEADING", NOT "WON", and it is only drawn on somebody who
                    // has actually been voted for. A trophy beside a zero would declare a
                    // winner of an election nobody has voted in yet.
                    const leading = c.accepted === true && c.vote_count > 0 && i < pos.max_winners
                    const share = pos.votes_cast > 0
                      ? Math.round((c.vote_count / pos.votes_cast) * 100)
                      : 0
                    return (
                      <li key={c.nominee_id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          {leading
                            ? <Trophy className="h-4 w-4 shrink-0 text-brand-accent" />
                            : c.accepted === true
                              ? <CheckCircle className="h-4 w-4 shrink-0 text-brand-affirm" />
                              : <Clock className="h-4 w-4 shrink-0 text-brand-accent" />}
                          <span className={`text-sm ${leading ? 'font-semibold' : ''}`}>
                            {c.nominee_name}
                          </span>
                          {c.accepted === null && (
                            <span className="text-xs text-brand-accent">
                              (has not accepted)
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {c.vote_count} vote{c.vote_count === 1 ? '' : 's'}
                            {pos.votes_cast > 0 && ` · ${share}%`}
                          </span>
                        </div>
                        {/* A BAR, NOT A CHART. It is one number per row and the row already
                            prints it — the bar is there so a reader can see the gap between
                            first and second without reading two figures and subtracting. */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={leading ? 'h-full bg-brand-primary' : 'h-full bg-brand-soft'}
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('esum.electionIs')} <span className={`rounded-full px-2 py-0.5 ${ELECTION_PHASE_PILL[election.phase]}`}>
          {ELECTION_PHASE_LABEL[election.phase]}
        </span>. Nothing on this screen changes it — the windows do.
      </p>
    </div>
  )
}

/**
 * One headline figure.
 *
 * `--brand-primary` on the chip with its own `on-` partner, never a foreground borrowed from
 * another pair (AGENTS.md, "Colours live in one place"). The hint is what stops each of these
 * being a number nobody can interpret: "42" under "Can vote" is only useful if the reader
 * knows who is counted.
 */
function Figure({ icon, label, value, hint }: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary text-brand-on-primary">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
