// No 'use client'. This is data and markup — the whole band renders on the server
// and ships no JS. Only `Reveal` crosses to the client. Adding a hook or a handler
// here would need the directive back; prefer a small client child instead.
import { PillarVignette } from '@/components/marketing/PillarVignette'
import { Reveal } from '@/components/marketing/Reveal'
import { SectionHeading, ComingSoonBadge, MoreLink } from '@/components/marketing/sections'
import { PILLARS } from '@/components/marketing/pillars'
import { isFeatureFuture } from '@/lib/features'
import { APP_NAME, APP_PROMISE } from '@/lib/brand'

/**
 * The landing page's product band: the three core jobs, one sentence and one
 * drawn panel each.
 *
 * ── WHAT THIS USED TO BE, AND WHY IT IS NOT THAT ANY MORE ────────────────────
 * Three full-width spotlight rows carrying EIGHTEEN bullets between them, then an
 * eight-card grid describing every remaining capability at paragraph length. All
 * of it appeared again on `/features`, in different words — and the landing page
 * carried the LONGER version of the two, which is backwards. A visitor deciding
 * whether this product is for them does not need the catalogue; a visitor who has
 * decided to evaluate it wants nothing else.
 *
 * So the split is now: this page argues, `/features` enumerates. Three cards, one
 * sentence each, and a link. The bullets and the eight-card grid live on
 * `/features`, where the tier tags are — which also fixed a real problem, because
 * five of those eight cards describe Plus capabilities and this page was
 * presenting them with no tier at all.
 *
 * ── THE COPY IS NOT DEFINED HERE ─────────────────────────────────────────────
 * `components/marketing/pillars.ts` holds it, shared with `/features`, so the two
 * surfaces cannot drift into two descriptions of one product again. This file
 * chooses `short` and the vignette; `/features` chooses `blurb` and `bullets`.
 *
 * ── THE BADGE IS DERIVED, NEVER TYPED ────────────────────────────────────────
 * `isFeatureFuture(route)` reads `lib/features.ts`, so a card cannot claim
 * something a member cannot reach. This was the only marketing surface with that
 * property; `/features` has it now too. Do not replace it with a hand-set boolean.
 */
export function FeatureShowcase() {
  return (
    // A flat ground, deliberately. This was a three-stop gradient between two values
    // a tenth of a step apart, which cost a paint and read as nothing. Contrast on
    // this page comes from the dark bands above and below it.
    <section aria-labelledby="showcase-heading" className="bg-muted/50 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        {/* The three values lead the band as its eyebrow rather than as three cards
            of their own. They were a separate section immediately above this one,
            saying the same three things in miniature that the cards below then said
            in full — the page stated its proposition twice before a visitor reached
            the fold. `APP_PROMISE` is derived from `APP_VALUES`, so the brand file
            stays the single source. */}
        <SectionHeading
          id="showcase-heading"
          eyebrow={APP_PROMISE}
          title="Everything it takes to run a family"
          lede={`${APP_NAME} replaces the group texts, spreadsheets and shoeboxes of receipts with one private home for your family, your plans and your money.`}
        />

        {/* One column below lg, not two or three. Three panels across a tablet
            renders each about 200px wide — at which point the calendar strip and the
            fund bars stop being legible and become texture. */}
        <div className="mt-12 grid gap-6 lg:mt-14 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.route} delay={i * 160} className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                {/* A DRAWN PANEL, NOT A SCREENSHOT, since 2026-08-22. What was here
                    was `next/image` over three PNGs that this file's own comment
                    called screenshots and that were placeholder cards reading COMING
                    SOON — so the landing page's product band announced all three
                    flagship capabilities as unbuilt. `PillarVignette`'s header has
                    the full account.

                    The frame's own rounding and border come off here, because the
                    card around it already draws both: a rounded panel inside a
                    rounded card leaves a sliver of ground in each corner. */}
                <PillarVignette
                  kind={pillar.vignette}
                  className="rounded-none border-0 border-b shadow-none"
                />

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2.5">
                    <span className={`inline-flex rounded-xl p-2.5 ${pillar.chip}`}>
                      <pillar.icon className={`h-5 w-5 ${pillar.tone}`} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent">
                      {pillar.eyebrow}
                    </span>
                    {isFeatureFuture(pillar.route) && <ComingSoonBadge />}
                  </div>
                  <h3 className="text-xl leading-tight font-semibold">{pillar.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {pillar.short}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* WHAT REPLACED THE EIGHT-CARD GRID. Naming them in a sentence costs one
            line and says the same thing the grid did; the grid's real content was
            its tier tags, and those only exist on `/features`. The link names all
            three things a reader might have come for — the list, the price, and
            what has not shipped — because the sentence itself carries no badges and
            six of the seven capabilities in it are still gated. */}
        <Reveal delay={180}>
          <div className="mt-10 rounded-2xl border border-dashed bg-card/60 px-6 py-5 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              And family chat, announcements, officer elections, photo collections,
              documents, regional chapters and leadership reports.
            </p>
            <div className="mt-3 flex justify-center">
              <MoreLink href="/features">
                Everything it does, what is in each plan, and what is still on the way
              </MoreLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
