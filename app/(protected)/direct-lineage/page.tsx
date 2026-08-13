import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMyChildren, getSpouseChildren } from '@/app/actions/children'
import { DirectLineageClient } from '@/components/direct-lineage/DirectLineageClient'
import { Card, CardContent } from '@/components/ui/card'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Direct Lineage' }

export default async function DirectLineagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'direct-lineage')

  const [children, spouseChildren] = await Promise.all([getMyChildren(), getSpouseChildren()])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">My Children</h1>
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
    </PageShell>
  )
}
