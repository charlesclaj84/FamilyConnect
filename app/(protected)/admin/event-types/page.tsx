import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getEventTypes } from '@/app/actions/admin/event-types'
import { AdminEventTypesClient } from '@/components/admin/AdminEventTypesClient'
import { HelpLink } from '@/components/help/HelpLink'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Event Templates — Admin' }

export default async function AdminEventTypesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/event-types')

  const eventTypes = await getEventTypes()

  return (
    <PageShell>
      <div className="mb-8">
        {/* THE PLACED LINK IS THE WHOLE HELP AFFORDANCE ON THIS SCREEN, and that is why it
            is on the heading rather than beside one control.

            This route has no chapter of its own — it is documented inside `running-events`
            as `#templates`, which is exactly the allowance `scripts/help-check.mjs` records
            in `UNDOCUMENTED_OK` and prints on every run. No chapter means no entry in
            `HELP_ROUTE_INDEX`, which means the top bar's context icon does NOT appear here
            (it degrades to nothing rather than to a link that lands somewhere unhelpful —
            see components/help/ContextHelpLink.tsx). So without this there would be no way
            from this page into the manual at all. */}
        <h1 className="mb-1 flex items-center gap-1.5 text-3xl font-bold">
          Event Templates
          <HelpLink
            slug="running-events"
            section="templates"
            label="Help: Event templates"
          />
        </h1>
        <p className="text-muted-foreground">Define reusable event templates with custom planning checklists.</p>
      </div>
      <AdminEventTypesClient initialEventTypes={eventTypes} />
    </PageShell>
  )
}
