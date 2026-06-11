import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnnouncements } from '@/app/actions/announcements'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { NewAnnouncementForm } from '@/components/announcements/NewAnnouncementForm'

export const metadata = { title: 'Announcements — Family Connect' }

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: myPerson } = await admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle()

  const announcements = await getAnnouncements()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Announcements</h1>
          <p className="text-muted-foreground">Messages from across your family.</p>
        </div>
        <NewAnnouncementForm isAdmin={myPerson?.is_admin === true} />
      </div>
      {announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => <AnnouncementCard key={a.id} announcement={a} />)}
        </div>
      )}
    </div>
  )
}
