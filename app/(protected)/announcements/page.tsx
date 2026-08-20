import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  can, canAny, requireFamilyActive, requireTier, scopeFor, type PermissionScope,
} from '@/lib/auth/permissions'
import { getMyPersonId } from '@/lib/auth/family'
import { getAnnouncements, getChapters, getUpcomingBirthdays } from '@/app/actions/announcements'
import { getUpdatesArchive } from '@/app/actions/updates'
import { AnnouncementsShell } from '@/components/announcements/AnnouncementsShell'
import {
  ANNOUNCEMENT_PANES, isAnnouncementPane, type AnnouncementPane,
} from '@/lib/announcement-panes'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Announcements' }

/**
 * BOTH SEARCH PARAMS THE ARCHIVE READS ARE `string | string[]`, because Next hands back an
 * array for a repeated key and `/announcements?q=a&q=b` is a URL anybody can send. `q` typed
 * as `string` was a crash on `/updates` — `sanitizeUpdatesQuery` calls `.trim()` — while
 * `pages` survived by luck, `Number([...])` being NaN. Both are resolved to the FIRST value
 * below, which is what every other page in the tree that reads a free-text param does.
 */
interface Props {
  searchParams: Promise<{
    pane?: string | string[]
    q?: string | string[]
    pages?: string | string[]
  }>
}

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

/**
 * The family's notice board — plus, since 2026-08-19, the archive of everything that has been
 * sent, and whose birthday is next.
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
 * ── THREE PANES NOW, AND THREE KEYS ─────────────────────────────────────────────────
 * General is the board, unchanged, on `announcements`. Updates is the merged archive of the
 * board and the caller's own notifications, on `updates` — a route of its own until
 * 2026-08-19, and still one: `/updates` redirects here, which is why the key did not become
 * a sub-key of `announcements`. Birthdays is every approved relative with a birthday inside
 * `BIRTHDAY_HORIZON_DAYS`, on `announcements/birthdays` — its own resource, registered by
 * 20260819000002 §B with `view` and nothing else, which is what "one rail item, one
 * permission resource" means. Nothing writes a birthday: it is derived from
 * `people.date_of_birth`, and that column is edited where it always was, on a member's own
 * profile.
 *
 * ── THE FETCH IS GATED, NOT THE TAB ─────────────────────────────────────────────────
 * AGENTS.md §5, and it is the whole reason all three grants are resolved before anything is
 * read. Props are serialized into the RSC payload and reach the browser whether a
 * component renders them or not, so a birthday roster fetched for somebody who cannot open
 * the pane has been published to them — a full name and a date of birth per relative, which
 * is PII rather than family structure. `getUpcomingBirthdays()` re-checks the same key
 * (`requireRead`) and reads through the USER client, so the composed `people` SELECT policy
 * still decides whose names come back; this page decides only whether to ask. The archive is
 * the same shape: `getUpdatesArchive()` runs `requireRead('updates')` itself and narrows the
 * announcement half a second time on `announcements:view`.
 *
 * ALL THREE PANES ARE FETCHED UP FRONT, for a caller entitled to them, because switching
 * panes is a `replaceState` rather than a navigation (see the shell). A pane fetched only
 * when it is the ACTIVE one would render empty the moment somebody clicked across to it.
 *
 * ── WHY `requireView` IS DECOMPOSED HERE INSTEAD OF CALLED ──────────────────────────
 * Because any one of three keys can be a legitimate and sufficient reason to be on this
 * screen, and `requireView('announcements')` would 404 somebody whose family granted them the
 * birthday pane while restricting the board. That is not hypothetical bookkeeping — it is the
 * difference between the grid saying a member may see the family's birthdays and the product
 * honouring it.
 *
 * So the page opens for ANY grant, which is exactly what Members & Access does for its
 * tabs, and the 404 for a caller holding none is the one `requireView` would have given, for
 * the same reason: a restricted page should not advertise that it exists.
 *
 * WHAT IS NOT DROPPED IN THE PROCESS, and this is the part Members & Access left out:
 * `requireView` is three checks, not one — `requireFamilyActive`, then `requireTier`, then
 * the permission test — and only the third is being widened here. Both of the others are
 * called explicitly above the grants, in the same order, so a removed family still lands on
 * the notice that explains it and a tier boundary still redirects to `/upgrade` rather than
 * silently opening a page the plan does not include. Copying the union-of-grants shape
 * without those two lines is the way this goes wrong later.
 *
 * A SUB-KEY OPENING A PAGE HAS ONE MORE OBLIGATION, AND IT IS DISCHARGED IN `lib/features.ts`.
 * `viewableResources()` builds the sidebar by walking FEATURES, so the nav item for
 * `/announcements` would resolve against the `announcements` key alone: a caller holding ONLY
 * `announcements/birthdays` or ONLY `updates` would have a page that works and no link to it.
 * `TAB_RESOURCES` is the mechanism for exactly that, and the sidebar's Community row lists
 * all three keys in its `viewKeys`.
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
  const [mayViewBoard, mayViewUpdates, mayViewBirthdays] = await Promise.all([
    can(user.id, 'announcements', 'view'),
    // `can`, matching `requireRead` inside `getUpdatesArchive`. A caller with `updates:view`
    // and no `announcements:view` gets an archive of their own notifications and is TOLD the
    // board is not in it — the action decides that, not this line.
    can(user.id, 'updates', 'view'),
    // `can`, not `canAny`: `requireRead` inside `getUpcomingBirthdays` resolves through
    // `can`, so scope 'own' opens the pane — and correctly, because the `people` policy is
    // then what narrows it to the reader's own row. The two must agree or the pane renders
    // over a refusal.
    can(user.id, 'announcements/birthdays', 'view'),
  ])
  if (!mayViewBoard && !mayViewUpdates && !mayViewBirthdays) notFound()

  const params = await searchParams

  // Each pane in parallel, each behind its own grant. The board's THREE RIGHTS travel with
  // its data rather than being resolved unconditionally: they are only meaningful to a caller
  // who is shown the board, and resolving them for one who is not would be three permission
  // reads to decide the state of buttons nobody is going to see.
  const [board, archive, birthdays] = await Promise.all([
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
    // Neither param is trusted. `clampPages` bounds the depth (a `?pages=999` would otherwise
    // ask each source for 25,000 rows and be silently truncated at PostgREST's `max_rows`) and
    // `sanitizeUpdatesQuery` is what makes the query safe to put in a filter. Both live in
    // `lib/updates-archive.ts`, are tested, and are called by the ACTION — this page merely
    // passes what arrived. `Number(undefined)` is NaN, which `clampPages` reads as page 1;
    // deliberately not defaulted here, so one place decides what an unparseable page means.
    mayViewUpdates
      ? getUpdatesArchive({ q: first(params.q), pages: Number(first(params.pages)) })
      : Promise.resolve(null),
    mayViewBirthdays ? getUpcomingBirthdays() : Promise.resolve([]),
  ])

  const [canPost, canPin, deleteScope, myPersonId, announcements, chapters] =
    board ?? [false, false, 'none' as PermissionScope, '', [], []]

  // Resolved on the SERVER so the first paint already shows the right pane and the client's
  // initial state matches the server HTML exactly, which is what keeps this free of a
  // hydration mismatch. A `?pane=` that is not one of the three, or names one this caller
  // cannot open — a stale link, a grant removed since, or a single-grant caller arriving at
  // the bare URL — falls back to a pane they can see, in the rail's own order so the landing
  // pane is the leftmost one available.
  //
  // `isAnnouncementPane` LIVES IN A PURE MODULE and is imported from there rather than from
  // the shell. It was a `const` in the shell, which is a `'use client'` file — so this line
  // got a client REFERENCE instead of the array and threw `.includes is not a function` on
  // every load, rendering the error boundary over the whole page.
  const allowed: Record<AnnouncementPane, boolean> = {
    general: mayViewBoard,
    updates: mayViewUpdates,
    birthdays: mayViewBirthdays,
  }
  const requested = first(params.pane)
  const initialPane: AnnouncementPane = isAnnouncementPane(requested) && allowed[requested]
    ? requested
    // Non-null: the `notFound()` above guarantees at least one of the three is true.
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
        mayViewUpdates={mayViewUpdates}
        mayViewBirthdays={mayViewBirthdays}
        initialAnnouncements={announcements}
        chapters={chapters}
        canPost={canPost}
        canPin={canPin}
        deleteScope={deleteScope}
        myPersonId={myPersonId}
        archive={archive}
        birthdays={birthdays}
      />
    </PageShell>
  )
}
