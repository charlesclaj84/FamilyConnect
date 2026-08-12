'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { Quote } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import {
  TESTIMONIALS, TESTIMONIAL_DISPLAY_LIMIT, shuffleSeeded,
} from '@/lib/testimonials'

/**
 * One seed per page load, generated when this module is first evaluated in the browser.
 *
 * Module scope rather than component scope so that `getSnapshot` returns the SAME value
 * every time React asks. A snapshot that changes on each call makes `useSyncExternalStore`
 * re-render forever, which is the one way to get this pattern badly wrong.
 *
 * A full page load reshuffles; a client-side navigation between marketing pages does not,
 * because the module is already evaluated. That is the correct trade — reshuffling on every
 * soft navigation would rearrange cards under a reader who was mid-sentence.
 */
const CLIENT_SEED = Math.floor(Math.random() * 2 ** 31) || 1

/** Never changes, so the store never notifies. Stable identity, per the hook's contract. */
const subscribe = () => () => {}
const getClientSeed = () => CLIENT_SEED
/** 0 means "leave the order alone" — see `shuffleSeeded`. */
const getServerSeed = () => 0

/**
 * The testimonial wall: up to eight cards, a different eight on each page load.
 *
 * ── WHY THE RANDOMISATION IS SEEDED THROUGH useSyncExternalStore ─────────────
 * These pages are statically prerendered, which is worth keeping — it is most of why they
 * answer in under 100ms and it is the right call for pages whose whole job is to be found
 * and read. Three consequences follow, and together they force this shape:
 *
 *  * Shuffling during render on the SERVER picks ONE order at BUILD time. Every visitor
 *    then sees the same eight until the next deploy, which is not what "random per page
 *    load" means.
 *  * Shuffling during render on the CLIENT makes the markup disagree with the server's,
 *    which React reports as a hydration mismatch and repairs by discarding the server's
 *    output.
 *  * Correcting it from an effect — render the first eight, then `setState` the shuffled
 *    eight — is a cascading render that the React Compiler rejects as an error. It was
 *    written that way first and the lint caught it.
 *
 * `useSyncExternalStore` is the escape, and it is the one this codebase already uses for
 * the identical problem: `ThemeToggle` reads a value that only exists on the client and
 * documents why neither render-time reads nor effect corrections work. The server snapshot
 * is 0, meaning "leave the order alone", so the initial HTML is the first eight in
 * declaration order — which is also exactly what a crawler should see, a stable set of
 * quotes. The client snapshot is this page load's seed, so React re-renders once after
 * hydration with a shuffled eight. Invisible in practice: the section is always below the
 * fold and `Reveal` is still holding the cards at zero opacity when it happens.
 *
 * THE ALTERNATIVE WAS A SEEDLESS `Math.random()` IN THE MEMO. That is impure — React is
 * free to re-run a render, and each run would produce a different order. Seeded, the memo
 * is a pure function of `[seed]`.
 *
 * THE ALTERNATIVE WAS MAKING THESE PAGES DYNAMIC so the server could shuffle per request.
 * That trades static rendering on five marketing pages for rotating a testimonial order,
 * which is the wrong way round.
 *
 * COST, STATED: this is a client component, so every quote in the array is serialised into
 * the page payload rather than only the eight on screen. At a few dozen short quotes that is
 * some kilobytes of text and worth it; at several hundred, move the selection to a route
 * handler or accept a build-time shuffle instead.
 *
 * RENDERS NOTHING while `TESTIMONIALS` is empty — see the header of `lib/testimonials.ts`.
 * An empty "In their words" heading over blank space advertises that nobody has said
 * anything, which is worse than the section's absence.
 */
export function Testimonials({
  heading = 'Families do not go back',
  lede,
}: {
  heading?: string
  lede?: string
}) {
  // 0 during server render and hydration, the page's seed immediately after. React reads
  // the server snapshot for the hydrating render and then re-renders with the client one,
  // which is exactly the sanctioned way to have the two differ — no mismatch, and no
  // setState inside an effect for the React Compiler to reject. `ThemeToggle` solves the
  // same class of problem the same way, for the same reason.
  const seed = useSyncExternalStore(subscribe, getClientSeed, getServerSeed)

  // Pure: same items, same seed, same order. Only rotates when there is something to
  // rotate — below the limit the shuffle would reorder the cards for no reason.
  const visible = useMemo(
    () =>
      TESTIMONIALS.length > TESTIMONIAL_DISPLAY_LIMIT
        ? shuffleSeeded(TESTIMONIALS, seed).slice(0, TESTIMONIAL_DISPLAY_LIMIT)
        : TESTIMONIALS.slice(0, TESTIMONIAL_DISPLAY_LIMIT),
    [seed],
  )

  if (TESTIMONIALS.length === 0) return null

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="bg-background px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
              In their words
            </p>
            <h2 id="testimonials-heading" className="mt-3 text-3xl sm:text-4xl">
              {heading}
            </h2>
            {lede && <p className="mt-4 text-lg text-muted-foreground">{lede}</p>}
          </div>
        </Reveal>

        {/* A masonry-ish balance rather than a rigid grid: quotes vary from one line to a
            paragraph, and equal-height cards would pad the short ones with dead space.
            CSS columns keep the reading order (top to bottom, then across) because the
            cards are independent — nothing here is a sequence. */}
        <div className="mt-12 gap-6 sm:columns-2 lg:columns-3 [&>*]:mb-6">
          {visible.map((t, i) => (
            <Reveal key={`${t.name}-${t.quote.slice(0, 24)}`} delay={(i % 3) * 140}>
              <figure className="relative break-inside-avoid rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                {/* Gold as a wash behind a decorative glyph, never as a foreground that
                    carries meaning — Legacy is 2.30 on white (see globals.css). */}
                <Quote
                  aria-hidden="true"
                  className="absolute right-5 top-5 h-8 w-8 text-brand-legacy/25"
                />
                <blockquote className="text-base leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 border-t pt-4">
                  <span className="block text-sm font-semibold">{t.name}</span>
                  {/* Rendered only when the family actually gave one. Every current entry
                      is a family name alone, and an empty line here is the correct output —
                      see rule 3 in lib/testimonials.ts about not inventing a role or a
                      city to balance the card. */}
                  {t.attribution && (
                    <span className="block text-sm text-muted-foreground">{t.attribution}</span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        {TESTIMONIALS.length > TESTIMONIAL_DISPLAY_LIMIT && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Showing {TESTIMONIAL_DISPLAY_LIMIT} of {TESTIMONIALS.length} — refresh for
            different families.
          </p>
        )}
      </div>
    </section>
  )
}
