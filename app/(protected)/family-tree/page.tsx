import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyChildren } from '@/app/actions/children'
import { getMyAncestors, getFamilyMembers } from '@/app/actions/ancestors'
import { getMySpouse } from '@/app/actions/spouse'
import { getMyRoles, getFamilyMemberRoles } from '@/app/actions/admin/users'
import { FamilyTreeClient } from '@/components/family-tree/FamilyTreeClient'

export const metadata = { title: 'Family Tree — Family Connect' }

export default async function FamilyTreePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [children, ancestors, spouse, familyMembers, myRoles, memberRoles] = await Promise.all([
    getMyChildren(),
    getMyAncestors(),
    getMySpouse(),
    getFamilyMembers(),
    getMyRoles(),
    getFamilyMemberRoles(),
  ])

  const firstName   = user.user_metadata?.first_name ?? 'You'
  const lastName    = user.user_metadata?.last_name  ?? ''
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Family Tree</h1>
        <p className="text-muted-foreground">
          Your direct lineage — two generations above and as many as exist below you.
        </p>
      </div>

      <FamilyTreeClient
        ancestors={ancestors}
        children={children}
        displayName={displayName}
        spouse={spouse}
        familyMembers={familyMembers}
        myRoles={myRoles}
        memberRoles={memberRoles}
      />
    </div>
  )
}
