'use client'

import { useEffect } from 'react'
// FROM `lib/tz` AND NOT `lib/auth/zone`: that module imports the service-role client,
// so importing the constant from there would ship it in the browser bundle.
import { ZONE_HINT_COOKIE } from '@/lib/tz'

/**
 * Tell the server which timezone this browser is in.
 *
 * ── WHY A COOKIE AND NOT A PROP ─────────────────────────────────────────────────────
 * Almost every date in the product is printed by a SERVER component, and the server has no
 * way to know the reader's zone — `Intl.DateTimeFormat().resolvedOptions().timeZone` is a
 * browser fact. Without this the fallback for a member who has never opened My Profile is
 * `America/Chicago`, which is right for most families and wrong for the rest.
 *
 * So the browser writes what it knows, once, and `resolveZone` reads it on the next request.
 * That is the only mechanism available: there is no round trip on a first render to ask.
 *
 * ── IT IS A HINT, NOT AN AUTHORITY, AND THAT IS WHAT MAKES IT SAFE ──────────────────
 * Written by client-side JavaScript, so a member can set it to anything. The worst a forged
 * value achieves is that the forger sees their own dates in a zone of their choosing — it
 * decides no permission, no money and no deadline, and `people.time_zone` beats it whenever
 * the member has stated one. `resolveZone` validates it against `Intl` before using it.
 *
 * **Do not put anything else in this cookie.** The moment a value in it is read by something
 * that grants access, it stops being a hint and becomes a spoofable credential.
 *
 * ── FOUR THINGS ABOUT HOW IT IS WRITTEN ─────────────────────────────────────────────
 *   * **Only when it CHANGES.** Writing on every mount would touch the cookie jar on every
 *     navigation for no benefit. Reading first also means a member who travels gets the new
 *     zone on the first page they load there.
 *   * **`SameSite=Lax`, not `None`.** It is read only by our own server on a top-level
 *     request, which is exactly what Lax admits.
 *   * **No `Secure` in development.** Hard-coding it would make the cookie silently fail to
 *     set on `http://localhost`, so the whole mechanism would look broken locally and work
 *     in production — the worst way round.
 *   * **It never calls `markIdleActivity()`.** Same rule as `ShellWatcher`: this runs without
 *     anybody at the keyboard, and marking activity here would keep every open tab alive
 *     forever and defeat the 60-minute sign-out.
 *
 * Renders nothing. Mounted once by `app/(protected)/layout.tsx`, beside `IdleTimeout` and
 * outside `<main key={familyCode}>` — a zone is a property of the person, not of the family
 * they happen to be looking at, so it must not remount on a family switch.
 */
export function ZoneHint() {
  useEffect(() => {
    let zone: string
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return
    }
    if (!zone) return

    const current = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${ZONE_HINT_COOKIE}=`))
      ?.slice(ZONE_HINT_COOKIE.length + 1)

    if (current === encodeURIComponent(zone)) return

    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    // A year, refreshed whenever the browser reports something different. Long because the
    // answer changes when somebody moves house, not when their session ends.
    document.cookie =
      `${ZONE_HINT_COOKIE}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
  }, [])

  return null
}
