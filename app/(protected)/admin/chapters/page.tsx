import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getChapters, getRegions } from '@/app/actions/admin/chapters'
import { AdminRegionsChaptersClient } from '@/components/admin/AdminRegionsChaptersClient'

export const metadata = { title: 'Regions & Chapters — Admin' }

export default async function AdminChaptersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const [regions, chapters] = await Promise.all([getRegions(), getChapters()])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Regions & Chapters</h1>
        <p className="text-muted-foreground">
          Organize your family geographically. Chapters must belong to a region — or they live under National by default.
        </p>
      </div>
      <AdminRegionsChaptersClient initialRegions={regions} initialChapters={chapters} />
    </div>
  )
}
