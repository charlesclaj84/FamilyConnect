import type { MetadataRoute } from 'next'
import { APP_NAME, APP_DESCRIPTION, APP_LEAD, BRAND_THEME_COLOR } from '@/lib/brand'

/**
 * The web app manifest — what an installed GENORRA looks like on a home screen.
 *
 * ── THE ICONS ARE THE FULL-COLOUR TILE, SINCE 2026-08-22 ──────────────────────
 * They were the kit's DARK app icon — the gold mark on a Heritage burgundy tile —
 * on the argument that a small self-contained mark wants maximum contrast and that
 * the Light tile "disappears into a pale home-screen wallpaper". That argument was
 * about legibility and it lost to a plainer one: what an installed GENORRA shows on
 * a home screen is the only place most members ever see the mark at icon size, and
 * the gold-on-burgundy treatment is monochrome — it does not look like the brand
 * people meet on the site, where the rail draws the FULL-COLOUR mark at 64px
 * (`components/layout/Sidebar.tsx`). A member who installed it reported exactly
 * that: the icon "wasn't colorful".
 *
 * So these are `App_Icons/GENORRA_AppIcon_Light_*` — the full-colour mark on the
 * kit's cream tile. It is a TILE and not a transparent mark, so the wallpaper
 * worry does not apply the way it would to a bare glyph: the ground is part of the
 * artwork, and a cream square reads as an icon on a dark or a busy wallpaper alike.
 * `app/apple-icon.png` is the 180px export of the same tile, so iOS and Android
 * show one icon rather than two.
 *
 * `background_color` stays the dark ground on purpose. It is the SPLASH behind the
 * icon, not the icon's own ground, and the brand's splash is Heritage-dark whichever
 * tile sits on it — the gold one for a year, the colour one now.
 *
 * MAIL USES THIS TILE TOO, SINCE 2026-08-26 — and it did not for four days. The five
 * auth templates and `lib/email/layout.ts` pointed at
 * `public/identity/genorra-mail-mark-256.png`, the gold-on-burgundy tile, because the
 * email header's band is `#6b2d3a` and that tile has the same burgundy baked into its
 * ground, so it DISAPPEARED into the band. Elegant, and it left mail as the only
 * surface where GENORRA was monochrome — the same complaint that moved this manifest,
 * one surface later. They share this file again, with a `border-radius` on the mail
 * `<img>` so the cream ground reads as a badge on the band.
 *
 * SO A THIRD SURFACE WANTING A DIFFERENT TILE NOW HAS TO SPLIT THE FILE AGAIN, and the
 * gold one is still in `public/identity/` for exactly that. Do not repoint this at it:
 * an installed icon must be the full-colour mark, which is the whole reason this
 * paragraph exists. `supabase/templates/README.md` records both directions.
 *
 * The burgundy mark is still right at favicon scale, which is why `app/favicon.ico`
 * and the kit's own favicons are neither tile. Do not sweep those to match this.
 *
 * `sizes` are the kit's real exports and must stay honest — a manifest that lies
 * about a size makes the browser scale it and the mark goes soft. Kit v1.0 had no
 * 192px, so this declared 256; v1.1 added a real one, and 192 + 512 is the pair
 * Android actually looks for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_LEAD}`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: BRAND_THEME_COLOR.dark,
    theme_color: BRAND_THEME_COLOR.light,
    icons: [
      { src: '/identity/genorra-app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/identity/genorra-app-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/identity/genorra-app-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
