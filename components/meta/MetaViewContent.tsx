'use client'

import { useEffect } from 'react'
import { VIEW_CONTENT, type ViewContentKey } from '@/lib/meta/events'
import { onPixelReady, trackPixelEvent } from '@/lib/meta/pixel'

/**
 * Declare that this page is commercially meaningful content.
 *
 * Dropped into a marketing page's JSX and given a key from the `VIEW_CONTENT` catalogue:
 *
 *     <MetaViewContent content="pricing" />
 *
 * ── WHY A KEY AND NOT A STRING ──────────────────────────────────────────────────────
 * `ViewContent` is the event most likely to grow a free-text parameter, because the obvious
 * implementation is to pass the page title — and in this product a page title can be a
 * family's name. The prop is a `ViewContentKey`, so the set of things this event can ever
 * say is fixed in `lib/meta/events.ts` and reviewed there. There is no overload that takes
 * a string.
 *
 * ── WHY IT IS PIXEL-ONLY, AND WHAT THAT COSTS ───────────────────────────────────────
 * There is no Conversions API counterpart. Sending one would mean reading cookies and
 * headers during the render of `/pricing`, `/features` and Home — which makes those pages
 * DYNAMIC. They are the pages an advertising click lands on, they are statically generated
 * today, and trading their time-to-first-byte for a duplicate of an event the browser is
 * already reporting is the wrong way round: the whole point of a fast landing page is that
 * the visitor is still there to convert.
 *
 * The cost is honest and worth stating: a visitor whose Pixel is blocked contributes no
 * ViewContent. That weakens a mid-funnel retargeting audience. It does not weaken any
 * CONVERSION, because every conversion in this integration is server-authoritative and
 * reaches Meta whether or not the browser can — which is the half that actually matters.
 *
 * ── ONCE PER MOUNT ──────────────────────────────────────────────────────────────────
 * The effect has an empty dependency list and unsubscribes on unmount, so navigating away
 * before the script loads reports nothing. Navigating between two marketing pages remounts
 * the component and correctly reports the second one.
 */
export function MetaViewContent({ content }: { content: ViewContentKey }) {
  useEffect(() => {
    const entry = VIEW_CONTENT[content]
    return onPixelReady(() => {
      trackPixelEvent('ViewContent', {
        customData: { content_name: entry.name, content_category: entry.category },
      })
    })
  }, [content])

  return null
}
