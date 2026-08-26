import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { viewableResources } from '@/lib/auth/permissions'
import {
  getMyFamilyCode, getViewingMembership, isApproved, isActiveFamily,
  REMOVED_FAMILY_RESOURCES,
} from '@/lib/auth/family'
import { getMyShellState } from '@/app/actions/membership'
import { isGenorraStaff } from '@/lib/auth/staff'
import TopBar from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { ConfirmProvider } from '@/components/ui/confirm'
import { IdleTimeout } from '@/components/layout/IdleTimeout'
import { ShellWatcher } from '@/components/layout/ShellWatcher'
import { ZoneHint } from '@/components/layout/ZoneHint'
import { LocaleSync } from '@/components/layout/LocaleSync'
import { resolveLocale } from '@/lib/auth/locale'
import { BASE_LOCALE } from '@/lib/i18n/locales'
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
 * /family-finances, /transactions and /family-tree is a free feature inventory)
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
  let viewable: string[] = []
  let familyCode = ''
  /** Gates the idle timer — there is nothing to sign out if nobody resolved. */
  let signedIn = false
  /**
   * The member's language, for `<html lang>` via LocaleSync at the bottom of this file.
   *
   * Empty until resolved, and LocaleSync does nothing with an empty string — so a request
   * that never reaches the resolver leaves the root layout's `Accept-Language` answer in
   * place rather than overwriting it with a guess.
   */
  let locale = ''
  /**
   * What this shell was built from, and whether the caller is sitting in front of a
   * reduced version of it waiting for that to change. Both feed ShellWatcher — see its
   * header for why a layout needs watching at all.
   */
  let shellFingerprint = ''
  let watchClosely = false
  /**
   * Whether this account may open the GENORRA staff console, resolved HERE and handed
   * down as a prop.
   *
   * IT IS A SERVER ANSWER, and it has to be. `genorra_staff` has RLS enabled and no
   * policy at all, so the browser cannot read it — a client-side check would have nothing
   * to check against, and inventing one (a flag in user metadata, a claim on the JWT)
   * would put a privileged boolean somewhere its owner can write. See `lib/auth/staff.ts`.
   *
   * It costs one memoized query for the whole request, and it decides ONE link. That link
   * is the only thing in the member product that knows the console exists; every route
   * under `app/(staff)` 404s a caller without a row, so a member who never sees the link
   * cannot find the console by guessing at a URL either.
   */
  let isStaff = false
  /**
   * When THIS session began — `user.last_sign_in_at`, handed to the idle timer.
   *
   * IT HAS TO BE RESOLVED HERE. The timer's hardest question is what a stale activity
   * marker in `localStorage` means when a page loads: this session's own idleness (sign
   * out) or residue from an earlier one (ignore). The discriminator is whether the marker
   * pre-dates the sign-in, and a browser that could choose the sign-in time could choose
   * the answer — auth-js keeps the whole session in `localStorage`, so a client-side read
   * would be exactly that. `getUser()` above went to GoTrue for this.
   *
   * `null` where GoTrue sent none; `inheritedActivity` treats that as "cannot tell" and
   * keeps the conservative answer. See `lib/idle-timeout.ts`.
   */
  let sessionStartedAt: string | null = null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      signedIn = true
      sessionStartedAt = user.last_sign_in_at ?? null
      // The sidebar shows a page only if the member may view it. There is no
      // is_admin branch any more — group policy is the single authority.
      //
      // NOTHING HERE COUNTS THE CALLER'S OWN WORKLOAD ANY MORE. `getMyAssignmentCount()`
      // used to run beside these, so the rail could hide Event Planning until a member had
      // something assigned; that route is retired with the rest of Events, and Gatherings
      // deliberately does not do it — `/gatherings` has a real empty state, and a row that is
      // sometimes there is worse than a row that is sometimes empty. It also cost every
      // request in the product one query to decide one link.
      //
      // getMyFamilyCode costs nothing here: it reads getMyFamilies(), which is
      // cache()-wrapped, and TopBar calls it again in this same request.
      const [resources, code, shell, membership, staff, resolvedLocale] = await Promise.all([
        viewableResources(user.id),
        getMyFamilyCode(user.id),
        // Costs one extra round of the same cache()-wrapped reads the three above
        // already warmed — getMyFamilies, getMyPermissionSet and getMyFamilyTier are
        // each resolved once per request whoever asks first.
        getMyShellState(),
        getViewingMembership(user.id),
        // One row, keyed on the user id, through the service role — the only client that
        // can see `genorra_staff` at all. Memoized per request, so the staff layout
        // asking again on the other window costs nothing here.
        isGenorraStaff(user.id),
        // The member's chosen language, or their browser's, or English. One `people` read,
        // cache()-wrapped like the rest, feeding LocaleSync at the bottom of this file.
        resolveLocale(user.id),
      ])
      locale = resolvedLocale
      // ── A REMOVED FAMILY GETS THE PERSONAL PAGES AND NOTHING ELSE ─────────────────
      // Navigation, not authorization, and the distinction is written out at length on
      // REMOVED_FAMILY_RESOURCES. Every page still gates on `requireView`, which knows
      // nothing about `families.status` — so this stops the shell advertising twenty
      // destinations into a family that has been switched off, and does not pretend to be
      // the thing that closes them. The honest statement of what happened is the notice
      // screen the dashboard renders (`components/membership/FamilyRemoved.tsx`).
      //
      // Tested POSITIVELY for 'active', like every other gate about this column: a status
      // added later reduces the rail rather than quietly keeping it whole.
      //
      // `Boolean(membership) &&` first, because a caller who belongs to NO family has no
      // family to have been removed — `isActiveFamily(undefined)` is correctly false, and
      // acting on that would narrow the rail for a state this has nothing to say about.
      const familyRemoved = Boolean(membership) && !isActiveFamily(membership?.familyStatus)
      viewable = familyRemoved
        ? [...resources].filter(r => REMOVED_FAMILY_RESOURCES.includes(r))
        : [...resources]
      familyCode = code
      shellFingerprint = shell.fingerprint
      isStaff = staff
      // Positively 'approved' is what makes this total: pending, rejected and disabled
      // all put the caller in front of a shell that is missing most of itself, and all
      // three can be changed by somebody else while they watch. `isApproved` is the same
      // predicate every gate in the app tests, so a fifth status would land here denied
      // — which, for a watcher, is the safe direction.
      //
      // A REMOVED FAMILY IS THE SECOND WAY TO BE LOOKING AT A REDUCED SHELL, and it is
      // exactly the situation the watcher exists for: the member did not do anything, an
      // administrator elsewhere did, and a restore is somebody else's action too. Watching
      // only `membership_status` would leave both directions invisible to an open tab.
      watchClosely = (Boolean(membership) && !isApproved(membership?.status)) || familyRemoved
    }
  } catch {
    // Non-fatal
  }

  // Every edit and delete in the signed-in app gates itself on useConfirm(), so
  // the provider has to sit above the whole shell — the top bar and the rail
  // mutate state too.
  return (
    <ConfirmProvider>
      {/* ONE ROW, NO HEADER ABOVE IT. There used to be a full-width `bg-brand-hero`
          Navbar here carrying the mark, the wordmark and four controls. The Golden
          Master has no such band: the brand lives at the top of the RAIL and the
          workspace simply begins, with its controls floating at the top right of the
          cream. `TopBar` is those controls, rendered INSIDE <main> — which is what lets
          the rail run to the very top of the shell with the logo in it.

          THE ROW'S GROUND IS THE PAGE'S, not Heritage. It was `bg-brand-hero` back when
          the cut was a `rounded-l-[2rem]` on <main> and the row had to supply the colour
          showing through it; ShellSwoop paints both sides of that boundary itself now, so
          the burgundy here was doing nothing — the rail and <main> between them cover this
          element completely. Nothing, that is, except the ONE place it is visible: the
          rail's rounded top-left corner, where a burgundy backdrop behind a burgundy card
          hides the round entirely. Cream is what the kit puts outside that corner. */}
      <div className="min-h-screen flex flex-col">
        <div className="flex flex-1 flex-col bg-background md:flex-row">
          <Sidebar viewable={viewable} locale={locale || BASE_LOCALE} />
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

              TopBar renders INSIDE this main but is not a child of the keyed element —
              the key is on <main> itself and TopBar is rendered by this layout, so the
              NotificationBell it holds keys itself on personId. Sidebar needs nothing: it
              takes `viewable` as a prop and reads it directly rather than seeding state.

              ── THE SHELL DECORATION ──────────────────────────────────────────────
              Both pieces are rendered under <main>, and that is what lets them reach LEFT
              across the rail: <aside> precedes <main> in the DOM, so it paints below this
              whole subtree. Each also has to paint ON TOP of the workspace's cream ground,
              so neither can be a sibling of <main>, which would put it underneath.

              THEY SIT AT DIFFERENT LEVELS, for a reason particular to each. ShellHill is
              here at `z-0`, beneath the content's `z-10` — it is a page-foot decoration and
              belongs behind whatever the page puts over it. ShellSwoop is inside the z-10
              wrapper and level with TopBar, because TopBar's opaque `bg-background` runs the
              full width of <main> and was painting out the only part of that shape which
              reaches into the workspace. Its own comment carries the arithmetic.

              This replaced a `rounded-l-[2rem]` on this element, which was wrong in the
              way the kit's PATCH 01 describes: a curve at the top AND the bottom, running
              the full height, is the "narrow sidebar carried down the page" it corrects.
              The bite belongs to the logo area and the rail is straight below it.

              `bg-background` here is what makes the workspace opaque, and it is the only
              opaque fill in the row now that the row itself carries the page ground.

              NO `overflow-hidden`, ever. The hill is deliberately wider than this element
              and gets its own clipping layer; putting it here would also break
              `position: sticky` inside every page and clip the RowMenu popovers.

              The wrapper around {children} exists only to hold `z-10`. Every page in the
              app renders inside it, so it must stay a plain block with no width, height
              or display of its own — /chat measures itself against the viewport and would
              notice any of the three. */}
          <main key={familyCode} className="relative isolate flex-1 min-w-0 bg-background">
            <ShellHill />
            {/* TopBar sits inside the z-10 wrapper with the page, not outside it, so the
                decoration behind them both stays behind them both. It is `sticky top-0`
                within this column and the column is the full page height, which is why it
                pins to the viewport without being `fixed`.

                ShellSwoop follows it, and the order is load-bearing: both are level 30, so
                what puts the shape over the bar's background is tree order alone. Moving
                this line above TopBar hides the top third of the bite again. */}
            <div className="relative z-10">
              <TopBar viewable={viewable} isStaff={isStaff} locale={locale || BASE_LOCALE} />
              <ShellSwoop />
              {children}
            </div>
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
      {signedIn && <IdleTimeout sessionStartedAt={sessionStartedAt} />}

      {/* THE SHELL ABOVE IS BUILT ONCE AND NEVER ASKS AGAIN.
          ─────────────────────────────────────────────────────────────────────
          `viewable` is resolved at the top of this function and handed to the rail and
          the bar. App Router does not re-render a shared layout on a client-side
          navigation, so an applicant approved while their tab is open keeps the one-link
          rail a pending member gets — and a member switched OFF keeps a full one. This is
          what notices, by comparing a fingerprint of everything the shell derives from.

          Mounted here for the same two reasons IdleTimeout is: it belongs to the shell
          rather than to any page, and it must sit OUTSIDE `<main key={familyCode}>` so a
          family switch does not tear it down mid-request. It renders nothing, so its
          position among these siblings carries no z-index consequence.

          Not keyed at all: it holds a ref seeded from a prop and adopts a new one during
          render, so a family switch flows through it without a remount. */}
      {signedIn && shellFingerprint && (
        <ShellWatcher fingerprint={shellFingerprint} watchClosely={watchClosely} />
      )}

      {/* Records which timezone this browser is in, so `resolveZone` can read dates in the
          member's own zone before they have set a preference. Outside `<main
          key={familyCode}>` for the same reason IdleTimeout is: a zone belongs to the
          person, not to the family they are looking at. Renders nothing. */}
      {signedIn && <ZoneHint />}

      {/* Puts the member's OWN language on `<html lang>`. The root layout negotiates
          `Accept-Language`, which is right for Home and for anybody not signed in; this is
          where a stored choice takes over. Outside `<main key={familyCode}>` for the same
          reason ZoneHint is: a language belongs to the person, not to the family they are
          looking at. Renders nothing. */}
      {signedIn && <LocaleSync locale={locale} />}
    </ConfirmProvider>
  )
}
