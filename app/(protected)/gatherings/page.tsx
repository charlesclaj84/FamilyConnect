import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, canAny, requireView } from '@/lib/auth/permissions'
import { getGatherings, getSchedulableTemplates } from '@/app/actions/gatherings'
import { gatheringTiming } from '@/lib/gatherings'
import { todayLocal } from '@/lib/date-utils'
import { PageShell } from '@/components/layout/PageShell'
import { GatheringsClient, type GatheringRow } from '@/components/gatherings/GatheringsClient'

export const metadata = { title: 'Gatherings' }

/**
 * Every gathering the caller may see, split into what is coming and what has been.
 *
 * ── THE ORDER OF THIS FUNCTION IS ITS SECURITY MODEL ────────────────────────────────
 * `requireView` first, then the GRANTS, then the fetches — and the second `Promise.all`
 * passes `Promise.resolve([])` in place of any query the caller is not entitled to run.
 * `getSchedulableTemplates` reads the template library on the ADMIN client (a template keys on
 * `admin/gathering-templates:view`, which a member holding only `gatherings:create` will not
 * have), so calling it for somebody who cannot schedule would publish the family's template
 * names into the RSC payload of a screen with no Schedule button on it. Props are serialized
 * whether a component renders them or not — AGENTS.md §5, and the reason this is two passes
 * rather than one.
 *
 * ── `canAny`, NOT `can`, FOR `gatherings:create` ────────────────────────────────────
 * Because that is exactly what `scheduleGathering` and `getSchedulableTemplates` demand:
 * `requireScope(resource, action)` resolves through `canAny`, so scope `'own'` does not
 * authorize a create. Resolving it any other way here would offer a dialog whose action then
 * answers "Not authorized" — the failure "gate the fetch, not the button" exists to prevent,
 * running in the other direction.
 *
 * ── THE CLOCK IS READ HERE, AND ONLY HERE ───────────────────────────────────────────
 * `getGatherings` deliberately does NOT split its own list: `gatheringTiming` takes `today` as
 * a parameter for the reason every date helper in this codebase does, and an action that split
 * the list would bake one server's idea of today into a cached payload. So the split happens in
 * the page — a server component, where reading the clock is neither a hydration risk nor a
 * `react-hooks/purity` violation. Doing it inside `GatheringsClient` instead would run
 * `todayLocal()` once during SSR and again in the browser, and a family spread across
 * timezones would hydrate one gathering into the wrong half.
 */
export default async function GatheringsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'gatherings')

  const [mayCreate, mayAuthorTemplates] = await Promise.all([
    canAny(user.id, 'gatherings', 'create'),
    // Only to decide whether the "no templates yet" sentence may LINK to the library. `can`,
    // not `canAny`, because `requireView` on that page resolves through `can` — a link offered
    // on any other basis is a link to a 404.
    can(user.id, 'admin/gathering-templates', 'view'),
  ])

  const [gatherings, templates] = await Promise.all([
    getGatherings(),
    mayCreate ? getSchedulableTemplates() : Promise.resolve([]),
  ])

  const today = todayLocal()
  const rows: GatheringRow[] = gatherings.map(gathering => ({
    ...gathering,
    // `'today'` is every day of a multi-day span, not only the first — the second day of a
    // three-day reunion is not "past", which is the whole reason `ends_on` exists.
    happeningNow: gatheringTiming(gathering.startsOn, gathering.endsOn, today) === 'today',
  }))
  const upcoming = rows.filter(r => gatheringTiming(r.startsOn, r.endsOn, today) !== 'past')
  // Newest first: a past list read soonest-first puts the family's oldest reunion at the top
  // and the one they just held at the bottom, which is the wrong end of a list nobody scrolls.
  const past = rows
    .filter(r => gatheringTiming(r.startsOn, r.endsOn, today) === 'past')
    .reverse()

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Gatherings</h1>
        <p className="text-muted-foreground">
          Everything the family is planning together, built from a template so nothing is
          forgotten and every job has a name against it.
        </p>
      </div>

      <GatheringsClient
        upcoming={upcoming}
        past={past}
        mayCreate={mayCreate}
        templates={templates}
        mayAuthorTemplates={mayAuthorTemplates}
      />
    </PageShell>
  )
}
