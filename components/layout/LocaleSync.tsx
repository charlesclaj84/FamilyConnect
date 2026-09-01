'use client'

import { useEffect } from 'react'

import { directionFor } from '@/lib/i18n/direction'

/**
 * Correct `<html lang>` and `<html dir>` to the member's own choice.
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
 * ── `dir` IS HERE AS A BACKSTOP, NOT AS THE MECHANISM ───────────────────────────────
 * `DIRECTION_BOOT_SCRIPT` is what actually decides the direction, in `<head>`, before the first
 * paint — because unlike `lang`, getting `dir` wrong is not an invisible attribute change but
 * the entire page laid out backwards and then flipping. That script reads the cookie
 * `setMyLocale` mirrors the member's choice into.
 *
 * This runs anyway, and covers the one case the cookie cannot: a member signing in on a browser
 * that has never had the cookie — a new device, a cleared jar, a private window. They get one
 * left-to-right paint and this corrects it, and `setMyLocale` is not what fixes that because
 * they did not change anything. The cost of being wrong here is a visible flip; the cost of not
 * being here is a page that stays backwards until they next change a setting.
 *
 * Renders nothing.
 */
export function LocaleSync({ locale }: { locale: string }) {
  useEffect(() => {
    if (!locale) return
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale
    }
    const dir = directionFor(locale)
    if (document.documentElement.dir !== dir) {
      document.documentElement.dir = dir
    }
  }, [locale])

  return null
}
