import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnnouncements, getChapters } from '@/app/actions/announcements'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { NewAnnouncementForm } from '@/components/announcements/NewAnnouncementForm'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'announcements')

  const admin = createAdminClient()
  const canManage = await can(user.id, 'announcements', 'edit')

  const [announcements, chapters] = await Promise.all([getAnnouncements(), getChapters()])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Announcements</h1>
        <p className="text-muted-foreground">Messages from across your family.</p>
      </div>

      <div className="mb-8">
        <NewAnnouncementForm isAdmin={canManage} chapters={chapters} />
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
