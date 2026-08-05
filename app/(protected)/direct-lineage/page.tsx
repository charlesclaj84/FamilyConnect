import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyChildren, getSpouseChildren } from '@/app/actions/children'
import { DirectLineageClient } from '@/components/direct-lineage/DirectLineageClient'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Direct Lineage — Family Connect' }

export default async function DirectLineagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'direct-lineage')

  const [children, spouseChildren] = await Promise.all([getMyChildren(), getSpouseChildren()])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Children</h1>
        <p className="text-muted-foreground">
          Manage your children&apos;s information. When a child grows up, use{' '}
          <strong>Convert to Adult</strong> to update their status.
        </p>
      </div>

      <Card>
        <CardContent>
          <DirectLineageClient initialChildren={children} spouseChildren={spouseChildren} />
        </CardContent>
      </Card>
    </div>
  )
}
