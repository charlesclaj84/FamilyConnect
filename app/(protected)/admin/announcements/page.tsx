import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnnouncements, getChapters } from '@/app/actions/announcements'
import { AdminAnnouncementsClient } from '@/components/admin/AdminAnnouncementsClient'

export const metadata = { title: 'Announcements — Admin' }

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const [announcements, chapters] = await Promise.all([
    getAnnouncements(),
    getChapters(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Announcements</h1>
        <p className="text-muted-foreground">Post and manage family announcements.</p>
      </div>
      <AdminAnnouncementsClient initialAnnouncements={announcements} chapters={chapters} />
    </div>
  )
}
