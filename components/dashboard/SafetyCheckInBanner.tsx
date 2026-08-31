import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { getMyOpenCheckIns } from '@/app/actions/safety-check-ins'
import { AnswerCheckIn } from '@/components/safety/AnswerCheckIn'
import type { T } from '@/lib/i18n/t'

/**
 * "Are you safe?", across the top of the Dashboard, answerable without leaving it.
 *
 * ── THIS IS THE SURFACE THAT CANNOT BE SWITCHED OFF, AND THAT IS THE POINT ─────────
 * `/dashboard` has no `permission_resources` row — `20260806000006` removed the rows for the
 * screens that are a member's own, and AGENTS.md is explicit that the landing screen must not
 * become restrictable. So this banner reaches every approved member of the family regardless of
 * what has been done to `community/safety-check-ins:view`.
 *
 * That redundancy is deliberate and the migration's §10 argues it: the General template holds
 * `view` at `'own'` so a member can open the screen and answer, but a family COULD set even that
 * to `'none'` — and a family accidentally making its own emergency check-in unanswerable, from a
 * switch whose label says nothing about answering, is the one failure mode this feature cannot
 * tolerate. The policies' `self_expr` is what makes it work: it admits an addressed relative's
 * own row at EVERY scope, including none.
 *
 * ── IT IS THE FIRST THING ON THE SCREEN, OR IT IS NOTHING ──────────────────────────
 * Rendered above every other tile. A safety ask below the dues card is a safety ask nobody sees,
 * and the whole argument for putting it here rather than only on `/community/safety-check-ins` is
 * that somebody in a hurry lands on the Dashboard.
 *
 * ── IT RENDERS `null` WHEN THERE IS NOTHING TO ASK, AND COSTS ONE QUERY ────────────
 * A Server Component, so the check happens during the page's own render and there is no client
 * round trip. `getMyOpenCheckIns` reads on the USER client through the policies' `self_expr`, so
 * for a member on no open check-in it is one filtered read that returns nothing.
 *
 * IT DOES NOT POLL, and that is a decision rather than an omission. `ShellWatcher` exists for the
 * one thing in this product that genuinely changes mid-session (a membership being approved) and
 * its own header explains why polling for everybody is a round trip per tab per interval. A
 * check-in raised while somebody is sitting on the Dashboard reaches them through the bell, which
 * IS realtime — `notifications` is in the `supabase_realtime` publication (`20260821000002`) —
 * and on the next navigation. Adding a second poller here would be the thing that header argues
 * against, for an event that happens about once in a family's lifetime.
 */
export async function SafetyCheckInBanner({ t }: {
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
}) {
  const mine = await getMyOpenCheckIns()
  if (mine.length === 0) return null

  return (
    <section
      // `--brand-urgent`, the role added for exactly this — see `app/globals.css`. NOT
      // `--destructive`: nothing has failed and nothing is being deleted. NOT `--brand-withheld`:
      // no capability is going away. FutureFeature.md §5 ruled out all three and asked for this
      // one by name.
      className="rounded-xl border border-brand-urgent bg-brand-urgent/10 p-4 sm:p-5"
      aria-labelledby="safety-check-in-banner"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-urgent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="safety-check-in-banner" className="font-semibold text-brand-urgent">
            {mine.length === 1
              ? t('dash.safety.title')
              : t('dash.safety.titleMany', { n: mine.length })}
          </h2>

          <div className="mt-3 space-y-4">
            {mine.map(row => (
              <div key={row.checkInId} className="space-y-2">
                <p className="text-sm font-medium">{row.title}</p>
                {row.raisedByName && (
                  <p className="text-sm text-muted-foreground">
                    {t('dash.raisedBy', { name: row.raisedByName })}
                  </p>
                )}
                {row.detail && <p className="text-sm">{row.detail}</p>}
                {/*
                  THE SAME COMPONENT THE SCREEN USES, not a second copy. Which answers exist, what
                  each one says back and whether a note is offered are one rule, and two
                  implementations of it is how the banner and the screen come to record subtly
                  different things about the same relative.
                */}
                <AnswerCheckIn
                  checkInId={row.checkInId}
                  myState={row.myState}
                  myNote={row.myNote}
                  tone="banner"
                />
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            <Link href="/community/safety-check-ins" className="underline">
              {t('dash.safety.action')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
