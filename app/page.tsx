import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase'
import { StructuredData } from '@/components/marketing/StructuredData'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingLocaleProvider } from '@/components/marketing/MarketingLocale'
import { marketingI18n } from '@/lib/marketing/locale'
import { localizedAlternates } from '@/lib/i18n/route-locale'
import { localizedHref } from '@/lib/i18n/route-locale'
import { FoundingFamily } from '@/components/marketing/FoundingFamily'
import { LivingSitePreview } from '@/components/marketing/LivingSitePreview'
import { Testimonials } from '@/components/marketing/Testimonials'
import { CtaBand } from '@/components/marketing/CtaBand'
import { landingPageGraph } from '@/lib/structured-data'
// ── THREE BRAND CONSTANTS LEFT THIS IMPORT, AND `alt` IS THE INTERESTING ONE ────────
// `APP_NAME` and `APP_LEAD` were English prose rendered directly and are catalogue entries
// now, for the reason `FeatureShowcase` records about `APP_PROMISE`.
//
// `APP_BANNER_ALT` went with them, which is less obvious and matters more. It is
// `${APP_NAME} — ${APP_TAGLINE}. ${APP_PROMISE}` — the acronym expansion and the three brand
// values — and it is READ ALOUD. A screen-reader user on `/es` was hearing the whole thing in
// English while every other word on the page was Spanish, which is precisely the failure this
// phase exists to close, and the one place it would never have been noticed by looking.
//
// `APP_LOGO_ALT` is still the brand file's, correctly: it is `APP_NAME` and nothing else, so
// there is nothing in it to translate.
//
// What remains here is the artwork itself, which has no language.
import { BRAND_LOCKUP_DARK_SRC, BRAND_LOCKUP_STACKED_DARK_SRC } from '@/lib/brand'
import { MetaViewContent } from '@/components/meta/MetaViewContent'

/**
 * The only page on this site most people will ever see in a search result, so its
 * title and description are the product's advertisement rather than a label.
 *
 * ── Why the title is written out in full here ────────────────────────────────
 * `title.template` in the root layout appends " — GENORRA" to every CHILD segment,
 * and `app/page.tsx` is not one: it is the same route segment as `app/layout.tsx`,
 * and Next documents that a template does not apply to the segment defining it. So
 * a bare `title: 'Family Reunion Planning'` here renders exactly that, with no
 * brand on the end. The name is therefore part of the string, and this is the one
 * page in the app where writing it out is correct rather than the mistake AGENTS.md
 * warns about (twenty-seven pages once carried a hand-typed suffix). Adding one to
 * any OTHER page still renders "X — GENORRA — GENORRA".
 *
 * ── Why it does not simply say "GENORRA" ─────────────────────────────────────
 * It used to, by falling through to `title.default`. A title is the largest text
 * in a search result and the single biggest influence on whether anyone clicks it,
 * and a five-year-old brand can spend it on a name. A new one cannot: nobody
 * types "genorra", so the only queries this page can win are descriptions of the
 * job — planning a reunion, running a family association, keeping a family tree.
 * Those words lead, and the brand closes. At 58 characters it also survives
 * Google's ~60-character display budget without being cut.
 *
 * ── `generateMetadata`, AND THE 60-CHARACTER BUDGET IS PER LANGUAGE ─────────────────
 * The argument above is about which WORDS win a search, and it holds in every language: a
 * Spanish-speaking family searches for the job, not for a brand nobody has heard of. So
 * `mkt.home.metaTitle` leads with the job in each language and closes with the name, and it is
 * written to the budget rather than translated past it — a literal rendering of *Family Reunion
 * Planning & Private Family Website* runs well past 60 and would be cut mid-phrase.
 *
 * The `canonical` note below is unchanged and still binds. What is added is `alternates.languages`
 * — the hreflang set — for the reason `lib/marketing/locale.ts` argues: three URLs serving one
 * page in three languages are three competing pages without it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await marketingI18n()
  return {
    title: t('mkt.home.metaTitle'),

  // ── The canonical, and why every public page needs one ──────────────────────
  // This production build answers on TWO public hostnames: genorra.com and the
  // `<project>.vercel.app` alias Vercel assigns automatically. Same deployment,
  // same bytes, two addresses — and to a crawler two addresses serving identical
  // content are two pages competing with each other, with the links and authority
  // earned by the real one split across both.
  //
  // robots.txt cannot fix that half (it is part of the same build and so identical
  // on both hosts — see lib/site.ts). An absolute canonical can, because it names
  // the winner in the markup: served from the alias, this page still points at
  // genorra.com and consolidates onto it.
  //
  // It is declared PER PAGE and must stay that way. Metadata is inherited, so a
  // canonical in the root layout would tell Google that /login and /register are
  // duplicates of the homepage — which is the one mistake here worse than having
  // no canonical at all.
    alternates: localizedAlternates('/', locale),

    // `description`, `openGraph` and `twitter` are deliberately NOT restated. The
    // root layout's are already written for this page — it is the one they describe
    // — and `openGraph` is REPLACED wholesale by the deepest segment that defines
    // it rather than merged field by field, so redeclaring it here to change nothing
    // would risk dropping `type`, `siteName` or `locale` on the next edit.
  }
}

/**
 * ── WHAT THIS PAGE IS FOR, AFTER THE 2026-08-12 SPLIT ────────────────────────
 * It argues; `/features` enumerates. Nearly everything in the middle of this page
 * was also on `/features` in different words — the same three core jobs, the same
 * eight secondary capabilities — and this page carried the LONGER of the two
 * descriptions, which is backwards for the one page a visitor lands on before
 * deciding whether to care.
 *
 * Three things went, and each went somewhere:
 *
 *  * **The Connect / Plan / Celebrate cards.** They stated the same three jobs in
 *    miniature that the band below then stated in full, so the proposition
 *    appeared twice above the fold-and-a-half. The three values now lead that band
 *    as its eyebrow, which is where the sentiment belongs and costs one line.
 *  * **The eighteen spotlight bullets and the eight-card grid.** Both on
 *    `/features` now. The grid in particular had to move: five of its eight cards
 *    describe Plus capabilities and this page showed no tier at all, which
 *    `/features` has a long comment about never doing.
 *  * **A hand-rolled closing band,** replaced by the shared `CtaBand` that was
 *    extracted from it. Same design, one definition.
 *
 * `LivingSitePreview` and `Testimonials` stay. The roadmap section appears on
 * `/features` too, deliberately — it is the strongest thing on the roadmap and
 * both audiences should meet it.
 */
/**
 * ── IT MOUNTS ITS OWN `MarketingLocaleProvider`, AND THAT IS THE COST OF BEING `/` ──
 * `app/(marketing)/layout.tsx` mounts one for the five pages in that group, and this page is
 * deliberately not in it (see the note beside `MarketingHeader` below). So the provider has to
 * be here too, and forgetting it is not a build error — it is a page that renders the ENGLISH
 * chrome around SPANISH content, because `MarketingHeader` is a client component that falls back
 * to `BASE_LOCALE` with no provider while `MarketingFooter` resolves the language itself.
 *
 * Measured, on `/es`, before this was added: the header said *Features* and *Sign In* while the
 * footer three inches below said *Funciones* and *Iniciar sesión*. Nothing failed and nothing
 * warned. That is the shape of every localization bug on this surface, and it is why the footer
 * resolves rather than taking a prop — one of the two had to be able to be right on its own.
 */
export default async function LandingPage() {
  const { t, locale } = await marketingI18n()

  return (
    <MarketingLocaleProvider locale={locale}>
    <div className="min-h-screen flex flex-col">
      {/* Where an advertisement lands. Renders null and fires nothing unless a Pixel is
          configured for this deployment and consent has been granted — see
          components/meta/MetaViewContent.tsx. */}
      <MetaViewContent content="home" />
      {/* The schema.org graph for the whole brand — organisation, site and product.
          It sits on this page rather than in the root layout on purpose: every
          other route is either behind a login or explicitly noindexed, so putting
          it in the layout would repeat the same three nodes on ~30 pages nobody is
          allowed to read, for no gain. This is the one indexable page, so this is
          where the entity is declared. Renders nothing. */}
      <StructuredData graph={landingPageGraph()} />

      {/* The shared public header. Extracted to components/marketing when the marketing
          surface grew from this one page to six — it carries the nav for Features,
          Pricing, How It Works, Why Us and About, all from lib/marketing-nav.ts, so a
          page added there appears here, in the footer and in the sitemap at once.

          This page is deliberately NOT inside app/(marketing): a route group cannot own
          `/` without displacing the root layout, and the hero below needs the full-bleed
          treatment the group's <main> wrapper does not give it. It imports the same two
          components instead, which is what keeps the nav consistent. */}
      <MarketingHeader />

      {/* ── HERO ──────────────────────────────────────────────────────────
          One band, not three. This used to be the artwork, then a values strip,
          then the headline — three pale stacked sections that pushed the actual
          proposition and the sign-up button below the fold, and left the page
          with a single dark moment competing against nothing.

          Now the lockup, the promise and both calls to action share one
          Heritage ground, so the first screen carries the brand AND the ask. */}
      <section className="relative overflow-hidden bg-brand-hero px-4 py-16 sm:py-20">
        {/* Two soft gold pools, well under the text. Purely atmospheric — they
            add depth to a large flat field of burgundy, which is what stops it
            reading as a plain colour block. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="gn-float absolute -top-24 -end-16 h-72 w-72 rounded-full bg-brand-legacy/12 blur-3xl" />
          <div className="gn-float-slow absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-brand-accent/12 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          {/* The lockup steps up with the viewport and fills the column at lg.
              It is a 3.27:1 horizontal lockup, so a width that looks generous as
              a number still renders short — at max-w-lg it stood 157px tall
              against a 60px headline that ran to two lines, and the artwork read
              as a caption to the type rather than the other way round. The brand
              should arrive first. */}
          {/* The stagger runs lockup → rule → headline → promise → actions →
              fine print, so the brand lands before the sentence does. It is CSS
              (`gn-rise` in globals.css), not `Reveal`: this is above the fold,
              and an intersection observer here would hold the hero blank until
              React hydrated. */}
          {/* ART DIRECTION BELOW sm. The horizontal lockup is 3.27:1, so on a 390px
              phone it renders about 109px tall whatever max-width it is given — the hero
              read as small beside the headline under it because the aspect ratio was the
              constraint, not the size. The stacked lockup is 1.27:1 and comes out around
              281px in the same slot. See BRAND_LOCKUP_STACKED_DARK_SRC.

              That 281px assumes the image is allowed the full content width. It is
              `max-w-sm` and not `max-w-xs` for exactly that reason: at max-w-xs the
              cap (320px) bit before the column (358px on a 390px phone) did, so the
              stacked art rendered 252px and gave back a third of what art-directing
              it was worth. Any cap here must stay above the widest phone column.

              <picture> rather than two <Image>s hidden by CSS: `hidden` does not stop
              the fetch, so that ships both ~50KB SVGs to every phone to display one.
              next/image was doing no work here — SVG has nothing to convert or resize —
              and fetchPriority="high" keeps what `priority` was for on the LCP element. */}
          {/* `block` is load-bearing: <picture> is inline by default, so the <img>'s
              w-full would resolve against a shrink-wrapped box. Width lives on the
              picture, the cap and the centring on the image. */}
          <picture className="gn-rise block w-full">
            <source media="(min-width: 640px)" srcSet={BRAND_LOCKUP_DARK_SRC} />
            <img
              src={BRAND_LOCKUP_STACKED_DARK_SRC}
              alt={t('mkt.bannerAlt')}
              width={1400}
              height={1100}
              fetchPriority="high"
              className="mx-auto h-auto w-full max-w-sm sm:max-w-2xl lg:max-w-3xl"
            />
          </picture>

          {/* A gold diamond on a hairline rule — the same diamond that sits at
              the foot of the mark, reused as the divider between the artwork and
              the message. Decorative, so it is hidden from assistive tech. */}
          <div aria-hidden="true" className="gn-rise gn-rise-1 mt-8 flex w-full max-w-sm items-center gap-3">
            <span className="h-px flex-1 bg-brand-legacy/30" />
            <span className="size-1.5 rotate-45 bg-brand-legacy/80" />
            <span className="h-px flex-1 bg-brand-legacy/30" />
          </div>

          {/* h1 needs an explicit colour on every dark ground: the base layer
              paints h1/h2 with --brand-ink, which is burgundy in light mode and
              would be invisible here. */}
          {/* No `sm:` step: sm was text-4xl too, so the phone was the only size
              running at text-3xl — 30px of serif under a 252px lockup, which is
              what made the hero read as small. Serif at display sizes also looks
              optically smaller than sans at the same px, so the phone is exactly
              where it could least afford the smaller step. */}
          {/* `APP_LEAD` was rendered here directly. It is keyed now for the reason
              `FeatureShowcase` records about `APP_PROMISE`: `lib/brand.ts` holds a finished
              English sentence, and a translator needs the finished sentence rather than a
              constant to interpolate. The brand file is still where the English lives. */}
          <h1 className="gn-rise gn-rise-2 mt-7 text-4xl leading-[1.15] text-brand-on-primary lg:text-5xl">
            {t('mkt.home.lead')}
          </h1>

          <p className="gn-rise gn-rise-3 mt-5 max-w-xl text-lg text-brand-on-primary/80 sm:text-xl">
            {t('mkt.home.heroLede')}
          </p>

          <div className="gn-rise gn-rise-4 mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href={localizedHref('/register', locale)} className="sm:w-auto">
              {/* Gold on burgundy is the brand's signature pairing and the single
                  highest-contrast thing on the page, which is where the primary
                  action belongs. `on-legacy` is Ink in both themes — plain
                  `text-brand-ink` would turn cream in dark and fail at 1.65. */}
              <Button
                size="lg"
                className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto"
              >
                {t('mkt.home.heroPrimary')}
              </Button>
            </Link>
            <Link href={localizedHref('/login', locale)} className="sm:w-auto">
              <Button
                size="lg"
                className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto"
              >
                {t('mkt.signIn')}
              </Button>
            </Link>
          </div>

          <p className="gn-rise gn-rise-5 mt-7 text-sm text-brand-on-primary/70">
            {t('mkt.home.heroReassure')}
          </p>
        </div>
      </section>

      {/* The product band: the three core jobs, one sentence and one screenshot
          each, with the three values leading it as the eyebrow. The catalogue
          version of the same three — six bullets apiece — is on /features, from
          the same data in components/marketing/pillars.ts. */}
      <FeatureShowcase />

      {/* The founders' own family as three figures, with the "we would rather show you
          how it works" pivot above them. Restored from /about, where it ran until
          9a9e437. It goes HERE — after the product band, before the roadmap — for two
          reasons: the pivot's second half ("everything above is what it actually does")
          points at the screenshots immediately above it, and its Heritage ground keeps
          the page alternating rather than running showcase → roadmap as two pale bands
          in a row. */}
      <FoundingFamily />

      {/* The roadmap headline, badged as coming soon in three places inside the
          component. It sits after the shipped features and before the closing ask, so a
          visitor has seen what they get today before being shown what is next — the
          reverse order reads as a product that is mostly promises. */}
      <LivingSitePreview />

      {/* Renders nothing in production until real, permissioned quotes exist — see the
          header of Testimonials.tsx for why that is the design rather than a gap. */}
      <Testimonials />

      {/* ── CLOSING CTA ───────────────────────────────────────────────────
          The second dark band, and the reason the page has rhythm: it bookends
          the hero so the eye travels light → dark → light → dark rather than
          drifting through consecutive pale washes.

          This was twenty lines of markup here, duplicating the `CtaBand` that
          was EXTRACTED FROM IT for the other five marketing pages — so the band
          this page originated had already drifted from the shared copy of
          itself. It is the shared one now; only the heading is this page's, so
          the closing ask still answers the hero's "Where every generation
          belongs" in the same voice. */}
      <CtaBand title={t('mkt.home.ctaTitle')} />

      {/* The shared public footer — three link columns rather than the two this page
          used to carry inline, because six marketing pages need reaching and a footer is
          the one place a crawler reliably follows every internal link. */}
      <MarketingFooter />
    </div>
    </MarketingLocaleProvider>
  )
}
