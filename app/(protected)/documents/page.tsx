import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDocuments } from '@/app/actions/documents'
import { DocumentList } from '@/components/documents/DocumentList'

export const metadata = { title: 'Documents — Family Connect' }

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'documents')

  const admin = createAdminClient()
  const canManage = await can(user.id, 'documents', 'delete')

  const documents = await getDocuments()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Documents</h1>
        <p className="text-muted-foreground">Meeting minutes, bylaws, forms, and more.</p>
      </div>
      <DocumentList initialDocuments={documents} isAdmin={canManage} />
    </div>
  )
}
