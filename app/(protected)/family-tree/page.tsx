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

export const metadata = { title: 'Family Tree — Family Connect' }

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
    getAncestorRows(subjectPersonId, myPerson?.id ?? ''),
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
        <h1 className="text-3xl font-bold mb-1">Family Tree</h1>
        <p className="text-muted-foreground">
          {isViewMode
            ? `Viewing ${viewSubjectName ?? 'member'}'s family tree.`
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
