/**
 * The browser half. A thin, typed wrapper over `fbq`, and the base code that installs it.
 *
 * ── WHY PRODUCT CODE NEVER CALLS `fbq` DIRECTLY ─────────────────────────────────────
 * `fbq` is a global that takes strings and accepts anything as its payload — so a direct
 * call is an unchecked route past every control in this integration at once: it can invent
 * an event name the server never sends (and so can never deduplicate against), it can omit
 * `eventID` (and so double-count), and it can serialise an entire application object into
 * an ad platform. `trackPixelEvent` closes all three: the name is a `MetaEventName`, the
 * payload goes through the same `buildCustomData` allow-list the server uses, and passing
 * an id is a named argument rather than a convention to remember.
 *
 * ── NO SERVER IMPORTS MAY EVER APPEAR IN THIS FILE ──────────────────────────────────
 * It is imported by `'use client'` components, so anything it imports is in the browser
 * bundle. `lib/meta/events.ts` is pure and safe. `lib/meta/hash.ts`, `event-id.ts`,
 * `capi.ts`, `dispatch.ts` and `config.ts` are NOT — the first two pull in `node:crypto`
 * and the rest read secrets — and `lib/meta/no-client-secrets.test.ts` asserts that none of
 * them is reachable from here.
 *
 * The Pixel id is not imported either. It arrives as a PROP from the server layout, which
 * is what makes the "is this deployment allowed to track?" decision a single one — see
 * lib/meta/config.ts.
 */

import { buildCustomData, type MetaCustomData, type MetaEventName, isStandardEvent } from '@/lib/meta/events'

declare global {
  interface Window {
    fbq?: FbqFunction & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] }
    _fbq?: unknown
  }
}

type FbqFunction = (...args: unknown[]) => void

/** Has the base code run? False during SSR and before the script loads. */
export function pixelReady(): boolean {
  return typeof window !== 'undefined' && typeof window.fbq === 'function'
}

/**
 * The base code, with two deliberate departures from the snippet Meta hands out.
 *
 * 1. `fbq('set', 'autoConfig', false, <id>)` BEFORE `init`. This is requirement "do not
 *    enable unsafe automatic form scraping", enforced in code rather than left to an
 *    Events Manager toggle somebody can flip back. Automatic configuration is what lets
 *    the Pixel send button-click text and page metadata of its own accord — on a product
 *    whose buttons say things like "Add Sydnee as a daughter" and whose page titles can
 *    contain a family's surname, that is private family content leaving the building
 *    because somebody clicked. Off, at the source, on every page.
 *
 *    It must come before `init`; after it, the first page's automatic collection has
 *    already happened.
 *
 * 2. NO `fbq('track', 'PageView')` here. The base code normally fires one immediately, and
 *    `MetaPixel` fires it instead — from a single effect that also handles client-side
 *    navigation. Two mechanisms firing PageView is the commonest duplicate-event
 *    diagnostic in a React app, and the way it usually arrives is exactly this: the
 *    snippet's own call, plus the one somebody added for the router.
 *
 * Note this does NOT disable Automatic Advanced Matching, which is a dataset-level setting
 * in Events Manager rather than anything the snippet controls. It must be turned off there
 * too — lib/meta/README.md carries it as a required manual step, and it is the single most
 * important box to untick for this product.
 */
export function pixelBaseScript(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,'${pixelId}');
fbq('init','${pixelId}');`
}

/**
 * Report an event from the browser.
 *
 * `eventId` IS NOT OPTIONAL IN PRACTICE for anything the server also sends. It is typed as
 * nullable because two events in this product are Pixel-only and genuinely have no id —
 * `PageView` and `ViewContent` — and forcing a caller to invent one for those would be
 * worse than allowing null: an invented id is one the server can never match, which looks
 * like deduplication working and is not.
 *
 * Silently does nothing when the Pixel has not loaded. That is the normal state on a
 * deployment with tracking off and on any visit where consent was refused, and it is why
 * every call site can be unconditional.
 */
export function trackPixelEvent(
  name: MetaEventName,
  options?: { eventId?: string | null; customData?: MetaCustomData | null },
): void {
  if (!pixelReady()) return

  // Standard events go through `track`; custom ones through `trackCustom`. Sending a custom
  // name to `track` is accepted and then reported in Events Manager as an unrecognised
  // standard event, which is how `CreateFamily` would end up looking like a broken
  // `Purchase` rather than like the custom event it is.
  const method = isStandardEvent(name) ? 'track' : 'trackCustom'
  const payload = buildCustomData(options?.customData)
  const eventId = options?.eventId

  window.fbq?.(
    method,
    name,
    payload,
    ...(eventId ? [{ eventID: eventId }] : []),
  )
}

/**
 * PageView, which is its own function because it is the one event with a rule attached:
 * exactly once per page shown, and never twice for one.
 */
export function trackPixelPageView(): void {
  if (!pixelReady()) return
  window.fbq?.('track', 'PageView')
}

/* ────────────────────────────────────────────────────────────────────────────────────
 * "HAS THE SCRIPT ARRIVED YET?"
 *
 * A component that wants to report something on mount — `MetaViewContent` is the one — has
 * a race with `next/script`: the effect can run before the base code has been injected, and
 * `trackPixelEvent` then silently does nothing. Silently, because the whole wrapper is
 * built to no-op when the Pixel is absent, which is right for a deployment with tracking
 * off and wrong for a page that is 200ms early.
 *
 * Polling was the obvious fix and is worse: it either gives up too soon on a slow
 * connection or leaves a timer running on every page for a script that is never coming.
 * A one-shot registry costs nothing and is exact — and it has to answer LATE ARRIVALS as
 * well as early ones, because a page navigated to after the script loaded has a component
 * subscribing to an event that already fired. Hence the flag as well as the queue.
 * ──────────────────────────────────────────────────────────────────────────────────── */

let scriptReady = false
const waiting: Array<() => void> = []

/** Called by `MetaPixel` once `next/script` reports the base code has run. */
export function markPixelReady(): void {
  scriptReady = true
  while (waiting.length > 0) waiting.shift()?.()
}

/**
 * Run `callback` when the Pixel is usable — immediately if it already is.
 *
 * Returns a cancel function, so a component that unmounts before the script arrives does
 * not fire an event for a page nobody is looking at any more.
 */
export function onPixelReady(callback: () => void): () => void {
  if (scriptReady) {
    callback()
    return () => {}
  }
  waiting.push(callback)
  return () => {
    const index = waiting.indexOf(callback)
    if (index >= 0) waiting.splice(index, 1)
  }
}
