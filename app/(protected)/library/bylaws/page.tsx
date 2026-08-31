import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { getBylawRights, getBylaws } from '@/app/actions/bylaws'
import { BylawsClient } from '@/components/bylaws/BylawsClient'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./library/bylaws.title')
}

/**
 * The family's governing documents, searchable. SCAFFOLDING.
 *
 * ── WHAT "SCAFFOLDING" MEANS, SO THE NEXT READER DOES NOT ASSUME MORE ──────────────
 * The screen, the table, the index and the search are real. Text EXTRACTION from PDF and Word
 * is not built: those files upload, store and download, and a search matches them on their
 * title and summary only. Every row says which of the two it is, and `app/actions/bylaws.ts`
 * carries the whole argument — including that turning extraction on is a job that writes one
 * column and needs no migration.
 *
 * ── READ BY THE WHOLE FAMILY ───────────────────────────────────────────────────────
 * `bylaws` has one SELECT policy, family plus approval, and no write policy at all — so the
 * browser cannot write it and the actions are the boundary (§2c). `library/bylaws:view` gates
 * this screen so a family that has adopted none can switch it off; it decides no row.
 */
export default async function BylawsPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'library/bylaws')

  const [bylaws, rights] = await Promise.all([getBylaws(), getBylawRights()])

  return (
    <PageShell className="space-y-6">
      <BylawsClient initialBylaws={bylaws} rights={rights} />
    </PageShell>
  )
}
