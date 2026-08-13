import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { viewableResources } from '@/lib/auth/permissions'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getMyAssignmentCount } from '@/app/actions/event-planning'
import Navbar from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { ConfirmProvider } from '@/components/ui/confirm'
import { IdleTimeout } from '@/components/layout/IdleTimeout'
import { ShellSwoop, ShellHill } from '@/components/layout/ShellDecor'

/**
 * The signed-in app says "do not index me", on every route beneath this layout.
 *
 * This is the tool `app/robots.ts` argues for and then does not reach for. Its
 * comment makes the case correctly — `Disallow` prevents CRAWLING, not indexing,
 * so a disallowed URL can still appear as a bare link if anything out there points
 * at it, and the instruction that actually keeps a page out of the index is
 * `noindex`, which has to be crawlable to be read. It then declines to list these
 * routes in robots.txt for a good separate reason (a world-readable file naming
 * /family-finances, /transactions and /direct-lineage is a free feature inventory)
 * and the noindex half never got written. This is that half.
 *
 * It is defence in depth rather than the primary control, which remains
 * `requireView` redirecting anonymous callers to /login. The gap it closes is
 * narrow and real: anything that fetches one of these URLs while holding a session
 * — an in-page link scanner, a preview crawler, a browser extension that submits
 * URLs — gets a rendered page rather than a redirect, and nothing in the markup
 * previously said it should not be indexed.
 *
 * `robots` is replaced wholesale by the deepest segment that defines it, so this
 * cleanly overrides the root layout's `index: true` for the entire subtree, and a
 * new page added under (protected) inherits it without having to remember.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let hasAssignments = false
  let viewable: string[] = []
  let familyCode = ''
  /** Gates the idle timer — there is nothing to sign out if nobody resolved. */
  let signedIn = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      signedIn = true
      // The sidebar shows a page only if the member may view it. There is no
      // is_admin branch any more — group policy is the single authority.
      // Count only outstanding items (shared with the Event Planning page) so the
      // nav link hides once everything is completed or cancelled. This also sweeps
      // overdue tasks into the 'cancelled' state.
      //
      // getMyFamilyCode costs nothing here: it reads getMyFamilies(), which is
      // cache()-wrapped, and Navbar below already calls it in this same request.
      const [resources, assignmentCount, code] = await Promise.all([
        viewableResources(user.id),
        getMyAssignmentCount(),
        getMyFamilyCode(user.id),
      ])
      viewable = [...resources]
      hasAssignments = assignmentCount > 0
      familyCode = code
    }
  } catch {
    // Non-fatal
  }

  // Every edit and delete in the signed-in app gates itself on useConfirm(), so
  // the provider has to sit above the whole shell — the navbar and sidebar
  // mutate state too.
  return (
    <ConfirmProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        {/* Heritage, so the rail's colour is what shows through <main>'s rounded
            corner below. The rail paints its own ground too — this is the backdrop
            behind the cut, not a substitute for it. */}
        <div className="flex flex-1 flex-col bg-brand-hero md:flex-row">
          <Sidebar hasAssignments={hasAssignments} viewable={viewable} />
          {/* SWITCHING FAMILY THROWS THE PAGE AWAY AND BUILDS A NEW ONE.
              ─────────────────────────────────────────────────────────────────────
              FamilySwitcher lands its change with `router.refresh()`, and a refresh
              deliberately merges the new server payload WITHOUT discarding client
              state (see lib/use-server-state.ts). Every page under here holds
              family-scoped server data in `useState`, so without this key the page
              keeps rendering the family you just LEFT — and the ones whose state is
              writable will then post it back under the family you switched TO.

              Family Settings was the worked example and is worth keeping in mind as
              the shape of the bug: its box kept the old name while the server value
              beside it updated, so the form read as dirty, offered Save, and taking
              it renamed the new family with the old one's name. Same shape in
              ChatShell (rooms + activeRoomId), PersonalInfoForm (a multi-family user
              has one `people` row PER FAMILY, so this is a different profile) and
              AdminFundsClient (`alloc`, carrying the other family's fund_ids).

              Keyed at the layout so a page cannot forget it, and so the rule holds
              for pages not yet written. `family_code` is the right key because it is
              immutable after insert (families_guard_family_code, 20260812000000): it
              changes when the FAMILY changes and at no other time, so a rename — or
              any other `router.refresh()` — does not remount anything.

              Chrome rendered OUTSIDE this main is not covered and keys itself; today
              that is NotificationBell in Navbar. Sidebar needs nothing: it takes
              `viewable` as a prop and reads it directly rather than seeding state.

              ── THE SHELL DECORATION ──────────────────────────────────────────────
              Both pieces are rendered HERE, as children of <main>, and that placement is
              the whole trick. Each has to paint ON TOP of the workspace's cream ground —
              so it cannot be a sibling, which would put it underneath — while staying
              BENEATH everything on the page, which is what `z-0` against the content's
              `z-10` buys. Being children of <main> also lets them reach LEFT across the
              rail, because <aside> precedes <main> in the DOM and so paints below its
              whole subtree.

              This replaced a `rounded-l-[2rem]` on this element, which was wrong in the
              way the kit's PATCH 01 describes: a curve at the top AND the bottom, running
              the full height, is the "narrow sidebar carried down the page" it corrects.
              The bite belongs to the logo area and the rail is straight below it.

              `bg-background` is not redundant with the body's — the row above is
              `bg-brand-hero`, so without an opaque fill here the whole page is burgundy.

              NO `overflow-hidden`, ever. The hill is deliberately wider than this element
              and gets its own clipping layer; putting it here would also break
              `position: sticky` inside every page and clip the RowMenu popovers.

              The wrapper around {children} exists only to hold `z-10`. Every page in the
              app renders inside it, so it must stay a plain block with no width, height
              or display of its own — /chat measures itself against the viewport and would
              notice any of the three. */}
          <main key={familyCode} className="relative isolate flex-1 min-w-0 bg-background">
            <ShellSwoop />
            <ShellHill />
            <div className="relative z-10">{children}</div>
          </main>
        </div>
      </div>

      {/* AFTER the shell, and that is not cosmetic. Its warning is a `Dialog`, and every
          dialog in the app is `fixed z-50` — so among equal z-indexes the later element in
          the DOM paints on top. Mounted above `{children}`, the "still there?" warning
          would appear BEHIND a form dialog a member already had open, which is precisely
          the moment they most need to see it.

          Not keyed on `familyCode` like `<main>` is: switching family must not restart the
          idle clock, and the component holds no family data to go stale. */}
      {signedIn && <IdleTimeout />}
    </ConfirmProvider>
  )
}
