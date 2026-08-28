import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireView } from '@/lib/auth/permissions'
import { resolveZone } from '@/lib/auth/zone'
import { getMeetingDetail } from '@/app/actions/meetings'
import { MeetingDetailClient } from '@/components/meetings/MeetingDetailClient'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

export const metadata = { title: 'Meeting' }

/**
 * One meeting's minutes.
 *
 * `getMeetingDetail` returns null both for a meeting that does not exist and for one in another
 * family — the SELECT policy answers nothing either way — so this 404s on both, which is the
 * right answer: an id that resolves for one family and reports "not permitted" for another is
 * an enumeration signal.
 */
export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) redirect('/login')

  await requireView(user.id, 'library/meeting-minutes')

  const [meeting, zone] = await Promise.all([
    getMeetingDetail(id),
    // The READER's zone, for the secondary "your time" line beside the stated one.
    resolveZone(user.id),
  ])
  if (!meeting) notFound()

  return (
    <PageShell className="space-y-6">
      <Link href="/library/meeting-minutes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" />{t('lib.allMeetings')}</Link>
      <MeetingDetailClient zone={zone} meeting={meeting} />
    </PageShell>
  )
}
