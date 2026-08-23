'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { markPixelReady, pixelBaseScript, trackPixelPageView } from '@/lib/meta/pixel'
import { readBrowserConsent, subscribeToConsent, type ConsentDecision } from '@/lib/consent'

/**
 * The Meta Pixel, mounted once by the root layout.
 *
 * ── FOUR THINGS IT GUARANTEES ───────────────────────────────────────────────────────
 *
 * 1. IT LOADS ONLY WHEN IT MAY. `pixelId` is null on any deployment `metaMode()` says is
 *    not allowed to track, so a developer laptop and a preview build render nothing at all
 *    — the script is not merely inert, it is absent. And it loads only once consent
 *    resolves to 'granted'; there is no "load it and hold the events back", because the
 *    script sets `_fbp` on load, and setting an identifier is the thing consent governs.
 *
 * 2. EXACTLY ONE PageView PER PAGE. This is the single commonest defect in a Pixel
 *    integration on a React router, and it has two independent causes, both closed here:
 *    Meta's base snippet normally fires its own PageView (removed — see `pixelBaseScript`),
 *    and a naive effect re-fires on every render or every query-string change. The
 *    `lastReported` ref makes the effect idempotent per path, and `usePathname()` excludes
 *    search parameters deliberately: this product uses `?tab=` and `?ledger=` to switch
 *    PANES of one screen, and a PageView per pane switch would inflate every page-view
 *    figure in the account and make the funnel's first stage meaningless.
 *
 * 3. IT WAITS FOR THE SCRIPT. `onReady` rather than a bare effect. The base snippet defines
 *    `window.fbq` synchronously with a queue, so a call after it is safe — but the effect
 *    can run BEFORE `next/script` has injected anything, and a PageView dropped on the
 *    floor at that point is the first page of every visit, which is the one that carries
 *    the ad click.
 *
 * 4. IT REACTS TO A CONSENT CHANGE WITHOUT A RELOAD. `useSyncExternalStore` over the cookie
 *    — the same instrument `ThemeToggle` uses and for the same reason: the value lives
 *    outside React, and reading it during render is a hydration mismatch while correcting
 *    it from an effect is a cascading render React Compiler rejects. Somebody who accepts
 *    on the banner gets the Pixel immediately, which matters because the page they accepted
 *    on is usually the ad landing page.
 *
 * ── AND ONE THING IT DELIBERATELY DOES NOT DO ───────────────────────────────────────
 * It sends no `ViewContent`, no conversion, nothing but PageView. Everything else is
 * declared by the screen that owns it — `MetaViewContent` for content, and the server for
 * every conversion. A component that decided from the URL which conversions to fire would
 * be a second, weaker copy of the funnel living in the browser.
 */
export function MetaPixel({
  pixelId,
  defaultConsent,
}: {
  /** Null when this deployment must not track. Then this component renders nothing. */
  pixelId: string | null
  /**
   * What consent means when the visitor has not chosen — `consentDefault()`, read from the
   * environment on the server.
   *
   * IT IS THE DEFAULT AND NOT THE VISITOR'S ANSWER, deliberately. Resolving the actual
   * cookie on the server would mean calling `cookies()` in the root layout, which opts
   * EVERY route in the product — including the statically generated marketing pages an
   * advertisement lands on — into dynamic rendering. Trading the landing page's
   * time-to-first-byte for a slightly earlier Pixel is the wrong way round; the cookie is
   * read below, on hydration, which costs one render.
   */
  defaultConsent: ConsentDecision
}) {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const lastReported = useRef<string | null>(null)

  // Server snapshot is the deployment's default, so the static HTML is the same for every
  // visitor; the browser's own cookie takes over on hydration and on every change after it.
  const consent = useSyncExternalStore(
    subscribeToConsent,
    () => readBrowserConsent() ?? defaultConsent,
    () => defaultConsent,
  )

  const enabled = Boolean(pixelId) && consent === 'granted'

  useEffect(() => {
    if (!enabled || !ready) return
    if (lastReported.current === pathname) return
    lastReported.current = pathname
    trackPixelPageView()
  }, [enabled, ready, pathname])

  if (!enabled || !pixelId) return null

  return (
    <>
      <Script
        id="meta-pixel"
        // `afterInteractive` rather than `beforeInteractive`: the Pixel is measurement, and
        // blocking hydration on a third-party script to record a page view is a trade
        // against the thing being measured. `lazyOnload` would be worse than either — it
        // waits for the window load event, which on a slow connection is long enough for
        // somebody to have bounced before the visit was recorded.
        strategy="afterInteractive"
        onReady={() => {
          // Two audiences. `setReady` drives this component's own PageView effect;
          // `markPixelReady` releases every other component waiting to report something
          // on mount — see `onPixelReady` in lib/meta/pixel.ts.
          markPixelReady()
          setReady(true)
        }}
        dangerouslySetInnerHTML={{ __html: pixelBaseScript(pixelId) }}
      />
      {/*
        The no-script fallback Meta's snippet ships with. It reports a PageView for visitors
        running without JavaScript, which the effect above cannot reach. It carries no
        identifiers of its own beyond what the request already sends, and it renders only
        under the same consent gate as everything else.

        `<img>` rather than `next/image` on purpose: this is a tracking beacon, not
        artwork — it must not be optimised, proxied through our own domain, or lazy-loaded,
        and there is nothing to lay out. eslint's rule about `<img>` is about images.
      */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}
