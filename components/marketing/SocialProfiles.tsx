'use client'

import type { ComponentProps } from 'react'
import { useMarketingT } from '@/components/marketing/MarketingLocale'
import { BRAND_SOCIAL, type SocialPlatform } from '@/lib/brand'

/**
 * The brand's social profiles in the footer — as links once they exist, and as inert
 * marks until then.
 *
 * ── TWO PROFILES ARE LIVE, SO THE ROW IS THE LIVE-ONLY SHAPE ─────────────────
 * As of 2026-08-22 Facebook and Instagram have URLs and X does not, so this renders TWO
 * `<a>`s and no inert marks at all — the `live.length > 0` branch below. The inert state
 * described next is therefore no longer what the footer shows; it is what the footer
 * showed until that URL arrived, and what it would show again if the link were removed.
 * Both shapes are still built and the choice between them is still the one argued at
 * `profiles`, so the reasoning is kept rather than deleted.
 *
 * ── THE INERT STATE IS THE FEATURE, NOT A STUB ───────────────────────────────
 * While an account's URL is not known, its `href` in `BRAND_SOCIAL` is `null` and its
 * glyph renders as a `<span>`. That is a deliberate choice over the two usual
 * alternatives, both of which are worse:
 *
 *  * **`<a href="#">` (or a guessed URL).** A link that goes nowhere is announced as a
 *    link, focusable, and clickable — so it is a promise the page cannot keep, and a
 *    guessed `facebook.com/genorra` is a claim about someone else's namespace that we
 *    have no way to verify. Same reasoning as `BRAND_SOCIAL_PROFILES` staying empty.
 *  * **Rendering nothing at all.** Then landing them is a component to write rather than
 *    a URL to paste, which is the change most likely to be deferred indefinitely.
 *
 * The `<span>` carries no role, no `href` and no tabindex, so it is skipped by the tab
 * order and claims nothing — consistent with `MainRail` refusing `role="tablist"` and
 * `PersonMultiSelect` refusing `role="combobox"`. It is *visibly* quieter than a live
 * link too (dimmer, no hover well), so the inert state reads as inert rather than as a
 * link that failed.
 *
 * A screen reader still hears the three names, then the "Profiles coming soon" line that
 * follows them — real copy, not `sr-only`, so nobody gets a different explanation from
 * anyone else. That line disappears by itself the moment any profile goes live.
 *
 * ── NOT A `<nav>` LANDMARK ───────────────────────────────────────────────────
 * The Product and Account columns beside this one are `<nav>`s because they are the
 * site's crawlable route list, and a landmark is worth it there. A few off-site icons
 * are not a way around this site, so one is not worth it here — and while every profile
 * was still inert this would additionally have been a landmark containing zero links,
 * which is a signpost to nowhere.
 */

/**
 * The glyphs, as inline SVG.
 *
 * Third-party brand marks, so they are NOT `public/identity/` material: that folder is
 * GENORRA's own artwork and nothing else (see `lib/brand.ts`). They are not lucide
 * either — lucide dropped brand icons, and `lucide-react@1` has no Facebook, Instagram
 * or X. So the paths are Simple Icons' (CC0), pasted verbatim from the project's own
 * SVGs, each on the 24×24 grid they are drawn for. They are the platforms' trademarks
 * and are used here only to name the platforms.
 *
 * `fill="currentColor"` is what keeps this inside the colour rule — the glyph takes the
 * text colour of whatever wraps it, so it recolours per theme and per state with no
 * literal anywhere. Do not give one a colour of its own; a brand-coloured icon row was
 * never the design here and would need five hexes that `globals.css` cannot supply.
 */
function Glyph({ children, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      // Decorative: the accessible name is the sibling `sr-only` label, so announcing
      // the artwork as well would say everything twice.
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

const GLYPHS: Record<SocialPlatform, (props: ComponentProps<'svg'>) => React.ReactElement> = {
  facebook: props => (
    <Glyph {...props}>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </Glyph>
  ),
  instagram: props => (
    <Glyph {...props}>
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </Glyph>
  ),
  x: props => (
    <Glyph {...props}>
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </Glyph>
  ),
}

export function SocialProfiles() {
  /**
   * ALL INERT, OR ONLY THE LIVE ONES. There is no half-and-half.
   *
   * The mixed state is what makes this worth a decision rather than a `.filter()`: with
   * a live Facebook beside a dead Instagram and a dead X, three glyphs sit in a row
   * where one works and two do not, under a "Coming soon" caption that now reads as
   * describing all three. Every reading of that row is wrong, and the likeliest one is
   * that the icons are broken.
   *
   * So the row has two honest shapes. Nothing live yet, and it is plainly an
   * announcement: three marks, dimmed, captioned. Something live — the state since
   * 2026-08-22, when Facebook and Instagram got URLs — and it is an ordinary social row
   * containing only profiles that exist. A platform rejoins it by getting a URL, which
   * is the same one-line edit either way.
   */
  const t = useMarketingT()
  // The PLATFORM NAMES are not translated and are not in any catalogue: Facebook, Instagram
  // and X are proper nouns, and `profile.label` in `lib/brand.ts` is where they live.
  const live = BRAND_SOCIAL.filter(profile => profile.href !== null)
  const profiles = live.length > 0 ? live : BRAND_SOCIAL

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
        {t('mkt.social.follow')}
      </h2>
      <ul className="mt-3 flex items-center gap-1">
        {profiles.map(profile => {
          const Icon = GLYPHS[profile.id]
          // One element, rendered into whichever wrapper the profile's state calls for.
          // Built once so the two branches cannot drift into different sizes.
          const glyph = <Icon className="h-5 w-5" />

          return (
            <li key={profile.id}>
              {profile.href ? (
                <a
                  href={profile.href}
                  target="_blank"
                  // `noopener` denies the opened tab a handle on this one;
                  // `noreferrer` keeps the referrer off an off-site request.
                  rel="noopener noreferrer"
                  // The explicit colours are load-bearing, not decoration: `globals.css`
                  // carries an unscoped `a { color: var(--brand-accent) }` in its base
                  // layer, so without them these come out in the accent colour. Same
                  // trap as `MainRail`, `Sidebar` and `RoomListItem`.
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-soft hover:text-brand-on-soft"
                >
                  {glyph}
                  <span className="sr-only">{profile.label}</span>
                </a>
              ) : (
                // `/80`, and the number was measured rather than eyeballed. These
                // glyphs are graphics whose SHAPE is the information — which platform
                // this is — so they answer to WCAG 1.4.11's 3:1 floor for non-text
                // contrast, not to a decorative "anything goes". Against the page
                // ground: 3.89 light, 5.83 dark. `/70` was the first attempt and came
                // out at 3.16 in light mode, which passes and has nothing left over.
                // Still visibly quieter than the live state's full `text-muted-
                // foreground` (6.07 / 8.44), which is the whole point of the dimming.
                <span className="flex h-9 w-9 items-center justify-center text-muted-foreground/80">
                  {glyph}
                  <span className="sr-only">{profile.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {live.length === 0 && (
        // "PROFILES coming soon", not a bare "Coming soon" — the landing page already
        // says that four times, on the roadmap badges in `sections.tsx`, where it means
        // a feature that is not built yet. The same two words in the footer would read
        // as a fifth one of those. The noun is what keeps them apart.
        <p className="mt-2 text-xs text-muted-foreground">{t('mkt.social.soon')}</p>
      )}
    </div>
  )
}
