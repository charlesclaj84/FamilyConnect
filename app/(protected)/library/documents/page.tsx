import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { getDocuments } from '@/app/actions/documents'
import { DocumentList } from '@/components/documents/DocumentList'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Documents' }

/**
 * The family's filed records.
 *
 * IT WAS `/review/documents` UNTIL 2026-08-22, and it moved to the Library rather than back to
 * Resources: a family's records sit beside the notebooks its officers keep, and the reader who
 * wants one is the reader who wants the other. `20260822000018` moved the key with the route
 * and retired the Review section, which was the last thing holding it.
 *
 * TWO GRANTS RESOLVED HERE, AND NEITHER IS THE GATE. `create` decides whether the upload
 * control is drawn and `delete` at 'any' decides whether somebody may remove a document that
 * is not theirs — an uploader may always remove their own, which the client works out from
 * `uploaded_by` and the action enforces with `requireOwn`.
 */
export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'library/documents')

  const [documents, canUpload, canDeleteAny, myPersonId] = await Promise.all([
    getDocuments(),
    canAny(user.id, 'library/documents', 'create'),
    canAny(user.id, 'library/documents', 'delete'),
    getMyPersonId(user.id),
  ])

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Documents</h1>
        <p className="text-muted-foreground">
          The family&rsquo;s records — forms, filings and signed copies, in one place that is
          not somebody&rsquo;s inbox.
        </p>
      </div>
      <DocumentList
        initialDocuments={documents}
        canUpload={canUpload}
        canDeleteAny={canDeleteAny}
        myPersonId={myPersonId || null}
      />
    </PageShell>
  )
}
