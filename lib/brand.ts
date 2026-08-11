/**
 * The product's identity, in one place.
 *
 * The counterpart to the colour tokens in `app/globals.css`: colours are
 * centralised there because CSS is where they are consumed, and the name is
 * centralised here because TypeScript is. Between them, rebranding is two
 * files rather than a seventy-file sweep — which is exactly what the
 * Family Connect → GENORRA rename cost before this existed.
 *
 * See AGENTS.md, "Colours live in one place" and "The product name lives in
 * one place".
 *
 * Page titles do NOT belong here. They are composed by `title.template` in
 * `app/layout.tsx`, so a page declares only its own name — `title: 'Dashboard'`
 * renders `Dashboard — GENORRA` without importing anything.
 */

/** The product name, as it is written everywhere: all caps, an acronym. */
export const APP_NAME = 'GENORRA'

/** What the acronym stands for. Matches the banner artwork. */
export const APP_TAGLINE =
  'Generations Embracing Nurturing Our Roots, Relationships & Ancestry'

/**
 * The lead brand line, per the Premium Family identity (public/README.txt).
 *
 * This is the line that leads a page — the hero, the sign-in panel. It is not
 * interchangeable with APP_TAGLINE, which is the acronym expansion and belongs
 * next to the mark.
 */
export const APP_LEAD = 'Where every generation belongs.'

/**
 * The three values, as data rather than a sentence.
 *
 * The old `provides.png` baked these into a bitmap; it is markup now, so the
 * strip reflows on a phone, recolours in dark mode, and is readable by a
 * screen reader. Anything rendering the lockup should map over this rather
 * than retyping the words.
 */
export const APP_VALUES = ['Connect', 'Plan', 'Celebrate'] as const

/** The values as the brand board sets them, for running text and alt text. */
export const APP_PROMISE = APP_VALUES.join(' • ')

/** `<meta name="description">`, and anywhere the product is described in a sentence. */
export const APP_DESCRIPTION =
  'Bringing generations together by nurturing our roots, preserving family stories and traditions, strengthening lifelong relationships, and building a legacy that lives on.'

/**
 * Brand artwork, by role rather than by filename.
 *
 * These are copies under `public/identity/`, never references into the versioned
 * vendor kits beside it (`public/v1_1/` current, `public/v1_0/` superseded).
 * Three reasons, and all three have bitten:
 *
 *  1. Kit folders are named for a design deliverable (`SVG_Masters`,
 *     `PNG_Exports`), and those names would otherwise end up in public URLs,
 *     where they are permanent.
 *  2. They are version-scoped. A URL containing `v1_1` needs rewriting at every
 *     kit bump, and the one that gets missed 404s in production.
 *  3. Each kit contains a `Brand/` folder. A `public/brand/` for web assets is
 *     the SAME directory on Windows and macOS and a DIFFERENT one on the Linux
 *     box that serves production — it works locally and 404s once deployed.
 *     `identity/` collides with nothing in either direction.
 *
 * Bumping the kit is therefore a COPY, not a path edit: re-copy every file here
 * from the new kit and `cmp` each one. Skipping that leaves the site serving the
 * previous kit's artwork silently, which is exactly what happened to the lockup.
 */
export const BRAND_MARK_SRC = '/identity/genorra-mark.svg'

/**
 * The horizontal lockup for a DARK ground — the banner band on the landing page
 * and the auth shell.
 *
 * Named for the kit's own vocabulary: v1_1 ships `Horizontal_Dark` (cream
 * wordmark, for dark grounds) and `Horizontal_Light` (for pale grounds). It is
 * NOT the v1.0 `Horizontal_Reversed` this used to point at — that file exists
 * only in v1.0 and carries the superseded mark, the "simplified recreation"
 * v1.1 was issued to correct. Picking the wrong one is silent: both render.
 */
export const BRAND_LOCKUP_DARK_SRC = '/identity/genorra-lockup-dark.svg'

/**
 * Alt text for the mark, which is wordless.
 *
 * Just the name: the mark carries no tagline, and a screen reader reaching a
 * link that is a logo wants the destination, not a description of the artwork.
 */
export const APP_LOGO_ALT = APP_NAME

/**
 * Alt text for the horizontal lockup used in the banner band.
 *
 * The lockup is not decorative — it renders the wordmark, the tagline and the
 * three values as artwork, so the alt text has to speak all three or a screen
 * reader gets less than a sighted user does.
 */
export const APP_BANNER_ALT = `${APP_NAME} — ${APP_TAGLINE}. ${APP_PROMISE}`

/**
 * Browser-chrome colour, for `viewport.themeColor` and the web manifest.
 *
 * The one place a brand hex may legitimately appear outside `globals.css`:
 * these are consumed by the browser as document metadata, never by a
 * stylesheet, so a CSS custom property cannot reach them. They must be kept
 * in step with `--genorra-heritage` and `--genorra-ground-dark` by hand.
 */
export const BRAND_THEME_COLOR = {
  light: '#6b2d3a', // --genorra-heritage
  dark: '#1e1216',  // --genorra-ground-dark
} as const
