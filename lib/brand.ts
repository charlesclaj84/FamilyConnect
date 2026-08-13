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
 * The lead brand line, per the Premium Family identity
 * (public/home/v1_0/README.txt).
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

/**
 * The motto, as two halves, because it is SET rather than printed.
 *
 * The Dashboard rail renders it as a quote card with "Our Roots" in Legacy gold and the
 * rest in cream — the treatment the Golden Master specifies, and the reason this is a
 * pair of strings and not one sentence. The first half is deliberately the same three
 * words that sit inside `APP_TAGLINE` ("…Nurturing Our Roots…"); the motto is a play on
 * the acronym, so if one is ever reworded the other has to be read again.
 *
 * Not interchangeable with `APP_LEAD`, which leads a marketing page and speaks to
 * somebody who has not signed up. This one speaks to a member who is already inside.
 */
export const APP_MOTTO = {
  lead: 'Our Roots',
  rest: 'run deep, our bond runs deeper.',
} as const

/** Anywhere the product is described in a sentence: the manifest, prose, an about panel. */
export const APP_DESCRIPTION =
  'Bringing generations together by nurturing our roots, preserving family stories and traditions, strengthening lifelong relationships, and building a legacy that lives on.'

/**
 * `<meta name="description">`, and the Open Graph and Twitter descriptions with it.
 *
 * SEPARATE FROM `APP_DESCRIPTION` ON PURPOSE, and the distinction is not stylistic.
 * A meta description is not a description of the product — it is ad copy in a search
 * result, written to two hard constraints the brand sentence does not answer to:
 *
 *  * **It is truncated.** Google gives a snippet roughly 155–160 characters on
 *    desktop and around 120 on a phone. `APP_DESCRIPTION` is 170, so it was being
 *    cut mid-clause — the last thing a searcher saw was an ellipsis. This one is
 *    156, which sits inside the desktop budget, so the sentence a visitor reads
 *    is the sentence we wrote. Keep any rewrite under ~155 and put the load-
 *    bearing words first, since the phone cut lands around 120 regardless.
 *  * **It has to contain the words people type.** "Nurturing our roots" is the
 *    brand's voice and belongs on the page; nobody searches for it. "Family
 *    reunion", "dues", "family tree" and "family organization" are what somebody
 *    looking for this product actually puts in the box, and a snippet that
 *    contains the query gets those words bolded in the result — which is a
 *    click-through difference, not a ranking one.
 *
 * The claim of a free account is not marketing licence: the landing page's own
 * closing call to action says "Create your free account". Structured data and
 * snippets must not promise anything the page does not — if the pricing changes,
 * this sentence and that button change together.
 */
export const APP_SEO_DESCRIPTION =
  'Plan family reunions, collect dues, build your family tree and share photos — one private site for your whole family organization. Create your free account.'

/**
 * The company behind the product.
 *
 * Here rather than typed into the landing-page footer, for the same reason
 * `APP_NAME` is: it is now in two places (the footer and the `Organization`
 * structured data in `lib/structured-data.ts`), and a legal entity that appears
 * in a copyright line and a search engine's entity graph must not be able to
 * disagree with itself.
 */
export const APP_PUBLISHER = 'ClearPath Digital'

/** The platforms the brand has a presence on, in the order the footer prints them. */
export type SocialPlatform = 'facebook' | 'instagram' | 'x'

export interface BrandSocialProfile {
  id: SocialPlatform
  /** The platform's own name, for the icon's accessible label. */
  label: string
  /**
   * The live profile URL — or `null` while the account does not exist yet.
   *
   * `null` is a state the whole feature is built around rather than a placeholder:
   * it renders the glyph inert instead of guessing a handle, and it keeps the
   * profile out of `sameAs`. Do not put a hoped-for URL here.
   */
  href: string | null
}

/**
 * Official profiles for this brand — the footer's icons and `Organization.sameAs`,
 * declared once.
 *
 * ── WHY ONE LIST AND NOT TWO ─────────────────────────────────────────────────
 * These two consumers make the same claim to different audiences: the footer tells a
 * visitor "this is our Facebook", and `sameAs` tells a search engine the same thing.
 * Kept apart they can disagree — a footer link live for a month before the structured
 * data hears about it, or worse, a `sameAs` pointing at a profile the site does not
 * show. Both are cured by there being nowhere for a second copy to live, which is the
 * same argument `APP_PUBLISHER` is written to.
 *
 * ── EVERY `href` IS NULL TODAY, DELIBERATELY ─────────────────────────────────
 * The accounts are being created; the URLs are not known yet. This is the one field
 * here that cannot be written by reasoning about the codebase — a URL that is not a
 * real, live, brand-owned profile is a false claim, and an unverifiable one is worse
 * than none. So the glyphs land now as non-clickable marks and the entity graph stays
 * silent, which is honest in both directions.
 *
 * **Turning one on is this one edit.** Fill in the `href` and the footer renders a real
 * link, the structured data starts claiming it, and nothing else changes.
 */
export const BRAND_SOCIAL: readonly BrandSocialProfile[] = [
  { id: 'facebook',  label: 'Facebook',  href: null },
  { id: 'instagram', label: 'Instagram', href: null },
  { id: 'x',         label: 'X',         href: null },
]

/**
 * The live profile URLs, for `Organization.sameAs`.
 *
 * DERIVED, never hand-written: `sameAs` is how a search engine confirms that the
 * GENORRA on this site is the same GENORRA on a social profile, and it is the main
 * thing that turns a set of pages into a recognised entity. Deriving it means it can
 * only ever name a profile the footer is also showing.
 *
 * Empty while every `href` is `null`, and `lib/structured-data.ts` omits the field
 * entirely rather than emitting `"sameAs": []` — see the note there.
 */
export const BRAND_SOCIAL_PROFILES: readonly string[] = BRAND_SOCIAL
  .map(profile => profile.href)
  .filter((href): href is string => href !== null)

/**
 * Brand artwork, by role rather than by filename.
 *
 * These are copies under `public/identity/`, never references into the versioned
 * vendor kits under `public/home/` (`v1_1` current, `v1_0` superseded).
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
 * The mark in Legacy gold, for a Heritage ground.
 *
 * **NOTHING CONSUMES THIS TODAY**, and that is worth a note rather than a deletion. It
 * existed for one caller — the signed-in header, a 4rem Heritage band with a 36px mark in
 * it — and the Golden Master shell deleted that band: the brand moved into the rail, where
 * `components/layout/Sidebar.tsx` renders the FULL-COLOUR mark at 64px instead.
 *
 * THE CHOICE BETWEEN THEM IS ABOUT SIZE, not about the ground, and the paragraph this
 * replaces got that wrong. It said the full-colour mark is "weak on deep burgundy, where
 * its own burgundy strokes have nothing to separate them from the band" — true at 36px,
 * where the burgundy strokes are most of what you can resolve. At 64px the gold, terracotta
 * and olive strokes are legible as themselves and the mark reads as the mark; that is what
 * the Golden Master draws in the rail, and it is why the swap was safe.
 *
 * Keep the file. Gold on Heritage is the brand's own dark app-icon treatment, straight from
 * the kit (`SVG_Masters/GENORRA_Mark_Gold.svg`), and the next small mark on a burgundy
 * ground — a favicon-scale badge, a compact bar — should reach for it rather than shrink
 * the full-colour one.
 */
export const BRAND_MARK_GOLD_SRC = '/identity/genorra-mark-gold.svg'

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
 * The STACKED lockup for a dark ground — the same artwork composed vertically, for
 * narrow screens.
 *
 * The kit calls this `Primary_Dark` and the wide one `Horizontal_Dark`; both are named
 * here for the shape they are, because "primary" says nothing about when to reach for it
 * and the two are chosen by viewport rather than by rank.
 *
 * WHY IT EXISTS. The horizontal lockup is 1700x520 — 3.27:1. Across a 390px phone with
 * the hero's padding that renders about 109px tall, which is why the hero read as small
 * beside everything under it however much max-width it was given: on a phone the artwork
 * was never the constraint, the aspect ratio was. This one is 1400x1100 (1.27:1) and
 * comes out around 281px in the same slot.
 *
 * The two heroes therefore ART-DIRECT rather than resize — see the <picture> in
 * app/page.tsx and app/(auth)/layout.tsx. A single image scaled up cannot fix this,
 * because the problem is the composition and not the size.
 */
export const BRAND_LOCKUP_STACKED_DARK_SRC = '/identity/genorra-lockup-stacked-dark.svg'

/**
 * The 512px app tile — the gold mark on a Heritage ground.
 *
 * Named here because it now has a SECOND consumer besides the web manifest: it is
 * the `logo` on the `Organization` structured data, which is what a search engine
 * shows beside the brand when it recognises one. Google requires that logo to be a
 * real, crawlable raster of at least 112x112 and prefers a square — which is
 * exactly what an app tile is, so there is no second file to keep in step.
 *
 * The SVG mark cannot do this job: the logo field wants a bitmap, and the mark is
 * a stroked form with the heart cut out, so it has no ground of its own and would
 * render as burgundy strokes on whatever a search result happens to sit on.
 */
export const BRAND_APP_ICON_SRC = '/identity/genorra-app-512.png'

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
