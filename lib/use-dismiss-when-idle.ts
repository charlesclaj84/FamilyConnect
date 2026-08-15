'use client'

import { useEffect, useRef } from 'react'

/**
 * How long a panel stays open after the person has stopped using it. "A few seconds",
 * which is the whole specification — long enough that a glance away does not close it,
 * short enough that a menu left behind on the page is gone before it is in the way.
 *
 * ONE CONSTANT, so every dropdown in the app disappears on the same beat. Four of them
 * use this hook, and a menu that lingered twice as long as the one beside it would read
 * as one of them being broken.
 */
export const PANEL_IDLE_MS = 4000

/**
 * Close a dropdown a few seconds after it stops being used.
 *
 * ── WHAT THIS FIXES ─────────────────────────────────────────────────────────────────
 * Every menu in the app closes on an outside CLICK and on nothing else, so a panel
 * opened, read, and moved on from stays on screen — over the page, holding whatever it
 * was showing — until the next click lands somewhere. That is the reported complaint,
 * and on the notification bell and the account menu the thing left sitting there is a
 * list of names and an email address.
 *
 * ── "STOPS BEING USED" IS TWO CONDITIONS, AND BOTH HAVE TO BE FALSE ─────────────────
 * The timer is only ever armed when the pointer is outside the panel AND focus is not
 * visibly inside it. Either one alone would close a menu somebody is plainly using:
 *
 *   * A person reading a long notification list has the pointer over it and touches
 *     nothing for ten seconds. Pointer-inside keeps it open.
 *   * A keyboard user tabbing down the menu moves no pointer at all. Focus-inside keeps
 *     it open — and this is the case that makes the whole feature safe to ship, because
 *     it means a screen-reader or keyboard-only user is never on a clock. WCAG 2.2.1 is
 *     about content that times out on somebody who is still working; nothing here can.
 *
 * ── `:focus-visible`, NOT `:focus`, AND THE DISTINCTION IS THE FEATURE ──────────────
 * Clicking the trigger with a mouse leaves it FOCUSED in every browser this ships to. So
 * a plain "is focus inside" test is true for the entire life of a mouse-opened panel and
 * the timer would never arm once — the hook would do nothing at all, silently, which is
 * the worst way for it to be wrong. `:focus-visible` is exactly the browser's own answer
 * to "did this focus come from the keyboard", so a mouse user's trigger does not count
 * and a keyboard user's does.
 *
 * ── IT NEVER ARMS ON ITS OWN ────────────────────────────────────────────────────────
 * There is no timer when the panel opens. Something has to happen first — a pointer
 * moving outside, or focus landing outside — because the alternative is closing a menu
 * under somebody who opened it and has not moved. That also makes this a no-op on touch,
 * where there is no pointer to move away and tapping elsewhere already closes it.
 *
 * ── THE ARM IS NOT RESTARTED ────────────────────────────────────────────────────────
 * Once the countdown starts, moving the mouse further away does not extend it: the
 * measurement is "N seconds since it was last engaged", not "N seconds of stillness".
 * Re-engaging cancels it outright, so returning to the panel gives a full window back.
 *
 * ── WHY A PREDICATE RATHER THAN A CONTAINER REF ─────────────────────────────────────
 * `parts()` returns the elements that count as inside, and is called per event so it can
 * answer with something that is not there yet. Two call sites need that: `RowMenu`
 * portals its panel to `document.body`, so there is no single subtree to test; and the
 * three header panels wrap their trigger, their panel AND a full-viewport click-away
 * scrim in one `relative` div — testing that wrapper would report every pointer position
 * on the page as "inside the menu", and the hook would never arm.
 *
 * Nulls in the returned array are ignored, so an unmounted part is simply not inside.
 */
export function useDismissWhenIdle({ open, close, parts, delayMs = PANEL_IDLE_MS }: {
  open: boolean
  close: () => void
  /** The elements that count as "still in use". Called fresh on every event. */
  parts: () => readonly (HTMLElement | null | undefined)[]
  delayMs?: number
}) {
  // The latest-ref pattern: both of these change identity every render, and neither is a
  // reason to tear down the listeners and forget a running countdown.
  const closeRef = useRef(close)
  const partsRef = useRef(parts)
  useEffect(() => {
    closeRef.current = close
    partsRef.current = parts
  })

  useEffect(() => {
    if (!open) return

    let timer: ReturnType<typeof setTimeout> | null = null
    // WHERE THE POINTER IS, remembered rather than re-read per event, because the events
    // that matter most do not carry it. Clicking a control inside the panel fires
    // pointerdown, then focusout, then focusin — and the two focus events have no
    // position on them, so a hook that judged engagement from the focused element alone
    // would arm the timer on the member's own click. It starts TRUE: nothing has said
    // otherwise yet, and "never arms on its own" is the rule.
    let pointerInside = true

    const disarm = () => {
      if (timer) { clearTimeout(timer); timer = null }
    }
    // Only if nothing is already counting down — see "THE ARM IS NOT RESTARTED".
    const arm = () => {
      if (!timer) timer = setTimeout(() => { timer = null; closeRef.current() }, delayMs)
    }

    const partOf = (node: Node | null | undefined): boolean =>
      Boolean(node) && partsRef.current().some(el => el?.contains(node as Node))

    /**
     * Focus counts only when the browser says it is keyboard focus. `matches` is guarded
     * because an unsupported selector throws a SyntaxError out of a document-level
     * listener — the kind of failure that takes the whole page's event handling with it —
     * and the safe answer to "we cannot tell" is to leave the panel open.
     */
    const keyboardFocusInside = (): boolean => {
      const active = document.activeElement as HTMLElement | null
      if (!active || !partOf(active)) return false
      try { return active.matches(':focus-visible') } catch { return true }
    }

    const settle = () => {
      if (pointerInside || keyboardFocusInside()) disarm()
      else arm()
    }

    const onPointer = (e: Event) => {
      pointerInside = partOf(e.target as Node)
      settle()
    }
    // A pointer that has left the window is as disengaged as one across the page, and
    // produces no further pointermove to notice it with.
    const onPointerLeave = () => { pointerInside = false; settle() }
    const onFocusChange = () => settle()
    // Typing inside is engagement; a keystroke elsewhere is somebody who has moved on,
    // which `partOf` on the focused element already answers.
    const onKeyDown = () => settle()

    // Capture, so a handler that stops propagation inside the panel cannot make the menu
    // look abandoned while it is being used.
    document.addEventListener('pointermove', onPointer, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusChange, true)
    document.addEventListener('focusout', onFocusChange, true)
    document.documentElement.addEventListener('pointerleave', onPointerLeave)

    return () => {
      disarm()
      document.removeEventListener('pointermove', onPointer, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusChange, true)
      document.removeEventListener('focusout', onFocusChange, true)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [open, delayMs])
}
