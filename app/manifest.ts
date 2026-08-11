import type { MetadataRoute } from 'next'
import { APP_NAME, APP_DESCRIPTION, APP_LEAD, BRAND_THEME_COLOR } from '@/lib/brand'

/**
 * The web app manifest — what an installed GENORRA looks like on a home screen.
 *
 * Icons come from the kit's DARK app icon: the gold mark on a Heritage burgundy
 * tile. That is the brand's own answer for a small, self-contained, high-contrast
 * mark, and it is what the brand board presents. The Light tile (cream ground) is
 * the wrong choice here — it disappears into a pale home-screen wallpaper, which
 * is exactly the case an app icon has to survive.
 *
 * `sizes` are the kit's real exports. There is no 192px in the package, so this
 * declares 256 rather than shipping a 180 renamed to 192 — a manifest that lies
 * about a size makes the browser scale it and the mark goes soft.
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
      { src: '/identity/genorra-app-256.png', sizes: '256x256', type: 'image/png' },
      { src: '/identity/genorra-app-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
