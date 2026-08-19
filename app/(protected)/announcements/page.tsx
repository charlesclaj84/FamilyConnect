import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  can, canAny, requireFamilyActive, requireTier, scopeFor, type PermissionScope,
} from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { getAnnouncements, getChapters, getUpcomingBirthdays } from '@/app/actions/announcements'
import {
  AnnouncementsShell, ANNOUNCEMENT_PANES, type AnnouncementPane,
} from '@/components/announcements/AnnouncementsShell'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Announcements' }

interface Props {
  searchParams: Promise<{ pane?: string }>
}

/**
 * The family's notice board — and, since 20260819000002, whose birthday is next.
 *
 * `/admin/announcements` was a second page over the same rows with the same controls,
 * gated by a key (`admin/announcements`) that named no table and appeared in no policy.
 * Everything it did happens here, under the grant that actually governs each control:
 *
 *   announcements:create   post at all — every member, by default
 *   announcements:edit     pin family-wide, to the top of everyone's Recent Updates
 *   announcements:delete   remove one; 'own' lets an author retract their own
 *
 * THE THREE RIGHTS ARE RESOLVED HERE AND HANDED DOWN, rather than re-derived in the
 * client, so the buttons and the server actions cannot disagree about who may do what.
 * They are also only affordances: `togglePinAnnouncement` and `deleteAnnouncement` each
 * re-check independently, because a `'use server'` export is a public HTTP endpoint and
 * the page that renders the button is not in its request path.
 *
 * THE LIST IS NOT GATED PER ROW and does not need to be — `getAnnouncements()` runs on
 * the user's client, so the SELECT policy on `announcements` is what decides which rows
 * exist for this caller. What is decided here is only what may be DONE to them.
 *
 * `wide`, NOT `reading`. This was the reading measure on the argument that an announcement
 * is prose — which is true of one announcement and not of this screen. What is here is a
 * BOARD: a stack of cards, each with a chapter pill, a pin control and a delete control in
 * its corners, and the post composer above them. A narrower column bought nothing for that
 * and cost the one thing a page in a shell owes its neighbours, which is starting where
 * they start. See the note on `reading` in components/layout/PageShell.tsx.
 *
 * ── TWO PANES NOW, AND TWO KEYS ─────────────────────────────────────────────────────
 * General is the board, unchanged, on `announcements`. Birthdays is every approved
 * relative with a birthday inside `BIRTHDAY_HORIZON_DAYS`, on `announcements/birthdays` —
 * its own resource, registered by 20260819000002 §B with `view` and nothing else, which is
 * what "one rail item, one permission resource" means. Nothing writes a birthday: it is
 * derived from `people.date_of_birth`, and that column is edited where it always was, on a
 * member's own profile.
 *
 * ── THE FETCH IS GATED, NOT THE TAB ─────────────────────────────────────────────────
 * AGENTS.md §5, and it is the whole reason both grants are resolved before anything is
 * read. Props are serialized into the RSC payload and reach the browser whether a
 * component renders them or not, so a birthday roster fetched for somebody who cannot open
 * the pane has been published to them — a full name and a date of birth per relative, which
 * is PII rather than family structure. `getUpcomingBirthdays()` re-checks the same key
 * (`requireRead`) and reads through the USER client, so the composed `people` SELECT policy
 * still decides whose names come back; this page decides only whether to ask.
 *
 * ── WHY `requireView` IS DECOMPOSED HERE INSTEAD OF CALLED ──────────────────────────
 * Because two keys can each be a legitimate and sufficient reason to be on this screen, and
 * `requireView('announcements')` would 404 somebody whose family granted them the birthday
 * pane while restricting the board. That is not hypothetical bookkeeping — it is the
 * difference between the grid saying a member may see the family's birthdays and the product
 * honouring it.
 *
 * So the page opens for EITHER grant, which is exactly what Members & Access does for its
 * three tabs, and the 404 for a caller holding neither is the one `requireView` would have
 * given, for the same reason: a restricted page should not advertise that it exists.
 *
 * WHAT IS NOT DROPPED IN THE PROCESS, and this is the part Members & Access left out:
 * `requireView` is three checks, not one — `requireFamilyActive`, then `requireTier`, then
 * the permission test — and only the third is being widened here. Both of the others are
 * called explicitly above the grants, in the same order, so a removed family still lands on
 * the notice that explains it and a tier boundary still redirects to `/upgrade` rather than
 * silently opening a page the plan does not include. Copying the union-of-grants shape
 * without those two lines is the way this goes wrong later.
 *
 * A SUB-KEY OPENING A PAGE HAS ONE MORE OBLIGATION AND IT IS NOT DISCHARGED HERE.
 * `viewableResources()` builds the sidebar by walking FEATURES, so the nav item for
 * `/announcements` resolves against the `announcements` key alone: a caller holding ONLY
 * `announcements/birthdays` has a page that works and no link to it. `TAB_RESOURCES` in
 * lib/features.ts is the mechanism for exactly that case — `admin/users/templates` is
 * already in it for exactly this reason — and adding `announcements/birthdays` beside it is
 * the remaining half. It is deliberately not done from this file, which does not own that
 * registry; until it is, the combination above is reachable by URL only.
 */
export default async function AnnouncementsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // `requireView`, taken apart — see the essay above. These two are unchanged in effect and
  // must stay above the fetches: a removed family is redirected and a page above the plan is
  // sent to /upgrade before anything about this family is read.
  await requireFamilyActive(user.id, 'announcements')
  await requireTier(user.id, 'announcements')

  // Grants first, always. Every fetch below is CHOSEN from these answers rather than
  // filtered after the fact.
  const [mayViewBoard, mayViewBirthdays] = await Promise.all([
    can(user.id, 'announcements', 'view'),
    // `can`, not `canAny`: `requireRead` inside `getUpcomingBirthdays` resolves through
    // `can`, so scope 'own' opens the pane — and correctly, because the `people` policy is
    // then what narrows it to the reader's own row. The two must agree or the pane renders
    // over a refusal.
    can(user.id, 'announcements/birthdays', 'view'),
  ])
  if (!mayViewBoard && !mayViewBirthdays) notFound()

  // Both halves in parallel, each behind its own grant. The board's THREE RIGHTS travel with
  // its data rather than being resolved unconditionally: they are only meaningful to a caller
  // who is shown the board, and resolving them for one who is not would be three permission
  // reads to decide the state of buttons nobody is going to see.
  const [board, birthdays] = await Promise.all([
    mayViewBoard
      ? Promise.all([
        can(user.id, 'announcements', 'create'),
        // `canAny`, matching `requireEdit` in the action: pinning puts a post at the top of
        // every member's dashboard, so there is no coherent "own" version of it.
        canAny(user.id, 'announcements', 'edit'),
        // The SCOPE, not a boolean — 'own' is a real and common way to hold delete here, and
        // the board has to know which rows it applies to. `requireOwn` makes the same
        // decision server-side against the author id the database holds.
        scopeFor(user.id, 'announcements', 'delete'),
        getMyPersonId(user.id),
        getAnnouncements(),
        getChapters(),
      ])
      : null,
    mayViewBirthdays ? getUpcomingBirthdays() : [],
  ])

  const [canPost, canPin, deleteScope, myPersonId, announcements, chapters] =
    board ?? [false, false, 'none' as PermissionScope, '', [], []]

  // Resolved on the SERVER so the first paint already shows the right pane and the client's
  // initial state matches the server HTML exactly, which is what keeps this free of a
  // hydration mismatch. A `?pane=` that is not one of the two, or names one this caller
  // cannot open — a stale link, a grant removed since, or a single-grant caller arriving at
  // the bare URL — falls back to a pane they can see, in the rail's own order so the landing
  // pane is the leftmost one available.
  const requested = (await searchParams).pane
  const allowed: Record<AnnouncementPane, boolean> = {
    general: mayViewBoard,
    birthdays: mayViewBirthdays,
  }
  const isPane = (v: string | undefined): v is AnnouncementPane =>
    (ANNOUNCEMENT_PANES as readonly string[]).includes(v ?? '')
  const initialPane: AnnouncementPane = isPane(requested) && allowed[requested]
    ? requested
    // Non-null: the `notFound()` above guarantees at least one of the two is true.
    : ANNOUNCEMENT_PANES.find(p => allowed[p])!

  return (
    <PageShell className="space-y-6">
      {/* The heading only. The sentence under it is per-pane and lives in the shell — it used
          to describe pinning, which is true of the board and meaningless over a birthday
          list, and a lede describing the wrong pane is worse than none. */}
      <h1 className="text-3xl font-bold">Announcements</h1>

      <AnnouncementsShell
        initialPane={initialPane}
        mayViewBoard={mayViewBoard}
        mayViewBirthdays={mayViewBirthdays}
        initialAnnouncements={announcements}
        chapters={chapters}
        canPost={canPost}
        canPin={canPin}
        deleteScope={deleteScope}
        myPersonId={myPersonId}
        birthdays={birthdays}
      />
    </PageShell>
  )
}
