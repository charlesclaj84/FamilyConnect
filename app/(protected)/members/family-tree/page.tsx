import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyActiveMembership } from '@/lib/auth/family'
import { requireView } from '@/lib/auth/permissions'
import {
  getAncestorRows,
  getDescendantTree,
  buildPartnerGroups,
  getFamilyMembers,
} from '@/app/actions/ancestors'
import { getPersonPartners } from '@/app/actions/spouse'
import { getMyRoles, getFamilyMemberRoles } from '@/app/actions/admin/users'
import { FamilyTreeClient } from '@/components/family-tree/FamilyTreeClient'

/**
 * The per-member lineage view — Community > Directory, at `/members/family-tree`.
 *
 * IT MOVED HERE FROM `/family-tree`, which is now the family-wide tree being rebuilt. The
 * nesting is not filing: this page has only ever shown ONE person's line, opened for
 * whoever `?view=` names and walked outwards from there, which is a drill-down from a
 * directory row rather than a destination of its own. It has no rail item for that reason —
 * the Directory is the way in, and `FamilyTreeClient` handles person-to-person from then on.
 *
 * CAPTIONED "LINEAGE", NOT "FAMILY TREE", and that is the whole reason to rename anything:
 * Community now has a rail item called Family Tree pointing at the rebuild, and two pages
 * answering to one name in one section is worse than a slightly duller word. It is one word
 * in three places if the decision goes the other way.
 *
 * THE RESOURCE KEY STAYS `family-tree`, deliberately, and does NOT become `members`:
 *
 *   * `20260806000006` removed the `permission_resources` row for it on purpose — a
 *     member's own things are unrestrictable — so this resolves to viewable for everybody,
 *     which is what it did at the old path too. Keying it to `members` instead would let a
 *     family that restricts its Directory break its own family tree, which AGENTS.md §4
 *     names as the reason `belongsToFamily` uses the service role in the first place.
 *   * Every action behind this page already checks `requireRead('family-tree')` —
 *     `ancestors.ts`, `spouse.ts` — so changing the page's key would put the page and its
 *     writes on two different grants.
 *
 * The route no longer matches the key, which is the one place this page departs from §1's
 * "the resource key is the route without its leading slash". The key still names a
 * registered feature (`/family-tree`, the rebuild), so `viewableResources()` still resolves
 * it; it is the same arrangement `/admin/approvals` has, where the path and the thing the
 * key governs stopped being the same page.
 */
export const metadata = { title: 'Lineage' }

export default async function FamilyTreePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'family-tree')

  const admin = createAdminClient()

  // Resolve the caller's person row IN THE FAMILY THEY ARE CURRENTLY VIEWING.
  // Selecting on user_id alone matches one row per membership, so .maybeSingle()
  // errors outright for anyone in more than one family — take the id from the
  // active-membership resolver and look the row up by primary key instead.
  const { familyCode, personId } = await getMyActiveMembership(user.id)

  const { data: myPerson } = personId
    ? await admin
        .from('people')
        .select('id, first_name, last_name, family_code')
        .eq('id', personId)
        .maybeSingle()
    : { data: null }

  // Validate the view param belongs to the same family
  let subjectPersonId = myPerson?.id ?? ''
  let isViewMode = false
  let viewSubjectName: string | null = null

  if (view && view !== myPerson?.id) {
    const { data: subjectPerson } = await admin
      .from('people')
      .select('id, first_name, last_name, family_code')
      .eq('id', view)
      .maybeSingle()

    // Compare against the ACTIVE family code, not myPerson's — the two agree, but
    // this way a failed person lookup cannot degrade the check to undefined.
    if (subjectPerson && familyCode && subjectPerson.family_code === familyCode) {
      subjectPersonId = subjectPerson.id
      isViewMode = true
      viewSubjectName = [subjectPerson.first_name, subjectPerson.last_name].filter(Boolean).join(' ')
    }
    // If invalid / cross-family: silently fall back to own tree
  }

  const [ancestorRows, descendants, partners, familyMembers, myRoles, memberRoles] = await Promise.all([
    getAncestorRows(subjectPersonId),
    getDescendantTree(subjectPersonId),
    getPersonPartners(subjectPersonId),
    getFamilyMembers(),
    getMyRoles(),
    getFamilyMemberRoles(),
  ])

  const partnerGroups = await buildPartnerGroups(subjectPersonId, partners, descendants)

  const displayName = isViewMode
    ? (viewSubjectName ?? 'Member')
    : [
        user.user_metadata?.first_name ?? myPerson?.first_name ?? '',
        user.user_metadata?.last_name  ?? myPerson?.last_name  ?? '',
      ].filter(Boolean).join(' ') || 'You'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Lineage</h1>
        <p className="text-muted-foreground">
          {isViewMode
            ? `Viewing ${viewSubjectName ?? 'member'}'s lineage.`
            : 'Your full lineage — as many generations as available.'}
        </p>
      </div>

      <FamilyTreeClient
        ancestorRows={ancestorRows}
        partnerGroups={partnerGroups}
        displayName={displayName}
        isViewMode={isViewMode}
        viewSubjectName={viewSubjectName}
        myPersonId={myPerson?.id ?? null}
        subjectPersonId={subjectPersonId}
        familyMembers={familyMembers}
        myRoles={isViewMode ? [] : myRoles}
        memberRoles={memberRoles}
      />
    </div>
  )
}
