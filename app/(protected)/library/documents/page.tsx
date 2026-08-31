import { redirect } from 'next/navigation'
import { canAny, requireView } from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { resolveZone } from '@/lib/auth/zone'
import { getDocuments } from '@/app/actions/documents'
import { DocumentList } from '@/components/documents/DocumentList'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./library/documents.title')
}

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
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'library/documents')

  const { t } = await callerI18n(user.id)

  const [documents, canUpload, canDeleteAny, myPersonId, zone] = await Promise.all([
    getDocuments(),
    canAny(user.id, 'library/documents', 'create'),
    canAny(user.id, 'library/documents', 'delete'),
    getMyPersonId(user.id),
    resolveZone(user.id),
  ])

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page./library/documents.title')}</h1>
      </div>
      <DocumentList
        initialDocuments={documents}
        canUpload={canUpload}
        canDeleteAny={canDeleteAny}
        myPersonId={myPersonId || null}
        zone={zone}
      />
    </PageShell>
  )
}
