import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireView, can, canAny } from '@/lib/auth/permissions'
import {
  getAdminGatherings, getGatheringReviewQueue, getGatheringFundOptions,
} from '@/app/actions/admin/gatherings'
import { getGatheringTemplates } from '@/app/actions/admin/gathering-templates'
import { getSchedulableTemplates } from '@/app/actions/gatherings'
import { AdminGatheringsClient, type AdminGatheringPane } from '@/components/admin/AdminGatheringsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Gathering Management — Admin' }

/**
 * The two panes, as values, so `?pane=` can be validated before it is trusted.
 *
 * The TYPE is imported from the client (a type-only import, erased at build, so no client
 * module reaches this server component's graph) and `satisfies` is what makes the two
 * unable to drift: adding a pane there and not here fails the build rather than silently
 * falling back to the list.
 */
const PANES = ['gatherings', 'queue'] as const satisfies readonly AdminGatheringPane[]

/**
 * THE ORGANIZER CONSOLE — two panes over one grant.
 *
 * **Gatherings** is the list: what the family is running, when, on which fund, how much of
 * that fund it claims, and how much of the work has come back. **Review queue** is every
 * submitted task in the family waiting for a ruling, which is the half of the loop an
 * organizer would otherwise have to go looking for one gathering at a time.
 *
 * ── WHY BOTH PANES SIT UNDER ONE KEY AND ARE BOTH FETCHED ───────────────────────────
 * §5 says gate the FETCH and not the tab, and the reason both queries run here anyway is that
 * both are the same grant: `admin/gatherings:view` is what the console IS, and there is no
 * sub-key dividing the list from the queue. What the queue's own grant decides is whether the
 * Approve and Send-back controls render at all — that is `edit`, resolved below and re-checked
 * by `reviewGatheringTask`, because a member who may READ what is waiting is not necessarily
 * the person who rules on it.
 *
 * ── THE MONEY IS A SEPARATE GRANT, AND IT IS RESOLVED BEFORE ANYTHING IS ASKED FOR ──
 * `gatherings/budget:view` is a non-admin key that starts RESTRICTED. `getAdminGatherings`
 * resolves it itself and returns `budget: null` per row when it is not held — the columns are
 * never selected rather than selected and dropped, because a prop reaches the browser in the
 * RSC payload whether a component renders it or not. It is resolved a second time here for the
 * same reason, so the fund picker's balances are a fetch that did not happen:
 * `getGatheringFundOptions` gates on it too and would answer `[]`, and skipping the call keeps
 * the two answers from being able to disagree.
 *
 * ── TWO SOURCES FOR THE TEMPLATE LIST, AND WHY IT IS A UNION ────────────────────────
 * The New-gathering dialog must offer exactly what `createGathering` will accept, which is any
 * non-archived template of the family's. Neither existing read answers precisely that:
 * `getSchedulableTemplates()` gates on `gatherings:create` (and widens to `'admin'` templates
 * for a holder of `admin/gatherings:create`), while `getGatheringTemplates()` gates on the
 * library's own admin key and narrows to the caller's own drafts at scope `'own'`. Each
 * self-gates and answers `[]` otherwise, so the union is the widest set this caller is
 * demonstrably entitled to see the NAMES of — and the action re-derives the real rule anyway.
 * An organizer who holds neither read gets a dialog that says so instead of an empty picker.
 *
 * ── AND A LINK TO THE LIBRARY NEEDS THE LIBRARY'S OWN GRANT ─────────────────────────
 * Two sentences on this screen point at `/admin/gathering-templates` — the lede below, and the
 * New-gathering dialog's empty state. That page gates on `requireView(user.id,
 * 'admin/gathering-templates')` and 404s anybody without it, and "organizer, not a template
 * author" is an ordinary split for a family to make, so both are resolved from the
 * DESTINATION's key rather than from this page's. Unlinked words where the grant is missing;
 * never a link to a 404. `/gatherings` sets the same standard for the same sentence.
 */
export default async function AdminGatheringsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/gatherings')

  // Grants first, always — the order of this function is its security model, and every fetch
  // below is chosen from these answers rather than filtered afterwards.
  const [mayCreate, mayEdit, mayDelete, mayManageBudget, mayAuthorTemplates] = await Promise.all([
    canAny(user.id, 'admin/gatherings', 'create'),
    canAny(user.id, 'admin/gatherings', 'edit'),
    canAny(user.id, 'admin/gatherings', 'delete'),
    canAny(user.id, 'gatherings/budget', 'view'),
    // `can`, not `canAny`: `requireView` on the destination resolves through `can`, so scope
    // `'own'` is enough to open that page and must therefore be enough to be offered the link.
    can(user.id, 'admin/gathering-templates', 'view'),
  ])

  const [gatherings, queue, funds, libraryTemplates, schedulableTemplates] = await Promise.all([
    getAdminGatherings(),
    getGatheringReviewQueue(),
    mayManageBudget ? getGatheringFundOptions() : [],
    mayCreate ? getGatheringTemplates() : [],
    mayCreate ? getSchedulableTemplates() : [],
  ])

  // The union, keyed by id and carrying only what the picker prints. The library read comes
  // with every step of every template attached; none of that belongs in this page's payload.
  const templateOptions = new Map<string, { id: string; name: string; description: string | null }>()
  for (const t of libraryTemplates) {
    if (t.isArchived) continue   // archiving means "do not start anything new from this"
    templateOptions.set(t.id, { id: t.id, name: t.name, description: t.description })
  }
  for (const t of schedulableTemplates) {
    templateOptions.set(t.id, { id: t.id, name: t.name, description: t.description })
  }

  // Resolved on the server so the first paint already shows the right pane and the client's
  // initial state matches the server HTML exactly — which is what keeps this free of a
  // hydration mismatch. A `?pane=` value that is not one of the two falls back to the list.
  const requested = (await searchParams).pane
  const initialPane: AdminGatheringPane =
    typeof requested === 'string' && (PANES as readonly string[]).includes(requested)
      ? requested as AdminGatheringPane
      : 'gatherings'

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Gathering Management</h1>
        <p className="text-muted-foreground">
          Schedule a gathering from one or more{' '}
          {mayAuthorTemplates
            ? <Link href="/admin/gathering-templates">templates</Link>
            : 'templates'}, hand each step to a relative, and rule on what comes back. Events are
          separate and keep their own screens.
        </p>
      </div>
      <AdminGatheringsClient
        initialPane={initialPane}
        initialGatherings={gatherings}
        initialQueue={queue}
        templates={[...templateOptions.values()].sort((a, b) => a.name.localeCompare(b.name))}
        funds={funds}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
        mayDelete={mayDelete}
        mayManageBudget={mayManageBudget}
        mayAuthorTemplates={mayAuthorTemplates}
      />
    </PageShell>
  )
}
