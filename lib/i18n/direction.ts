import { BASE_LOCALE, LOCALES, type TextDirection } from '@/lib/i18n/locales'
import { LOCALE_PICK_COOKIE } from '@/lib/i18n/route-locale'

/**
 * Which way the page is read, and the one place that decides it.
 *
 * ── PURE, AND ON THE CLIENT SIDE OF THE LINE — `lib/i18n/locales.ts`' rule ──────────
 * No imports beyond the registry, no `server-only`, no database. Four things consume this and
 * they are on four different sides of every boundary this codebase has:
 *
 *   `app/layout.tsx`                   a Server Component, before any session exists
 *   `DIRECTION_BOOT_SCRIPT`            a string of JavaScript in `<head>`, before React
 *   `components/layout/LocaleSync.tsx` a client component, after hydration
 *   `scripts/rtl-check.mjs`            Node, with no bundler at all
 *
 * ── AND IT IS A SEPARATE MODULE FROM `locales.ts` FOR THE BOOT SCRIPT'S SAKE ───────
 * The script below is a STRING, and it has to hold the direction rule twice — once here in
 * TypeScript and once inside that string, because the string runs before any module of ours
 * exists. Two copies of a rule is what this codebase keeps warning about, so they are kept in
 * one file, adjacent, with `lib/i18n/direction.test.ts` asserting they agree by executing the
 * script's own logic against every locale. That test is the whole reason the duplication is
 * admissible.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────────────
 * NOT a per-component decision. A component must never ask "am I in RTL?" to choose a class:
 * every layout utility in `app/` and `components/` is a LOGICAL property (`ms-`, `pe-`,
 * `start-`, `text-start`, `border-s`, `rounded-s`), so the browser mirrors the whole tree from
 * this one attribute and no component has an opinion. `npm run i18n:rtl` is what holds that at
 * zero, and its header lists the three genuinely-physical exceptions.
 */

/** The default, and what an unrecognised locale reads as. */
export const DEFAULT_DIRECTION: TextDirection = 'ltr'

/**
 * The reading direction for a locale code.
 *
 * `'ltr'` for anything unrecognised, which is the same fall-through `localeFor` takes and is
 * right for the same reason: a locale the registry does not know is a locale nothing else in
 * the product can render either, and English is what it will fall back to.
 */
export function directionFor(code: string | null | undefined): TextDirection {
  return LOCALES.find(l => l.code === code)?.dir ?? DEFAULT_DIRECTION
}

/** Is this locale read right-to-left? For the rare case that genuinely needs the boolean. */
export function isRtl(code: string | null | undefined): boolean {
  return directionFor(code) === 'rtl'
}

/**
 * Every locale the product speaks that is read right-to-left, as codes.
 *
 * EMPTY TODAY, and that is a fact rather than a placeholder — see the note on `LOCALES`. It is
 * derived rather than listed so that adding an `rtl` row is the only edit: a hand-written list
 * beside the registry is the second copy this file exists to avoid.
 */
export const RTL_LOCALES: readonly string[] =
  LOCALES.filter(l => l.dir === 'rtl').map(l => l.code)

/**
 * Set `<html dir>` before the first paint.
 *
 * ── WHY A BOOT SCRIPT AND NOT `LocaleSync`'s `useEffect` ───────────────────────────
 * `app/layout.tsx` resolves `lang` from the URL and then `Accept-Language`, which is correct
 * for Home and for anybody not signed in — and on the Dashboard the member's STORED choice is
 * applied one level down, after hydration, by `LocaleSync`. For `lang` that is invisible: the
 * attribute changes and nothing on screen moves.
 *
 * For `dir` it is not invisible at all. The whole page would paint left-to-right and then flip,
 * which is the single most jarring thing this product could do to the reader it just started
 * speaking to. So the direction is decided in `<head>`, from the same cookie the language
 * picker already writes, exactly as `THEME_BOOT_SCRIPT` decides dark mode — and for the
 * identical reason, stated in `lib/theme.ts`: moved to the body or loaded as a file, it runs
 * after first paint and the flash it exists to prevent comes back.
 *
 * ── IT READS A COOKIE, NOT `localStorage` ──────────────────────────────────────────
 * `LOCALE_PICK_COOKIE` is what `LocaleSwitcher` writes and what `proxy.ts` reads at the edge,
 * so the direction and the routing agree about the reader's choice by construction. The theme
 * script reads `localStorage` because a theme is per-device and never crosses the wire; a
 * language does both.
 *
 * ── IT DOES NOTHING AT ALL WHILE NO RTL LOCALE IS SHIPPED ─────────────────────────
 * `RTL_LOCALES` is empty, so the interpolated list is `[]` and the script always resolves
 * `'ltr'`. It is deployed anyway rather than added with the first Arabic catalogue, because
 * this is the piece that is invisible when it is missing: a `dir` attribute nobody set looks
 * exactly like a `dir` attribute set correctly, until the day it does not.
 */
export const DIRECTION_BOOT_SCRIPT =
  `(function(){try{`
  + `var r=${JSON.stringify(RTL_LOCALES)};`
  + `if(!r.length)return;`
  // The cookie NAME is interpolated rather than typed into the string. A literal here would be
  // a second copy of `LOCALE_PICK_COOKIE` that no rename could find — the exact hazard
  // `lib/idle-timeout.ts` states about its own storage key.
  + `var m=document.cookie.match(new RegExp("(?:^|; )"+${JSON.stringify(LOCALE_PICK_COOKIE)}+"=([^;]*)"));`
  + `var c=m?decodeURIComponent(m[1]):"";`
  + `document.documentElement.dir=r.indexOf(c)>=0?"rtl":"ltr"`
  + `}catch(e){}})()`

/**
 * The direction for the language the product falls back to. Exported so the boot script's test
 * has something to compare an unknown cookie value against without restating `'ltr'`.
 */
export const BASE_DIRECTION: TextDirection = directionFor(BASE_LOCALE)
