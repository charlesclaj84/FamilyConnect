import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getMeetingDetail } from '@/app/actions/meetings'
import { MeetingDetailClient } from '@/components/meetings/MeetingDetailClient'
import { PageShell } from '@/components/layout/PageShell'

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'journals/meeting-minutes')

  const meeting = await getMeetingDetail(id)
  if (!meeting) notFound()

  return (
    <PageShell className="space-y-6">
      <Link href="/journals/meeting-minutes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> All meetings
      </Link>
      <MeetingDetailClient meeting={meeting} />
    </PageShell>
  )
}
