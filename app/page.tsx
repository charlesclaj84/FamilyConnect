import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { User, Users, CalendarCheck, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { landingPageGraph } from '@/lib/structured-data'
import {
  APP_NAME, APP_LEAD, APP_VALUES, APP_LOGO_ALT, APP_BANNER_ALT, APP_PUBLISHER,
  BRAND_MARK_SRC, BRAND_LOCKUP_DARK_SRC, BRAND_LOCKUP_STACKED_DARK_SRC,
} from '@/lib/brand'

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
 */
export const metadata: Metadata = {
  title: `Family Reunion Planning & Private Family Website — ${APP_NAME}`,

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
  alternates: { canonical: '/' },

  // `description`, `openGraph` and `twitter` are deliberately NOT restated. The
  // root layout's are already written for this page — it is the one they describe
  // — and `openGraph` is REPLACED wholesale by the deepest segment that defines
  // it rather than merged field by field, so redeclaring it here to change nothing
  // would risk dropping `type`, `siteName` or `locale` on the next edit.
}

/**
 * The three values, expanded.
 *
 * Keyed off APP_VALUES rather than restating the words, so the brand file stays
 * the single source: change a value there and this stops compiling until the
 * copy for it exists, instead of silently rendering two of the three.
 *
 * This replaced `provides.png`, a bitmap of the same three words. As markup it
 * reflows on a phone, recolours in dark mode, and can be read aloud — none of
 * which the image could do.
 */
const VALUE_DETAIL: Record<(typeof APP_VALUES)[number], {
  blurb: string
  icon: LucideIcon
  tone: string   // icon colour — must clear 3:1 on the card
  chip: string   // the wash behind it
}> = {
  Connect: {
    blurb: 'Every branch of the family in one private place — chat, directory, and the tree that ties them together.',
    icon: Users,
    tone: 'text-brand-accent',
    chip: 'bg-brand-accent/12',
  },
  Plan: {
    blurb: 'Family Reunions and events that practically run themselves, from the first save-the-date to day-of check-in.',
    icon: CalendarCheck,
    tone: 'text-brand-affirm',
    chip: 'bg-brand-affirm/15',
  },
  Celebrate: {
    blurb: 'Photos, milestones and stories, kept for the generations who come after you.',
    icon: Sparkles,
    // Ink, not Legacy gold. Gold is 2.30 on this card and an icon that carries
    // meaning needs 3:1 — gold is the WASH here, never the foreground.
    tone: 'text-brand-ink',
    chip: 'bg-brand-legacy/20',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* The schema.org graph for the whole brand — organisation, site and product.
          It sits on this page rather than in the root layout on purpose: every
          other route is either behind a login or explicitly noindexed, so putting
          it in the layout would repeat the same three nodes on ~30 pages nobody is
          allowed to read, for no gain. This is the one indexable page, so this is
          where the entity is declared. Renders nothing. */}
      <StructuredData graph={landingPageGraph()} />

      {/* Navbar */}
      {/* z-30 is the app-wide header level — see the stacking note in
          components/layout/Navbar.tsx. */}
      <header className="border-b bg-brand-bar sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image src={BRAND_MARK_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="h-9 w-9 shrink-0" priority />
            {/* The wordmark is set, not placed: `.gn-wordmark` is the brand board's
                letterspaced Cormorant caps in CSS, so it stays crisp at any size and
                follows the theme. An <img> of the wordmark would do neither.

                Hidden below sm, for the reason the signed-in Navbar hides it: GENORRA
                at text-xl with 0.18em tracking wants ~116px, and on a 375px screen the
                mark, the appearance toggle and the two calls to action leave under 70.
                `truncate` did not fix that — it MADE it, rendering "GENOR…", which reads
                as broken rather than as tight. The mark keeps the brand present, its alt
                text still announces the name, and the hero lockup directly below carries
                the wordmark at full size. */}
            <span className="gn-wordmark hidden truncate text-xl text-brand-ink sm:block">{APP_NAME}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link href="/login">
              {/* One button, not two: below sm it is the icon alone (hence the explicit
                  aria-label, which is the accessible name once the word is gone), and
                  from sm it grows back into a labelled button. */}
              <Button variant="outline" size="icon" aria-label="Login" className="sm:w-auto sm:gap-1.5 sm:px-2.5">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

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
          <div className="gn-float absolute -top-24 -right-16 h-72 w-72 rounded-full bg-brand-legacy/12 blur-3xl" />
          <div className="gn-float-slow absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-brand-accent/12 blur-3xl" />
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
              alt={APP_BANNER_ALT}
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
          <h1 className="gn-rise gn-rise-2 mt-7 text-4xl leading-[1.15] text-brand-on-primary lg:text-5xl">
            {APP_LEAD}
          </h1>

          <p className="gn-rise gn-rise-3 mt-5 max-w-xl text-lg text-brand-on-primary/80 sm:text-xl">
            The all-in-one portal to plan events, share memories, and keep your family
            close — no matter the distance.
          </p>

          <div className="gn-rise gn-rise-4 mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/register" className="sm:w-auto">
              {/* Gold on burgundy is the brand's signature pairing and the single
                  highest-contrast thing on the page, which is where the primary
                  action belongs. `on-legacy` is Ink in both themes — plain
                  `text-brand-ink` would turn cream in dark and fail at 1.65. */}
              <Button
                size="lg"
                className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto"
              >
                Join Your Family
              </Button>
            </Link>
            <Link href="/login" className="sm:w-auto">
              <Button
                size="lg"
                className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <p className="gn-rise gn-rise-5 mt-7 text-sm text-brand-on-primary/70">
            Private &amp; secure — your family&apos;s data is never shared or sold.
          </p>
        </div>
      </section>

      {/* ── VALUES ────────────────────────────────────────────────────────
          Real cards now. As flat text on a white band these were the worst of
          the "washed" problem: white on cream is 1.069:1, so there was nothing
          to see. Border plus an ink-tinted shadow gives them an actual edge. */}
      <section aria-label={`What ${APP_NAME} is for`} className="bg-background px-4 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
          {APP_VALUES.map((value, i) => {
            const { blurb, icon: Icon, tone, chip } = VALUE_DETAIL[value]
            return (
              // Below the fold, so these use the observer rather than the CSS
              // stagger. The delay walks left to right, which is the direction
              // they are read; revealing all three at once wastes the sequence.
              //
              // 190ms apart, not the 110ms this started at. Around 100ms is the
              // threshold where a sequence stops reading as one event and starts
              // reading as a walk, so 110 sat right on it and the cascade was
              // more inferred than seen. This is comfortably past it while still
              // finishing inside a second — the last card begins at 380ms and
              // lands at 1080ms, and much beyond that a visitor who has already
              // read card one is waiting on card three.
              <Reveal key={value} delay={i * 190} className="h-full">
                <div className="group h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                  {/* The chip scales, the card does not move. These cards are not
                      links, and a card that lifts under the cursor promises a
                      click that never happens — the icon is enough of a response. */}
                  <div className={`mb-4 inline-flex rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${chip}`}>
                    <Icon className={`h-6 w-6 ${tone}`} aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-lg uppercase tracking-[0.14em]">{value}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{blurb}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Features */}
      <FeatureShowcase />

      {/* ── CLOSING CTA ───────────────────────────────────────────────────
          The second dark band, and the reason the page now has rhythm: it
          bookends the hero so the eye travels light → dark → light → dark
          instead of drifting through four consecutive pale washes. Gold button
          again, because the closing ask should look identical to the opening
          one — a visitor who scrolled past it the first time recognises it. */}
      <section className="relative overflow-hidden bg-brand-hero px-4 py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="gn-float-slow absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-brand-legacy/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl text-brand-on-primary sm:text-4xl">Ready to connect?</h2>
          <p className="mb-9 text-lg text-brand-on-primary/80">
            Create your free account and bring your family together.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90"
            >
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span className="gn-wordmark text-base text-brand-ink">{APP_NAME}</span>
            <span>{APP_LEAD}</span>
            <div className="flex gap-4">
              <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
            </div>
          </div>
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_PUBLISHER}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
