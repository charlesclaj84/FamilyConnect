'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMyShellState } from '@/app/actions/membership'

/**
 * Keeps the signed-in shell honest while a tab is left open.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────────────
 * The rail and the top bar are built ONCE, by app/(protected)/layout.tsx, from
 * `viewableResources()`. App Router does not re-render a shared layout on a client-side
 * navigation — it refetches only the segments below the common layout — so whatever the
 * shell resolved to when the tab was opened is what it keeps saying.
 *
 * That is almost always fine, because almost nothing about a member changes mid-session.
 * The exception is the one case the product creates deliberately: somebody signs in while
 * their membership is still pending, an administrator approves them, and their rail keeps
 * showing the single Dashboard link it was built with. `revalidatePath('/', 'layout')` in
 * `approveApplicant` cannot help them — it runs in the APPROVER's request and reaches the
 * approver's caches. Nothing in the applicant's browser was asking.
 *
 * It is not only approval. `applyTemplate`, `setTemplatePermission`, `deleteTemplate` and
 * `setFamilyTier` all change what the shell may show, and `setMemberEnabled` can take it
 * away entirely — a member switched off keeps a full rail of destinations that now 404
 * until they reload, which is the worse version of the same bug.
 *
 * ── WHAT IT DOES ────────────────────────────────────────────────────────────────────
 * Asks the server for a fingerprint of everything the shell is derived from
 * (`getMyShellState`) and calls `router.refresh()` when it differs from the one this
 * render was built with — the only thing short of a reload that re-renders a shared
 * layout. It renders nothing.
 *
 * ── WHEN IT ASKS, AND WHY THAT IS TWO DIFFERENT ANSWERS ─────────────────────────────
 * The naive version polls for everyone. That is one round trip per tab per interval for
 * every member on every page — each one a GoTrue `getUser()` plus a memberships read — to
 * catch an event that happens roughly once per member per lifetime. So:
 *
 *   * **A timer, only while the shell is showing a REDUCED answer** (`watchClosely`).
 *     That is the pending, rejected and disabled cases: rare, short-lived, and the one
 *     where somebody is sitting on a screen literally waiting for the change. They get it
 *     within the interval without touching anything.
 *   * **On return to the tab, for everyone.** `visibilitychange` and `focus` fire only
 *     when a person comes back to a tab they left, which is exactly when a stale shell is
 *     both most likely and most visible — and they cost nothing at all when nobody does.
 *     This is what catches a template edit or a tier change for an ordinary member.
 *
 * ── THREE THINGS THAT MUST NOT CHANGE ───────────────────────────────────────────────
 *   * **It must never call `markIdleActivity()`.** `lib/idle-timeout.ts` counts pointer
 *     and keyboard events only, deliberately — a background poll is not somebody at the
 *     keyboard, and marking it would keep every open tab alive forever and defeat the
 *     60-minute sign-out. Nothing here touches that marker.
 *   * **`router.refresh()` merges the new server payload WITHOUT discarding client
 *     state** — the same behaviour `lib/use-server-state.ts` exists to work around. So a
 *     refresh fired from here re-syncs anything using `useServerState`. Checked at the
 *     time of writing: `Sidebar` reads `viewable` straight from props and holds only
 *     UI-local state, `AccountMenu` and `FamilySwitcher` derive from props, and
 *     `PersonalInfoForm` — the one page a pending member can type into — seeds plain
 *     `useState`, so a half-filled profile survives. A page added later that DOES use
 *     `useServerState` for something a member edits would turn this into a data-loss bug;
 *     that is the thing to check before widening when it fires.
 *   * **It is mounted OUTSIDE `<main key={familyCode}>`,** beside `IdleTimeout`, so a
 *     family switch does not tear it down mid-request.
 */

/** How often to ask while the caller is watching for their own approval. */
const CLOSE_INTERVAL_MS = 20_000

/**
 * The shortest gap between two asks, whatever prompted them. A person flicking between
 * two tabs fires `visibilitychange` and `focus` in the same instant, and both would
 * otherwise post.
 */
const MIN_GAP_MS = 5_000

export function ShellWatcher({
  fingerprint,
  watchClosely,
}: {
  /** What the server render this shell was built from resolved to. */
  fingerprint: string
  /** True while the shell is showing a reduced answer — see the header. */
  watchClosely: boolean
}) {
  const router = useRouter()

  // Refs rather than state, because nothing here renders: a `useState` fingerprint would
  // sit in the polling effect's dependencies and restart the timer every time the shell
  // changed, and `lastCheck`/`busy` must survive a re-render without causing one.
  const seen = useRef(fingerprint)
  const lastCheck = useRef(0)
  const busy = useRef(false)

  // Adopted in an effect, NOT during render. Writing `seen.current` in the body is what
  // `react-hooks/refs` forbids, and correctly: a ref written during render is invisible to
  // React's own bookkeeping. Its own effect rather than a dependency of the one below, so
  // a refresh landing does not tear down and rebuild the timer it just fired from.
  //
  // What it is for: after `router.refresh()` re-renders the layout, the server's new
  // fingerprint arrives here — and without adopting it the very next check would compare
  // against the stale one and refresh again, forever.
  useEffect(() => { seen.current = fingerprint }, [fingerprint])

  useEffect(() => {
    let cancelled = false

    async function check() {
      // Nothing to compare against, so nothing to detect — a caller in no family has no
      // shell to go stale. Also skips a tab sitting in the background, where a refresh
      // would be work nobody is waiting on.
      if (!seen.current || document.visibilityState === 'hidden') return
      if (busy.current) return
      const now = Date.now()
      if (now - lastCheck.current < MIN_GAP_MS) return
      lastCheck.current = now
      busy.current = true
      try {
        const state = await getMyShellState()
        // An empty answer means the session went away underneath us — signed out in
        // another tab, or the token finally expired. Refreshing on it would bounce the
        // member to /login from a tab they may be about to use; the idle timeout and the
        // page guards own that decision, not this.
        if (cancelled || !state.fingerprint) return
        if (state.fingerprint !== seen.current) {
          seen.current = state.fingerprint
          router.refresh()
        }
      } catch {
        // A failed poll is a poll that did not happen. Swallowed rather than surfaced:
        // there is no UI here to put an error in, and the next one is 20 seconds away.
      } finally {
        busy.current = false
      }
    }

    // `focus` as well as `visibilitychange`, because they are not the same event: moving
    // between two windows of the same browser fires focus without ever hiding the
    // document. MIN_GAP_MS is what stops the pair double-posting.
    const onWake = () => { void check() }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)

    const timer = watchClosely ? setInterval(onWake, CLOSE_INTERVAL_MS) : null

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      if (timer) clearInterval(timer)
    }
  }, [router, watchClosely])

  return null
}
