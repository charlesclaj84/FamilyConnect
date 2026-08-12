'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import {
  TESTIMONIALS, TESTIMONIAL_DISPLAY_LIMIT, shuffleSeeded,
} from '@/lib/testimonials'

/**
 * The testimonial carousel: a snap-scrolling rail that advances itself, and that a visitor
 * can drag, swipe, arrow through or pause.
 *
 * ── WHY A SCROLLER AND NOT A GRID ────────────────────────────────────────────
 * It was a three-column card wall, and with 28 quotes collected that reads as a slab of
 * boxes rather than as people talking — the eye gives up before the second row. A rail
 * shows two or three at a time, so each one gets read, and the movement is what tells a
 * visitor there are more without a count having to say so.
 *
 * ── NATIVE SCROLL, NOT A TRANSFORM CAROUSEL ──────────────────────────────────
 * The rail is a real overflow-x container with CSS scroll snapping, so touch swipe,
 * trackpad, shift-wheel, drag and keyboard arrows all work for free and correctly on every
 * platform — none of which a `translateX` implementation gets without reimplementing it,
 * badly. The buttons and the auto-advance are `scrollBy` calls on the same element, so
 * there is exactly one source of truth for where the rail is: its own `scrollLeft`.
 *
 * It also degrades honestly. With JavaScript disabled the rail is still a scrollable list
 * of quotes; only the buttons and the drift stop working.
 *
 * ── THE MOVEMENT IS STOPPABLE, WHICH IS NOT OPTIONAL ─────────────────────────
 * WCAG 2.2.2 requires a mechanism to pause, stop or hide motion that starts by itself and
 * runs past five seconds. There is no longer a pause button — the owner asked for it to go —
 * so the mechanism is the rail itself: any deliberate gesture stops the drift for good, be
 * that a swipe, a drag, a wheel, an arrow key, or either arrow button. Hover and focus
 * additionally suspend it, so a reader who has simply stopped to read is never fought, and a
 * keyboard user is never carried away from the card they just tabbed into.
 *
 * See the note on the `stopped` state for the trade that makes: a better interaction and a
 * slightly weaker compliance story, because the control is found by trying rather than by
 * looking.
 *
 * `prefers-reduced-motion` suppresses the auto-advance entirely and makes the arrows jump
 * rather than glide.
 *
 * ── NO setState IN AN EFFECT ─────────────────────────────────────────────────
 * The auto-advance moves the DOM, not React state: `scrollBy` on a ref inside the interval.
 * That is deliberate — the React Compiler rejects `setState` inside an effect as a
 * cascading render (it caught an earlier version of this file), and a carousel that keeps
 * its index in state has to keep that index in step with a scroll position the user can
 * change by swiping. Reading `scrollLeft` when needed avoids both problems.
 *
 * The two values that genuinely live outside React — the motion preference and this page
 * load's shuffle seed — come through `useSyncExternalStore`, the same escape `ThemeToggle`
 * documents for the same reason.
 */

/** How long a quote sits before the rail moves on. Long enough to read three lines. */
const AUTO_ADVANCE_MS = 6000

/* ── this page load's shuffle seed ──────────────────────────────────────────
   Module scope so `getSnapshot` returns the same value every time React asks; a snapshot
   that changes per call re-renders forever. A full page load reshuffles, a soft navigation
   does not — which is correct, since reshuffling under a reader mid-sentence is worse than
   showing them the same eight twice. */
const CLIENT_SEED = Math.floor(Math.random() * 2 ** 31) || 1
const subscribeSeed = () => () => {}
const getClientSeed = () => CLIENT_SEED
/** 0 means "leave the order alone" — so the server renders declaration order. */
const getServerSeed = () => 0

/* ── the motion preference ─────────────────────────────────────────────────── */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const getMotion = () => window.matchMedia(REDUCED_MOTION).matches
/** The server cannot know, and assuming motion is allowed matches the CSS default. */
const getMotionOnServer = () => false

export function Testimonials({
  heading = 'Families do not go back',
  lede,
}: {
  heading?: string
  lede?: string
}) {
  const seed = useSyncExternalStore(subscribeSeed, getClientSeed, getServerSeed)
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, getMotionOnServer)

  /**
   * THIS IS WHAT REPLACED THE PAUSE BUTTON, and it is not merely cosmetic.
   *
   * WCAG 2.2.2 requires a mechanism to pause, stop or hide motion that starts by itself and
   * runs for more than five seconds. The owner asked for the pause button to go, so the
   * mechanism is now the rail itself: ANY deliberate interaction stops the drift for good —
   * a swipe, a drag, a wheel, an arrow key, or either of the two buttons. Touch the rail and
   * it stops behaving like a carousel and starts behaving like a list.
   *
   * That is a better interaction than a pause button anyway, because it is what a visitor
   * does instinctively when moving content gets in their way. It is a slightly weaker
   * compliance story: the control is discoverable by trying rather than by looking, and a
   * user who never touches the rail never learns it can be stopped. Hover and focus still
   * suspend it, which covers the reader who has simply stopped to read. If strict conformance
   * matters more than the cleaner header, the pause button is the way back.
   *
   * Set from event handlers only — never from an effect, which the React Compiler rejects.
   */
  const [stopped, setStopped] = useState(false)
  const rail = useRef<HTMLUListElement>(null)

  // Pure: same items, same seed, same order.
  const visible = useMemo(
    () =>
      TESTIMONIALS.length > TESTIMONIAL_DISPLAY_LIMIT
        ? shuffleSeeded(TESTIMONIALS, seed).slice(0, TESTIMONIAL_DISPLAY_LIMIT)
        : TESTIMONIALS.slice(0, TESTIMONIAL_DISPLAY_LIMIT),
    [seed],
  )

  const drifting = !stopped && !reducedMotion && visible.length > 1

  useEffect(() => {
    if (!drifting) return
    const el = rail.current
    if (!el) return

    // Hover and focus suspend the drift without touching React state — a re-render here
    // would restart the interval and reset the reader's place.
    let held = false
    const hold = () => { held = true }
    const release = () => { held = false }
    el.addEventListener('pointerenter', hold)
    el.addEventListener('pointerleave', release)
    el.addEventListener('focusin', hold)
    el.addEventListener('focusout', release)

    // ANY deliberate gesture on the rail stops the drift permanently — this is the
    // pause mechanism now that the button is gone. Deliberately NOT the 'scroll' event:
    // the auto-advance scrolls too, so listening for that would have the rail stop itself
    // on its first tick. These four are things only a person does.
    const takeOver = () => setStopped(true)
    el.addEventListener('wheel', takeOver, { passive: true })
    el.addEventListener('pointerdown', takeOver)
    el.addEventListener('touchstart', takeOver, { passive: true })
    el.addEventListener('keydown', takeOver)

    const id = window.setInterval(() => {
      if (held) return
      // One card plus its gap, measured rather than assumed, so the step stays correct
      // across the three breakpoints without any of them being named here.
      const first = el.firstElementChild as HTMLElement | null
      const step = first ? first.getBoundingClientRect().width + 24 : el.clientWidth
      // 8px of slack: sub-pixel scroll widths mean an exact comparison never matches, and
      // the rail would stop one card short of wrapping.
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
      el.scrollTo({
        left: atEnd ? 0 : el.scrollLeft + step,
        behavior: 'smooth',
      })
    }, AUTO_ADVANCE_MS)

    return () => {
      window.clearInterval(id)
      el.removeEventListener('pointerenter', hold)
      el.removeEventListener('pointerleave', release)
      el.removeEventListener('focusin', hold)
      el.removeEventListener('focusout', release)
      el.removeEventListener('wheel', takeOver)
      el.removeEventListener('pointerdown', takeOver)
      el.removeEventListener('touchstart', takeOver)
      el.removeEventListener('keydown', takeOver)
    }
  }, [drifting])

  function nudge(direction: 1 | -1) {
    const el = rail.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.getBoundingClientRect().width + 24 : el.clientWidth
    const target = el.scrollLeft + direction * step
    // Wrap in both directions, so neither button is ever a dead control at an end.
    const max = el.scrollWidth - el.clientWidth
    el.scrollTo({
      left: target < -8 ? max : target > max + 8 ? 0 : target,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  if (TESTIMONIALS.length === 0) return null

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="overflow-hidden bg-background py-16 sm:py-20"
    >
      {/* The heading block keeps the page gutter; the rail below deliberately does not, so
          cards can bleed to the edge of the screen and signal that it scrolls. */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
                In their words
              </p>
              <h2 id="testimonials-heading" className="mt-3 text-3xl sm:text-4xl">
                {heading}
              </h2>
              {lede && <p className="mt-4 text-lg text-muted-foreground">{lede}</p>}
            </div>

            {/* Controls sit with the heading rather than under the rail: at the top they
                are visible before a visitor has scrolled past the cards, which is when
                they are useful. */}
            {/* Two controls, not four. The pause and play buttons are gone at the owner's
                request — see the note on `stopped` for what replaced the pause, because the
                requirement it satisfied did not go away just because the button did. */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => { setStopped(true); nudge(-1) }}
                className="inline-flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted"
                aria-label="Previous quote"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => { setStopped(true); nudge(1) }}
                className="inline-flex size-10 items-center justify-center rounded-full border transition-colors hover:bg-muted"
                aria-label="Next quote"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* THE RAIL.
          `tabIndex={0}` with a label because a scrollable region needs to be reachable and
          named for a keyboard user — that is what lets the arrow keys move it at all.
          `scroll-pl/pr` keeps a snapped card off the very edge of the viewport. The
          horizontal padding matches the page gutter so the first card lines up with the
          heading above it. */}
      <div className="mt-10">
        <ul
          ref={rail}
          tabIndex={0}
          role="group"
          aria-label="Quotes from families, scrollable"
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 motion-reduce:scroll-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {visible.map(t => (
            <li
              key={`${t.name}-${t.quote.slice(0, 24)}`}
              className="flex shrink-0 basis-[85%] snap-start sm:basis-[48%] lg:basis-[32%]"
            >
              <figure className="relative flex w-full flex-col rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                {/* Gold as a wash behind a decorative glyph, never as a foreground that
                    carries meaning — Legacy is 2.30 on white (see globals.css). */}
                <Quote
                  aria-hidden="true"
                  className="absolute right-5 top-5 h-8 w-8 text-brand-legacy/25"
                />
                {/* pr-12 is the reason the glyph is always visible: without it a long first
                    line runs underneath the mark and both become unreadable. The padding
                    reserves the corner rather than hoping the text is short. */}
                <blockquote className="flex-1 pr-12 text-base leading-relaxed">
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
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
