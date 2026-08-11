import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { APP_BANNER_ALT } from '@/lib/brand'

/**
 * The link preview card — what a texted GENORRA link looks like in iMessage,
 * WhatsApp, Slack, Discord and everywhere else.
 *
 * A file convention, not a `metadata.openGraph.images` entry: Next discovers
 * `app/opengraph-image.tsx`, renders it at build time, and emits `og:image`
 * plus the `og:image:width` / `:height` / `:alt` tags with it. Declaring images
 * in the metadata object as well would emit duplicates.
 *
 * ── Why the lockup is a PNG and not the SVG ──────────────────────────────────
 * This renders through satori, which is not a browser. It implements a subset
 * of CSS and has no font stack of its own — any *text* here needs its typeface
 * passed in as raw font data, and Cormorant Garamond is loaded by next/font,
 * which gives no such handle. Compositing the horizontal lockup export instead
 * sidesteps the whole problem: the wordmark, tagline and values are already
 * vector-drawn-to-raster in that asset, so the card carries the real brand
 * typography with zero fonts loaded. Satori's SVG support is also patchier than
 * its PNG support, and these masters are 49KB with gradients.
 *
 * The Dark lockup is the one for dark grounds — cream wordmark, colour mark —
 * so it is the correct pairing for the Heritage field behind it. Putting the
 * Light lockup here would render cream-on-cream and vanish.
 */
export const alt = APP_BANNER_ALT

// 1200x630 is the 1.91:1 that Facebook, iMessage, Slack and Twitter all size
// their large cards to. Smaller than 1200 wide and several of them decline the
// large card and fall back to a thumbnail.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Straight from the palette in globals.css. Repeated as literals because
// satori resolves no custom properties — there is no document here for a
// `var(--genorra-heritage)` to inherit from.
const HERITAGE_DEEP = '#46232c'
const HERITAGE = '#6b2d3a'
const LEGACY = '#d6a24a'

export default async function OpengraphImage() {
  // A TRIMMED derivative, not the raw master. The v1_1 export is 2048x626 with
  // only 1403x411 of actual art in it — 31% of its width is transparent margin,
  // and unevenly distributed, so dropping the master straight in rendered the
  // lockup both undersized and visibly left of centre. Regenerate with sharp's
  // `.trim()` from GENORRA_Horizontal_Dark_4096px.png if the master ever changes.
  const lockup = await readFile(
    join(process.cwd(), 'public', 'identity', 'genorra-lockup-dark-og.png'),
  )
  const lockupSrc = `data:image/png;base64,${lockup.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          // The hero's own treatment: a flat burgundy field lifted by a
          // diagonal so it does not read as a plain colour block.
          backgroundImage: `linear-gradient(135deg, ${HERITAGE_DEEP} 0%, ${HERITAGE} 55%, ${HERITAGE_DEEP} 100%)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori renders
            plain <img> only; next/image has no meaning outside a browser. */}
        <img src={lockupSrc} alt="" width={900} height={264} style={{ objectFit: 'contain' }} />

        {/* The gold diamond on a hairline — the same divider the hero uses
            under its lockup, so the card and the page it opens agree. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34, width: 420 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: LEGACY, opacity: 0.35 }} />
          <div style={{ width: 9, height: 9, backgroundColor: LEGACY, opacity: 0.85, transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: 1, backgroundColor: LEGACY, opacity: 0.35 }} />
        </div>
      </div>
    ),
    size,
  )
}
