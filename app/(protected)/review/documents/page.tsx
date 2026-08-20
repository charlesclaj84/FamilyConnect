import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, requireView } from '@/lib/auth/permissions'
import { getDocuments } from '@/app/actions/documents'
import { DocumentList } from '@/components/documents/DocumentList'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Documents' }

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'review/documents')

  const canManage = await can(user.id, 'review/documents', 'delete')

  const documents = await getDocuments()

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Documents</h1>
        <p className="text-muted-foreground">Meeting minutes, bylaws, forms, and more.</p>
      </div>
      <DocumentList initialDocuments={documents} isAdmin={canManage} />
    </PageShell>
  )
}
