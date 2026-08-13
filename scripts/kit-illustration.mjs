#!/usr/bin/env node
/**
 * Derive the Dashboard kit's tree illustration into an asset the app can actually serve,
 * and prove afterwards that the committed asset still matches the kit.
 *
 *   npm run art:build     write components/dashboard/illustrations/family-tree.png
 *   npm run art:check     verify the committed PNG against the kit; exit 1 on drift
 *
 * ── WHY THE KIT'S OWN SVG IS NOT SHIPPED ────────────────────────────────────────────
 * `03_VECTOR_ASSETS/FamilyTree_Golden_ExactPixelVector.svg` is not a vector. It is 10,490
 * `<rect>` elements, almost all of them one unit square, filled with the colour of one
 * pixel — a 180x205 BITMAP wearing an SVG hat. 608 KB on the wire, ~62 KB gzipped, and
 * ten thousand nodes for the browser to build for a decorative illustration in a dashboard
 * card. It also scales no better than the bitmap it was traced from, which is the only
 * thing anybody wants an SVG for.
 *
 * The other candidate, `FamilyTree_Golden_DirectTrace.svg`, is 19 KB of real paths and is
 * a BROKEN trace: `09_PREVIEW/FamilyTree_Golden_DirectTrace.png` shows severed branches
 * and leaves floating in mid-air. It is not usable at any size.
 *
 * So the artwork is treated as what it is — a 180x205 raster — and this script produces
 * the version the kit did not ship: the same pixels with the cream matte lifted into an
 * alpha channel, so the illustration composites onto the card's own ground in either
 * theme instead of carrying a pale rectangle around with it.
 *
 * ── NO OVERSIMPLIFICATION, and it is checked rather than asserted ────────────────────
 * `08_QA/NO_OVERSIMPLIFICATION.md` asks that kit artwork not be redrawn or approximated.
 * Nothing here redraws anything: every pixel comes from the kit, `verifyAgainstVector()`
 * confirms the reference bitmap and the kit's rect-per-pixel SVG agree on every pixel the
 * SVG emits, and `check` recomposites the derived PNG back onto the kit's cream ground and
 * fails if any channel has moved more than TOLERANCE.
 *
 * ── WHEN TO RUN IT ──────────────────────────────────────────────────────────────────
 * After bumping the kit. AGENTS.md's rule for `public/identity/` — re-copy and `cmp` every
 * file, because a kit bump that leaves the previous round's artwork in place fails
 * silently, and did — applies with more force to a DERIVED asset, which no `cmp` against
 * the kit can catch. `art:check` is that cmp.
 *
 * ── DEPENDENCY ──────────────────────────────────────────────────────────────────────
 * `sharp`, which arrives with Next rather than being declared here: this is a one-off
 * authoring tool, not part of the build, and adding a direct dependency for it would put
 * a ~30 MB native package in the lockfile for a script that runs once a year. If the
 * import fails, `npm i` and try again.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let sharp
try {
  sharp = createRequire(resolve(ROOT, 'package.json'))('sharp')
} catch {
  // Reported rather than thrown, because the raw ERR_MODULE_NOT_FOUND names a package
  // nothing in package.json asks for and reads as a broken repo. It is Next's OPTIONAL
  // dependency, so an install with `--omit=optional` legitimately has no sharp — which is
  // also why this script is a command somebody runs rather than a step in verify.yml.
  console.error(
    'sharp is not installed. It arrives as an optional dependency of Next rather than a '
    + 'direct one — see the header of this file for why. Run `npm i` and try again.',
  )
  process.exit(2)
}

const KIT = resolve(ROOT, 'public/dashboard')
const SOURCE_BITMAP = resolve(KIT, '01_REFERENCE/FamilyTree_Golden_Crop.png')
const SOURCE_VECTOR = resolve(KIT, '03_VECTOR_ASSETS/FamilyTree_Golden_ExactPixelVector.svg')
const TARGET = resolve(ROOT, 'components/dashboard/illustrations/family-tree.png')

/**
 * The ground the artwork was drawn on — Nurturing sand lightened almost to white, and the
 * modal colour of 3,380 pixels in the reference crop. It is the `bg` term in the unmix
 * below, so it is a measurement rather than a preference: change it and every recovered
 * colour moves.
 */
const MATTE = [251, 248, 244]

/**
 * A channel this close to the matte is the source's own noise, not artwork.
 *
 * The reference crop holds 8,940 distinct colours in 36,900 pixels — it has been through
 * a lossy encoder at some point — so the "background" is a cloud around MATTE rather than
 * one value. Without a floor, every one of those 26,410 background pixels comes out very
 * slightly opaque and the illustration ships a faint grey haze that is invisible on cream
 * and obvious on a dark card.
 */
const NOISE_FLOOR = 5

/** How far a recomposited channel may drift from the kit before `check` fails. */
const TOLERANCE = 12

/**
 * Lift a light matte into an alpha channel.
 *
 * Every pixel of the source is `p = a*c + (1 - a)*bg` for some coverage `a` and some ink
 * colour `c`, both unknown. One equation, two unknowns — but for DARK ink on a LIGHT
 * ground the channel that moved furthest from `bg` is the one nearest full coverage, so
 * taking `a` from it and then solving for `c` is exact wherever the ink is saturated in
 * any channel, and close everywhere else. `check` is what confirms "close enough".
 *
 * A pixel LIGHTER than the matte contributes nothing and stays transparent: there is no
 * ink lighter than the ground in this artwork, so those are encoder ringing.
 */
function unmatte(rgb, width, height, channels) {
  const out = Buffer.alloc(width * height * 4, 0)

  for (let i = 0; i < width * height; i++) {
    const p = [rgb[i * channels], rgb[i * channels + 1], rgb[i * channels + 2]]

    let a = 0
    for (let k = 0; k < 3; k++) {
      const drop = MATTE[k] - p[k]
      if (drop <= NOISE_FLOOR) continue
      const candidate = drop / MATTE[k]
      if (candidate > a) a = candidate
    }
    if (a <= 0) continue

    const o = i * 4
    for (let k = 0; k < 3; k++) {
      const c = (p[k] - (1 - a) * MATTE[k]) / a
      out[o + k] = Math.max(0, Math.min(255, Math.round(c)))
    }
    out[o + 3] = Math.round(a * 255)
  }

  return out
}

/**
 * Confirm the reference bitmap really is what the kit's "exact pixel vector" was traced
 * from, so deriving from the bitmap is not a shortcut past the SVG.
 *
 * Only the pixels the SVG EMITS are compared. The ~26,000 it omits are the matte, and
 * their absence is the SVG's own statement that they are background — which is the same
 * claim `unmatte` makes about them from the other direction.
 */
function verifyAgainstVector(rgb, width, height, channels) {
  const svg = readFileSync(SOURCE_VECTOR, 'utf8')

  const box = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
  if (!box) throw new Error(`${SOURCE_VECTOR}: no viewBox`)
  if (Number(box[1]) !== width || Number(box[2]) !== height) {
    throw new Error(
      `kit disagrees with itself: SVG is ${box[1]}x${box[2]}, bitmap is ${width}x${height}`,
    )
  }

  const rects = [...svg.matchAll(
    /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="#([0-9A-Fa-f]{6})"\/>/g,
  )]
  if (rects.length === 0) throw new Error(`${SOURCE_VECTOR}: parsed no rects`)

  let compared = 0, worst = 0, worstAt = null
  for (const [, x, y, w, h, hex] of rects) {
    const fill = [
      parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16),
    ]
    // Almost every rect is 1x1; a few hundred are horizontal runs. Walk whatever it covers.
    for (let dy = 0; dy < Number(h); dy++) {
      for (let dx = 0; dx < Number(w); dx++) {
        const px = Number(x) + dx, py = Number(y) + dy
        if (px >= width || py >= height) continue
        const i = (py * width + px) * channels
        compared++
        for (let k = 0; k < 3; k++) {
          const d = Math.abs(rgb[i + k] - fill[k])
          if (d > worst) { worst = d; worstAt = `(${px},${py})` }
        }
      }
    }
  }

  // The kit's two files came out of two different exporters, so a channel or two of
  // rounding between them is expected. Anything more means they are not the same artwork.
  if (worst > 4) {
    throw new Error(
      `the reference bitmap and the kit's pixel vector disagree by ${worst} at ${worstAt}. `
      + 'One of them has been replaced without the other. Re-copy the kit.',
    )
  }
  return { rects: rects.length, compared, worst }
}

async function derive() {
  const { data, info } = await sharp(SOURCE_BITMAP).raw().toBuffer({ resolveWithObject: true })
  const agreement = verifyAgainstVector(data, info.width, info.height, info.channels)
  const rgba = unmatte(data, info.width, info.height, info.channels)

  // `palette: false` IS LOAD-BEARING TWICE OVER, and it is not the default it looks like.
  // Passing `effort` at all makes sharp 0.34 quantise to a 256-colour palette — 11 KB
  // instead of 33 KB, which is tempting until you notice what it costs. The artwork holds
  // 8,940 distinct colours in 36,900 pixels, so quantising bands every soft edge on it;
  // and it breaks `check` outright, because a palettised round trip cannot return the
  // pixels that went in, leaving nothing to compare against the kit.
  //
  // The wire size is not this file's problem. `next/image` re-encodes to WebP or AVIF per
  // request, so what is committed is the MASTER and is kept lossless on purpose.
  const png = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png({ compressionLevel: 9, palette: false }).toBuffer()

  return { png, rgba, info, agreement, source: data }
}

/** Recomposite `rgba` onto the kit's matte and report how far it lands from the source. */
function residual(rgba, source, width, height, channels) {
  let worst = 0, sum = 0, over = 0
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3] / 255
    for (let k = 0; k < 3; k++) {
      const back = a * rgba[i * 4 + k] + (1 - a) * MATTE[k]
      const d = Math.abs(Math.round(back) - source[i * channels + k])
      sum += d
      if (d > TOLERANCE) over++
      if (d > worst) worst = d
    }
  }
  return { mean: sum / (width * height * 3), worst, over }
}

const mode = process.argv[2] ?? 'check'
const { png, rgba, info, agreement, source } = await derive()
const res = residual(rgba, source, info.width, info.height, info.channels)

console.log(
  `kit: ${info.width}x${info.height}; `
  + `${agreement.rects} rects covering ${agreement.compared} px agree to within ${agreement.worst}`,
)
console.log(
  `derived: ${(png.length / 1024).toFixed(1)} KB; `
  + `recomposited mean |d| ${res.mean.toFixed(2)}, max ${res.worst}, ${res.over} channels over ${TOLERANCE}`,
)

if (res.worst > TOLERANCE) {
  console.error(`FAIL: the unmix loses up to ${res.worst} per channel, over the ${TOLERANCE} allowed.`)
  process.exit(1)
}

if (mode === 'build') {
  mkdirSync(dirname(TARGET), { recursive: true })
  writeFileSync(TARGET, png)
  console.log(`wrote ${TARGET.slice(ROOT.length + 1)}`)
  process.exit(0)
}

if (mode !== 'check') {
  console.error(`usage: kit-illustration.mjs [build|check]`)
  process.exit(2)
}

// PIXELS, not bytes. A different sharp or libvips can encode the same image to different
// bytes, so a byte comparison would fail on an `npm update` and teach whoever hit it that
// this check cries wolf.
let committed
try {
  committed = await sharp(TARGET).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
} catch {
  console.error(`FAIL: ${TARGET.slice(ROOT.length + 1)} is missing. Run \`npm run art:build\`.`)
  process.exit(1)
}

if (committed.info.width !== info.width || committed.info.height !== info.height) {
  console.error(
    `FAIL: committed asset is ${committed.info.width}x${committed.info.height}, `
    + `kit is ${info.width}x${info.height}. Run \`npm run art:build\`.`,
  )
  process.exit(1)
}

let drifted = 0
for (let i = 0; i < rgba.length; i++) if (committed.data[i] !== rgba[i]) drifted++
if (drifted > 0) {
  console.error(
    `FAIL: ${drifted} of ${rgba.length} channels in the committed asset do not match what `
    + 'the kit derives to. Either the kit was bumped without re-running this, or the asset '
    + 'was edited by hand. Run `npm run art:build`.',
  )
  process.exit(1)
}

console.log('OK: the committed illustration is exactly what the kit derives to.')
