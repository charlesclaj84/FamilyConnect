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

/** The three-verb line beneath the tagline on the banner. */
export const APP_PROMISE = 'Connect. Plan. Celebrate.'

/** `<meta name="description">`, and anywhere the product is described in a sentence. */
export const APP_DESCRIPTION =
  'Bringing generations together by nurturing our roots, preserving family stories and traditions, strengthening lifelong relationships, and building a legacy that lives on.'

/**
 * Alt text for `/banner.png`.
 *
 * The banner is not decorative — it renders the wordmark, the tagline and the
 * promise as artwork, so the alt text has to speak all three or a screen reader
 * gets less than a sighted user does.
 */
export const APP_BANNER_ALT = `${APP_NAME} — ${APP_TAGLINE}. ${APP_PROMISE}`

/** Alt text for `/logo.png`, which is the mark alone with no words in it. */
export const APP_LOGO_ALT = APP_NAME
