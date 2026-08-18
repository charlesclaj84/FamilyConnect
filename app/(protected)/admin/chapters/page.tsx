import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView, canAny } from '@/lib/auth/permissions'
import { getChapters, getRegions, getScopeUsage } from '@/app/actions/admin/chapters'
import { AdminRegionsChaptersClient } from '@/components/admin/AdminRegionsChaptersClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Regions & Chapters — Admin' }

/**
 * Regions & Chapters — how a large family divides itself up.
 *
 * ── WHAT NATIONAL IS ────────────────────────────────────────────────────────────────
 * The absence of a region, not a row. `regions` has never held one, `createRegion` refuses
 * the name as reserved, and a chapter with `region_id IS NULL` is under National. That is
 * why National exists on every plan and needs no seeding, and why nobody can delete it.
 *
 * ── THE THREE GRANTS ARE RESOLVED HERE AND THE FETCHES FOLLOW THEM ─────────────────
 * `requireView` says only that the caller may open the page. Creating, moving and deleting
 * are three more grants on the same key, and they are `canAny` rather than `can`: a region
 * is family-wide configuration with nobody to own it, which is why `admin/chapters` is on
 * `NO_OWNER_KEYS` and why every write action uses `requireScope`.
 *
 * `getScopeUsage()` is fetched rather than hidden because it is what the page needs to SAY
 * something — "14 members, 1 dues schedule" is the reason a Delete button is disabled, and a
 * disabled control with no reason beside it reads as a bug.
 */
export default async function AdminChaptersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/chapters')

  const [mayCreate, mayEdit, mayDelete] = await Promise.all([
    canAny(user.id, 'admin/chapters', 'create'),
    canAny(user.id, 'admin/chapters', 'edit'),
    canAny(user.id, 'admin/chapters', 'delete'),
  ])

  const [regions, chapters, usage] = await Promise.all([
    getRegions(),
    getChapters(),
    getScopeUsage(),
  ])

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Regions &amp; Chapters</h1>
        <p className="text-muted-foreground">
          Organize your family geographically. A chapter belongs to one region, or it sits
          under National — which is where everything starts and where a member with no
          chapter stays. Dues can be scoped to a region or a chapter under{' '}
          <a href="/admin/account?section=dues">Accounting</a>.
        </p>
      </div>
      <AdminRegionsChaptersClient
        initialRegions={regions}
        initialChapters={chapters}
        usage={usage}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
        mayDelete={mayDelete}
      />
    </PageShell>
  )
}
