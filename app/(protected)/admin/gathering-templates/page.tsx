import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView, can, canAny } from '@/lib/auth/permissions'
import { getGatheringTemplates } from '@/app/actions/admin/gathering-templates'
import { AdminGatheringTemplatesClient } from '@/components/admin/AdminGatheringTemplatesClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Gathering Templates — Admin' }

/**
 * THE TEMPLATE LIBRARY — the thing a gathering is built FROM.
 *
 * A template is a named, ordered list of steps of mixed kinds ("Book the hall" — a short
 * answer; "Head count" — a number; "Catering" — an amount of money). Scheduling a gathering
 * from one COPIES every step into `gathering_tasks`, and that copy is the whole reason this
 * screen is safe to keep editing: `label`, `help_text`, `kind` and `required` are duplicated
 * onto the task at instantiation and never read back through `step_id`, so renaming a step
 * here cannot rewrite what a relative was already asked or what they already answered. The
 * next gathering scheduled from the template gets the new wording; the reunion already
 * running does not change under anybody's feet.
 *
 * ── WHY THIS IS AN ADMIN KEY AND NOT PART OF `gatherings` ───────────────────────────
 * A template is family CONFIGURATION, the same class of thing as a dues schedule — which is
 * why `gathering_templates` and `gathering_template_steps` key their RLS policy on
 * `admin/gathering-templates` rather than on the member-facing `gatherings`. Members never
 * read the library; they read the TASKS instantiated from it. That is also why the key's
 * category is `'admin'`: since `20260817000004` an `admin/` key's `view` fails CLOSED for a
 * family with no `resource_visibility` row, and the Administrators grant is what opens it.
 *
 * ── THE THREE GRANTS ARE RESOLVED HERE, BEFORE ANYTHING IS FETCHED ─────────────────
 * `requireView` says only that the caller may open the page. Adding a template, editing one
 * and deleting one are three more grants on the same key, and all three are `canAny`: a
 * template's `who_may_schedule` decides whether an ordinary member may commit the family to
 * a whole gathering, and a step's suggested budget decides what money gets proposed. Neither
 * is something somebody's authorship of a draft should authorize. Every action re-checks —
 * withholding a control is so nobody is offered a button that answers "Not authorized", not
 * the protection itself (AGENTS.md §2).
 *
 * `getGatheringTemplates()` applies the `'own'` narrowing itself, in the action, because it
 * reads on the service role where no policy is underneath it. Nothing about a template this
 * caller may not see reaches the payload (§5).
 *
 * ── A FOURTH GRANT, FOR ONE WORD IN THE LEDE ────────────────────────────────────────
 * The sentence below points at `/admin/gatherings`, which gates on its OWN key and 404s a
 * caller without `view` on it. A template author who does not run the gatherings themselves is
 * an ordinary split, so the grant is resolved from the destination's key rather than assumed
 * from this one — `can`, because that is what `requireView` over there resolves through. Where
 * it is missing the words stay, unlinked; never a link to a 404. `/admin/gatherings` resolves
 * the mirror-image grant for the mirror-image sentence.
 */
export default async function AdminGatheringTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/gathering-templates')

  const [mayCreate, mayEdit, mayDelete, mayManageGatherings] = await Promise.all([
    canAny(user.id, 'admin/gathering-templates', 'create'),
    canAny(user.id, 'admin/gathering-templates', 'edit'),
    canAny(user.id, 'admin/gathering-templates', 'delete'),
    can(user.id, 'admin/gatherings', 'view'),
  ])

  const templates = await getGatheringTemplates()

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Gathering Templates</h1>
        <p className="text-muted-foreground">
          A template is the checklist a gathering is built from — one step per thing somebody
          has to do or decide. Schedule a gathering from it under{' '}
          {mayManageGatherings
            ? <Link href="/admin/gatherings">Gathering Management</Link>
            : 'Gathering Management'} and every step becomes a task you can hand to a relative.
          Editing a template never changes a gathering already built from it.
        </p>
      </div>
      <AdminGatheringTemplatesClient
        initialTemplates={templates}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
        mayDelete={mayDelete}
      />
    </PageShell>
  )
}
