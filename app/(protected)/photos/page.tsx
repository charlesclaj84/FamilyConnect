import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { PhotosClient } from '@/components/photos/PhotosClient'

export const metadata = { title: 'Photos — Family Connect' }

/**
 * Server shell so the page can carry the view gate. The gallery itself is
 * interactive and lives in PhotosClient — a client component cannot call
 * requireView(), which is why the split exists.
 */
export default async function PhotosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'photos')

  return <PhotosClient />
}
