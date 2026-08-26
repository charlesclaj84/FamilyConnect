'use client'

import { useEffect } from 'react'

/**
 * Correct `<html lang>` to the member's own choice.
 *
 * ── WHY THIS IS NOT JUST DONE IN THE LAYOUT ─────────────────────────────────────────
 * `<html>` lives in `app/layout.tsx`, which wraps all four products — Home, the auth pages, the
 * Dashboard and the Staff console — and therefore cannot resolve a caller: doing so would put a
 * `getUser()` round trip and a `people` read on every load of the marketing site. So the root
 * layout negotiates `Accept-Language`, which is free and correct for a first-time visitor, and
 * this puts the member's STORED preference on top once there is a member.
 *
 * The same division `resolveZone` and `ZoneHint` already use, and the same Home-versus-Dashboard
 * split the whole localization plan is built on.
 *
 * ── IT IS AN ATTRIBUTE, NOT CONTENT ─────────────────────────────────────────────────
 * `lang` is what a screen reader uses to choose pronunciation and what a browser uses for
 * hyphenation and spell-checking. Getting it wrong is not a rendering bug anybody sees — which
 * is exactly why it would go unnoticed, and why it is worth a component rather than a TODO.
 *
 * Mutating the element directly rather than through React is deliberate and matches the theme
 * boot script: `<html>` is rendered by a layout this component is nowhere near, and its `lang`
 * is already covered by that element's `suppressHydrationWarning`.
 *
 * Renders nothing.
 */
export function LocaleSync({ locale }: { locale: string }) {
  useEffect(() => {
    if (locale && document.documentElement.lang !== locale) {
      document.documentElement.lang = locale
    }
  }, [locale])

  return null
}
