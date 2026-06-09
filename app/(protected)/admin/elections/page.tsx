import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllElections } from '@/app/actions/elections'
import { AdminElectionsClient } from '@/components/admin/AdminElectionsClient'

export const metadata = { title: 'Elections — Admin' }

export default async function AdminElectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: person } = await admin.from('people').select('is_admin').eq('user_id', user.id).maybeSingle()
  if (!person?.is_admin) redirect('/dashboard')

  const elections = await getAllElections()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Elections</h1>
        <p className="text-muted-foreground">Create and manage family officer elections.</p>
      </div>
      <AdminElectionsClient initialElections={elections} />
    </div>
  )
}
