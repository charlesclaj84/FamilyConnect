import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getUpdatesArchive } from '@/app/actions/updates'
import { UpdatesArchiveClient } from '@/components/updates/UpdatesArchiveClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Updates' }

/**
 * BOTH PARAMS ARE `string | string[]`, because Next hands back an array for a repeated key
 * and `/updates?q=a&q=b` is a URL anybody can send. `q` typed as `string` was a crash —
 * `sanitizeUpdatesQuery` calls `.trim()` — while `pages` survived by luck, `Number([...])`
 * being NaN. Both are resolved to the FIRST value below, which is what every other page in
 * the tree that reads a free-text param does.
 */
type Props = { searchParams: Promise<{ q?: string | string[]; pages?: string | string[] }> }

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

/**
 * The archive behind the dashboard's Recent Updates card: announcements and the caller's own
 * notifications, in date order, searchable.
 *
 * ── §1, IN ONE CALL ─────────────────────────────────────────────────────────────────
 * `requireView` and not a union of `can()` calls. The union shape is for a page whose panes
 * are separately granted, and it costs the removed-family and tier gates by hand; this page
 * has one key. The announcement HALF is gated separately inside `getUpdatesArchive`, which is
 * a different thing from a second key on the page: a caller with no `announcements:view` still
 * has an archive — of their own notifications — and is told the board is not in it.
 *
 * ── STATE LIVES IN THE URL ──────────────────────────────────────────────────────────
 * `?q=` and `?pages=`, resolved on the SERVER so first paint is the answer rather than an
 * empty list that fills in. Three things follow that are worth having: a search is a link
 * somebody can send, the back button walks back through searches, and "Show older" is a
 * navigation rather than a growing pile of client state that a family switch would strand.
 *
 * Neither value is trusted. `clampPages` bounds the depth (a `?pages=999` in the URL would
 * otherwise ask each source for 25,000 rows and be silently truncated at PostgREST's
 * `max_rows`), and `sanitizeUpdatesQuery` is what makes the query safe to put in a filter.
 * Both live in `lib/updates-archive.ts` and are tested; the action calls them itself, because
 * it is a public endpoint whatever this page passes.
 */
export default async function UpdatesPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'updates')

  const params = await searchParams
  const archive = await getUpdatesArchive({
    q: first(params.q),
    // `Number(undefined)` is NaN, which `clampPages` reads as page 1. Deliberately not
    // defaulted here: one place decides what an unparseable page means.
    pages: Number(first(params.pages)),
  })

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Updates</h1>
        <p className="text-muted-foreground">
          Everything the family has announced and everything that has been sent to you, newest
          first.
        </p>
      </div>
      <UpdatesArchiveClient archive={archive} />
    </PageShell>
  )
}
