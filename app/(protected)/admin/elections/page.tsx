import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { getElectionsForOrganizer, getElectionScopeOptions } from '@/app/actions/elections'
import { AdminElectionsClient } from '@/components/admin/AdminElectionsClient'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./admin/elections.title')
}

/**
 * The organizer's screen. `/review/election-management` until 2026-08-21, when the route, the
 * folder and the key all moved together — AGENTS.md's route rule leaves no choice about that:
 * a screen lives at `/<rail section>/<rail caption>` and its key is that path without the
 * leading slash. So Admin > Elections is `/admin/elections`, gated on `admin/elections`.
 *
 * ONE `requireView` AND NOTHING BY HAND. This page has one key and one pane, so the standard
 * preamble is the whole gate — `requireView` folds in `requireFamilyActive` and `requireTier`,
 * which is exactly why a page with two panes has to state them itself and this one does not.
 *
 * BOTH READS ARE GATED ON THE SAME KEY, inside the actions rather than here, so the roster of
 * regions, chapters and offices is never fetched for somebody who cannot use it (§5). Reading
 * the options to build a form must not be one grant cheaper than the list they attach to.
 */
export default async function AdminElectionsPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/elections')

  const { t } = await callerI18n(user.id)

  const [elections, options] = await Promise.all([
    getElectionsForOrganizer(),
    getElectionScopeOptions(),
  ])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('page./admin/elections.title')}</h1>
      </div>
      <AdminElectionsClient
        initialElections={elections}
        regions={options.regions}
        chapters={options.chapters}
        roles={options.roles}
      />
    </PageShell>
  )
}
