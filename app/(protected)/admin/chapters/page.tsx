import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getChapters, getRegions } from '@/app/actions/admin/chapters'
import { AdminRegionsChaptersClient } from '@/components/admin/AdminRegionsChaptersClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Regions & Chapters — Admin' }

export default async function AdminChaptersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/chapters')

  const [regions, chapters] = await Promise.all([getRegions(), getChapters()])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Regions &amp; Chapters</h1>
        <p className="text-muted-foreground">
          Organize your family geographically. Chapters must belong to a region — or they live under National by default.
        </p>
      </div>
      <AdminRegionsChaptersClient initialRegions={regions} initialChapters={chapters} />
    </PageShell>
  )
}
