import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, Clock, MapPin, Settings2, Star } from 'lucide-react'
import { can, requireView } from '@/lib/auth/permissions'
import { familyPlansGatherings } from '@/lib/auth/tier'
import { getGatheringDetail } from '@/app/actions/gatherings'
import { formatWhen, formatWhenBrief } from '@/lib/gathering-when'
import { resolveZone } from '@/lib/auth/zone'
import { StatedTime } from '@/components/ui/stated-time'
import { PageShell } from '@/components/layout/PageShell'
import { BudgetBand } from '@/components/gatherings/BudgetBand'
import { GatheringStatusPill } from '@/components/gatherings/StatusPill'
import { GATHERING_PREMIER_PILL } from '@/components/gatherings/status'
import { GatheringDetailClient } from '@/components/gatherings/GatheringDetailClient'
import { PlanningUpsell } from '@/components/gatherings/PlanningUpsell'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'
import { moneyFor } from '@/lib/currency-utils'
import { getMyFamilyCurrency } from '@/lib/auth/currency'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./gatherings/[id].title')
}

/**
 * One gathering: what it is, when and where, what it costs, and every job in it.
 *
 * ── WIDE, NOT `reading`, AND THAT IS A CORRECTION ───────────────────────────────────
 * The test AGENTS.md sets is not "does this page contain sentences" but whether the CONTENT is
 * one column read start to finish. This is a task table, a four-figure budget band and a set of
 * status pills — the same kind of screen as Members & Access. `reading` is for an event
 * description or a ballot, which is why `/events/[id]` has it and this does not.
 *
 * ── THE MONEY GRANT IS RESOLVED IN THE ACTION, NOT HERE ─────────────────────────────
 * `requireView(user.id, 'gatherings')` is this page's own gate, per AGENTS.md §1, and the
 * resource key is the route without its leading slash — `/gatherings/[id]` inherits
 * `gatherings` rather than owning a key of its own.
 *
 * `gatherings/budget:view` is `getGatheringDetail`'s, deliberately: it resolves that key BEFORE
 * selecting any money and returns `budget: null` when it is not held, so the figures are a
 * query that did not run rather than a prop the component declines to render (AGENTS.md §5).
 * Re-resolving it here would be a second answer to a question already answered, and the two
 * could disagree — `canAny` and `can` differ on scope `'own'`, and `gatherings/budget` is
 * `canAny` for the reason a disbursement is.
 *
 * ── THE ORGANIZER LINK'S GRANT IS THE DESTINATION'S, AND IT IS RESOLVED HERE ─────────
 * `GatheringDetail.canManage` is `admin/gatherings:EDIT`, which is the right answer to "is
 * there anything for them to do over there" and the wrong one to "can they get in":
 * `/admin/gatherings/[id]` gates on `requireView(user.id, 'admin/gatherings')`, i.e. `view`.
 * The four actions are independent switches per resource on Members & Access and
 * `template_permissions` materializes each separately, so edit-without-view is two clicks away
 * — and that member would be offered a link straight to a 404. So the link needs BOTH, and the
 * `view` half is resolved on this page because that is the grant its destination checks.
 * `/gatherings` sets the same standard for its own one-sentence link to the template library.
 *
 * ── `notFound()` COVERS THREE CASES AND DELIBERATELY DOES NOT DISTINGUISH THEM ──────
 * A `null` detail means the gathering is another family's, does not exist, or the caller's read
 * was refused. Telling them which is an enumeration signal about another family's data, so all
 * three answer the 404 a restricted page answers.
 */
export default async function GatheringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) redirect('/login')
  const { intl } = await callerI18n(user.id)
  // The FAMILY's currency, bound with the reader's conventions. A page printing the
  // family's own figures uses this; GENORRA's own prices use `formatPlatformMoney`.
  // See `lib/currency-utils.ts` — the two ledgers must never meet.
  const money = moneyFor(await getMyFamilyCurrency(user.id), intl)

  await requireView(user.id, 'gatherings')

  // `can`, not `canAny`, because `requireView` on the destination resolves through `can` — a
  // link offered on any other basis is a link to a 404. Resolved beside the fetch rather than
  // after it: it reads no family data, so there is nothing here to withhold.
  const [gathering, mayOpenConsole, plansGatherings, zone] = await Promise.all([
    getGatheringDetail(id),
    can(user.id, 'admin/gatherings', 'view'),
    // THE TIER, RESOLVED HERE RATHER THAN IN THE ACTION, which is AGENTS.md's rule about
    // where a tier check belongs: where the withheld thing IS the whole answer, a check inside
    // the action turns it into a function that answers nothing to everybody, and every
    // assertion about it becomes evidence for the tier rather than for family isolation. What
    // is withheld here is not rows — a gathering already carrying tasks keeps them — it is the
    // organizing machinery and the words that describe it.
    familyPlansGatherings(user.id),
    // The READER's zone, for the secondary "your time" line. Distinct from the zone the
    // gathering's times were STATED in, which is on the row and leads the display.
    resolveZone(user.id),
  ])
  if (!gathering) notFound()

  // ── THE WHOLE ANSWER, WITH ITS TIMES ────────────────────────────────────────────
  // `formatWhen` names each occasion where there are several, because the envelope of three
  // Saturdays is a fortnight and printing that as a range claims a fortnight the family is not
  // gathering for. `formatWhenBrief` is the fallback for a failed occurrence read (§8: null
  // means the read failed, not that there are no dates) and is an approximation rather than an
  // invention.
  const dates = gathering.occurrences
    ? formatWhen({
        isContinuous: gathering.isContinuous,
        occurrences: gathering.occurrences,
        timeZone: gathering.timeZone,
      }, intl, t)
    : formatWhenBrief(gathering, intl, t)

  return (
    <PageShell className="space-y-8">
      <div>
        <Link
          href="/gatherings"
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />{t('gath.backGatherings')}</Link>

        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="mb-1 text-3xl font-bold">{gathering.title}</h1>
            {gathering.summary && (
              <p className="text-muted-foreground">{gathering.summary}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* Premier is a marker rather than a status — several gatherings may carry it, and
                the Dashboard band shows the soonest — so it sits BESIDE the status pill and
                never instead of it. The paint is `GATHERING_PREMIER_PILL`, which is where the
                Warmth-not-gold decision is argued; this was the fourth and last inline copy of
                it, and it was the one still gold. */}
            {gathering.isPremier && (
              <span className={GATHERING_PREMIER_PILL}>
                <Star className="h-3 w-3" aria-hidden="true" /> Premier
              </span>
            )}
            <GatheringStatusPill status={gathering.status} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {dates && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {dates}
            </span>
          )}
          {/* THE READER'S OWN TIME, SECOND AND SMALLER. `dates` above already carries the
              stated time with its zone named — that is the primary and authoritative reading,
              and `20260826000003` forbids inverting the two. This adds the local equivalent for
              a relative who is not in the gathering's zone, and renders NOTHING when the two
              clocks agree or when no time was given. First occurrence only: a series of five
              Saturdays all share one zone, so repeating it per row would be noise. */}
          {gathering.startTime && gathering.timeZone && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <StatedTime
                intl={intl}
                t={t}
                day={gathering.startsOn}
                time={gathering.startTime}
                endTime={gathering.endTime}
                zone={gathering.timeZone}
                readerZone={zone}
              />
            </span>
          )}
          {gathering.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {gathering.location}
            </span>
          )}
          {/* THE ORGANIZER LINK IS RENDERED ONLY FOR SOMEBODY WHO CAN OPEN THE PAGE IT POINTS
              AT AND HAS SOMETHING TO DO THERE. Both halves, and they are different grants:
              `canManage` is `admin/gatherings:edit` (resolved by the action) and
              `mayOpenConsole` is `admin/gatherings:view`, which is what that page's own
              `requireView` checks before 404ing. Offering it on `edit` alone advertised a
              console an edit-without-view template cannot reach. */}
          {gathering.canManage && mayOpenConsole && (
            <Link
              href={`/admin/gatherings/${gathering.id}`}
              className="flex items-center gap-1.5 font-medium text-brand-accent hover:underline"
            >
              {/* ── THE LABEL FOLLOWS THE PLAN, AND THE DESTINATION DOES NOT ────────
                  On Free there is nothing to ORGANIZE: no templates to attach, no tasks to
                  hand out, no budget band. The console is still where the title, the dates,
                  the place and the status are changed — `/admin/gatherings` is Free — so the
                  link stays and stops over-promising. "Organize this gathering" leading to a
                  screen with no organizing on it is the shape AGENTS.md warns about for a
                  disabled control: an affordance somebody keeps pressing. */}
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              {plansGatherings ? 'Organize this gathering' : 'Edit this gathering'}
            </Link>
          )}
        </div>
      </div>

      {/* `budgetState` decides which of the two nulls this is, and the band does two different
          things with them: nothing at all for `'withheld'` (a caller without
          `gatherings/budget:view` must not learn that money is attached), one honest line for
          `'unavailable'` (the caller holds the key and the read failed). Neither is the same
          thing as a gathering with no budget set, which is a `'shown'` band with a dash in it. */}
      <BudgetBand budget={gathering.budget} state={gathering.budgetState} money={money} t={t} />

      {/* ── THE TASK TABLE, OR WHAT WOULD BE IN IT ───────────────────────────────
          A Free family has no tasks and never will while they are on Free, so the table would
          render its empty state — "nothing has been handed out yet" — which is true and reads
          as a feature that has not been used rather than one that is not included. The upsell
          says which it is, and says what the gathering DOES have first.

          It replaces the table rather than sitting above it, deliberately: two panels where
          one says "no tasks" and the other says "tasks are a paid feature" is the product
          arguing with itself. */}
      {!plansGatherings ? (
        <PlanningUpsell />
      ) : (
      <GatheringDetailClient
        tasks={gathering.tasks}
        taskCounts={gathering.taskCounts}
        /* WHETHER THE TASK BUDGET COLUMN IS DRAWN AT ALL — not what withholds the money.
           `getGatheringDetail` selects `budget_cents` only when `gatherings/budget:view` is
           held, so for a caller without it every `budgetCents` is already null: the figure is a
           query that did not run (§5), decided in the action. This flag exists so the column
           and its `<th>` are ABSENT rather than rendered as a column of em-dashes, which reads
           as "nothing is budgeted" instead of "you are not being shown this". `budget !== null`
           is exactly the answer that key gave. */
        showTaskBudgets={gathering.budgetState === 'shown'}
        /* THE SEGMENTS, so each task group's heading can carry the day and the place that
           group actually happens on. `GatheringDetail.templates` is already in `position`
           order and already carries `occursOn`/`location` (20260819000001), so this is a
           pass-through and not a second read.

           The prop is optional on the component and renders nothing when absent, which is the
           right default for the reason stated there — but it made this page SILENTLY wrong
           rather than merely plain: the manual's `gatherings#the-page` says each group is
           headed by its segment's own day and place, and without this line the screen showed
           neither while every other half of the feature worked. A prop that degrades to
           nothing is a good design and a bad thing to forget. */
        segments={gathering.templates}
      />
      )}
    </PageShell>
  )
}
