'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { useMarketingLocale, useMarketingT } from '@/components/marketing/MarketingLocale'
import { BASE_LOCALE } from '@/lib/i18n/locales'
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
 * ── ONE CARD IS EMPHASISED AND THE REST RECEDE ───────────────────────────────
 * Three identically filled, bordered, shadowed cards side by side are the slab complaint
 * again at three columns instead of nine: everything is equally loud, so nothing is being
 * said. The card in the CENTRE of the page keeps the full card treatment, and every other
 * card drops to an outline: no fill, no shadow, a hair smaller, text on
 * `--muted-foreground`. Hover restores a card completely, which is also what tells a visitor
 * that a quiet card can be brought forward — and a keyboard user gets the same thing from
 * the arrow keys, because those scroll the rail and the emphasis follows scroll.
 *
 * THE CENTRE IS NOT THE SNAP POSITION, AND DOES NOT NEED TO BE. The rail is `snap-start`, so
 * `scrollLeft / step` names the card against the left edge; the emphasis is that card plus
 * half the visible count, which at `lg` is the middle of three. Three 32% cards and their two
 * gaps come to within a couple of pixels of the full width, so the middle of them sits dead
 * centre on the page without the layout having to be rebuilt around `snap-center`.
 *
 * Which is what was tried first and is the trap: centring the SNAP position means the first
 * card can only reach the centre if the rail carries a third of a screen of empty space
 * before it, which is what a visitor meets on arrival — or, without that space, the first
 * card can never be the centre one and the emphasis starts on the second quote. `snap-start`
 * plus an offset has neither problem and leaves the step arithmetic, the end-of-rail wrap and
 * the first-paint mark all exactly as they were.
 *
 * THE RECEDE IS A TOKEN, NOT AN OPACITY. `opacity-60` is the obvious way to push a card
 * back and it takes the quote's contrast with it — about 5.5:1 down to near 3:1 in light
 * mode, on body text a visitor is expected to read the moment they scroll to it.
 * `text-muted-foreground` is a pairing this design system has already measured (5.53 on the
 * light ground, 6.86 on the dark one), so a receded quote is quieter without ever becoming
 * harder to read than the app's own secondary text.
 *
 * WHICH CARD IS CURRENT IS AN ATTRIBUTE, NOT STATE. A `scroll` handler calling `setState`
 * is a render per frame, and the compiler note below is not hypothetical — it caught an
 * earlier version of this file. The handler writes `data-current` onto one `<li>` and the
 * cards style themselves with `group-data-[current=true]:`, so the emphasis follows the
 * rail's own `scrollLeft` with no React involvement, and React never re-renders that value,
 * so it does not fight the handler over it.
 *
 * The FIRST card carries the attribute from the server, because which card is centred depends
 * on how many fit and the server cannot know the viewport. So at `lg` the mark moves one to
 * the right on mount. That is not a flash anybody sees: this section is far below the fold on
 * all five pages that use it, and hydration is finished long before a visitor scrolls to it.
 * With JavaScript off at `lg` the emphasis stays on the leftmost card — the wrong card of the
 * three, and still a page where one quote is emphasised and the rest are quiet, which is the
 * whole point of the treatment.
 *
 * That listener is deliberately NOT the one that stops the drift (see `takeOver`): the
 * auto-advance scrolls too, so a rail that stopped on any scroll would stop on its own
 * first tick.
 *
 * ── THE ARROWS FLANK THE CURRENT CARD ────────────────────────────────────────
 * They used to sit up beside the heading, on the argument that a control is most useful where
 * it can be seen before the visitor has scrolled past the thing it controls. They are now on
 * the rail itself, one at each edge of the emphasised card, because once one card is emphasised
 * the arrows are that card's controls and belonged next to it — a header control over a rail
 * with an obvious subject reads as belonging to the section rather than to the quote.
 *
 * Three things make that work. The position comes from the rail's ARITHMETIC — `railGeometry`,
 * shared with the emphasis so the two cannot pick different cards — rather than from measuring
 * the current card's rect, so it is the same at every rest position and the arrows hold still
 * while the cards move underneath. They are siblings of the rail rather than children, so they
 * are not scrollable content that slides away with it. And the rail carries a
 * `scroll-padding-left` equal to half an arrow plus its air, which is what leaves the leftmost
 * card somewhere to stop that an arrow on its edge can share.
 *
 * All three have been wrong at once, and the arrows were the only visible symptom: an arrow
 * lying across the first word of the quote on the left and floating past the card's edge on the
 * right. See `arrowAnchors` and the `scroll-pl-6` note on the rail for each half.
 *
 * ── NATIVE SCROLL, NOT A TRANSFORM CAROUSEL ──────────────────────────────────
 * The rail is a real overflow-x container with CSS scroll snapping, so touch swipe,
 * trackpad, shift-wheel, drag and keyboard arrows all work for free and correctly on every
 * platform — none of which a `translateX` implementation gets without reimplementing it,
 * badly. The buttons and the auto-advance are `scrollBy` calls on the same element, so
 * there is exactly one source of truth for where the rail is: its own `scrollLeft`.
 *
 * It also degrades honestly. With JavaScript disabled the rail is still a scrollable list of
 * quotes; only the arrows and the drift stop working, and a visitor who scrolls it by hand
 * reaches the end of the second copy having seen the twelve twice.
 *
 * ── THE RAIL DOES NOT REWIND ─────────────────────────────────────────────────
 * It only ever moves right. Reaching the last quote used to scroll the rail back to the start,
 * which is a second or so of every card the visitor just read flying past backwards — the one
 * moment the rail stops reading as a row of people talking and starts reading as a widget.
 *
 * So the list is rendered TWICE, and when the second copy's first card reaches the left edge
 * the rail's `scrollLeft` is cut back by exactly one copy's width, instantly. Nothing can be
 * seen happening, because the pixels at those two positions are identical — same quotes, same
 * order, same offsets. The rail advances forever and never repeats within a period.
 *
 * THE FOLD MUST HAPPEN AT REST, and that is the whole of the difficulty. An instant
 * `scrollLeft` write lands cleanly between advances and cancels a touch fling in the middle of
 * one, so it is done in three places that are all quiet: before an advance, on `scrollend`, and
 * before a button press. Never on `scroll`, which fires mid-gesture and mid-animation.
 *
 * `TESTIMONIAL_DISPLAY_LIMIT` is therefore the rail's PERIOD, not a wall size — twelve quotes
 * at eight seconds is a minute and a half before one comes round again, and 24 `<li>` in the
 * DOM. The second copy is `aria-hidden`, since a screen reader has already been given all
 * twelve.
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

/**
 * How long a quote sits before the rail moves on. Eight seconds, raised from six on
 * 2026-08-13 at the owner's request: comfortably past the four or five a three-line quote
 * takes to read, so the rail feels like it is waiting rather than pulling.
 *
 * Being past five seconds is also what puts this rail under WCAG 2.2.2 — see THE MOVEMENT IS
 * STOPPABLE above. Slowing it down does not make that section optional; it makes it apply
 * more clearly.
 */
const AUTO_ADVANCE_MS = 8000

/** `gap-6` on the rail, in pixels. Named once because several places need it. */
const CARD_GAP = 24

/**
 * How much air an arrow keeps: from the card it flanks, and from the edge of the section when
 * it has been clamped there.
 */
const ARROW_AIR = 4

/**
 * One card plus its gap — measured rather than assumed, so the step stays correct across the
 * three breakpoints without any of them being named here.
 *
 * It measures the `<li>`, which is why the highlight's slight scale lives on the `<figure>`
 * inside it: a transform on the element being measured would shrink the step and walk the
 * rail out of alignment with its own snap points.
 */
function cardStep(el: HTMLElement) {
  const first = el.firstElementChild as HTMLElement | null
  return first ? first.getBoundingClientRect().width + CARD_GAP : el.clientWidth
}

/**
 * How many cards to the right of the snapped one the CENTRE of the page is: one of three at
 * `lg`, none at the two-up and one-up widths.
 *
 * How many cards are on screen is `clientWidth / step` floored — a card the rail has only half
 * of is not one the visitor is reading — and `(visible - 1) / 2` floored is what makes the even
 * case behave: the centre of two is the left one, never the right one, which at that width is
 * half cut off by the edge of the screen.
 *
 * Takes the step rather than measuring it, so the two callers that already have it do not pay
 * for a second layout read.
 */
function middleOffset(el: HTMLElement, step: number) {
  return Math.floor((Math.max(1, Math.floor(el.clientWidth / step)) - 1) / 2)
}

/**
 * Everything the emphasis and the arrows both derive from, read once.
 *
 * ── WHY ONE FUNCTION AND NOT TWO ─────────────────────────────────────────────
 * They used to work it out separately, and they disagreed. `currentCard` divided
 * `scrollLeft` by the step; `arrowAnchors` reconstructed the rail's gutter and then forgot
 * to take the scroll back off. The emphasis landed on the right card and the arrows landed
 * a gutter's width to the right of it — the left one sitting on the first word of the quote,
 * the right one out in the gutter past the card's edge. Measured at 24.0px off at every one
 * of six widths, which is what a shared constant looks like when it is only subtracted in
 * one of the two places it was added.
 *
 * So the arithmetic lives here once. If the emphasis and the arrows are ever wrong together
 * that is a bug in one function; they can no longer be wrong *differently*.
 *
 * `gutter` is the rail's own leading padding, recovered without reading a stylesheet: the
 * first card sits at content offset 0, so its distance from the rail's left edge plus the
 * current scroll is the padding.
 *
 * `snapped` is the card aligned to the scrollport's start edge — `(scrollLeft - gutter) /
 * step` rounded, which is exact at every rest position. Measuring which card straddles the
 * viewport's centre line looks like the direct answer and is worse: at the two-up width the
 * centre line falls in the GAP between two cards, so the nearest-to-centre card flips
 * between them on a few pixels of scroll.
 *
 * `snappedLeft` is where that card actually is, in pixels from the rail's left edge. It is
 * 0 or `gutter` depending on whether the rail has a scroll-padding, and deriving it rather
 * than assuming either one is the point — see the note on `scroll-pl-6` on the rail.
 */
function railGeometry(el: HTMLElement) {
  const first = el.firstElementChild as HTMLElement | null
  if (!first) return null
  const cardRect = first.getBoundingClientRect()
  const railRect = el.getBoundingClientRect()
  const step = cardRect.width + CARD_GAP
  if (step <= 0) return null

  const gutter = cardRect.left - railRect.left + el.scrollLeft
  const snapped = Math.max(0, Math.round((el.scrollLeft - gutter) / step))
  return {
    cardRect,
    railRect,
    step,
    middle: middleOffset(el, step),
    snapped,
    snappedLeft: gutter + snapped * step - el.scrollLeft,
  }
}

/**
 * The card in the CENTRE of the page: the middle of the three on screen at `lg`, and the
 * snapped one at the narrower widths.
 *
 * The clamp is against the DOUBLED list, so it does not care which copy the rail is currently
 * in: the second copy's cards are as real as the first's, and the centre of the page is
 * genuinely one of them for the moment before the seam is folded away.
 */
function currentCard(el: HTMLElement) {
  const at = railGeometry(el)
  if (!at) return 0
  return Math.max(0, Math.min(el.children.length - 1, at.snapped + at.middle))
}

/**
 * Move the rail with NO animation, whatever the stylesheet says.
 *
 * `el.scrollLeft = x` IS NOT AN INSTANT WRITE ON THIS ELEMENT, and that is the trap this
 * function exists to close. The rail carries `scroll-smooth`, and `scroll-behavior` governs
 * scrolls "caused by the user or by the API" — an assignment to `scrollLeft` included. So the
 * write animates: measured, `el.scrollLeft = 2000` reads back as 0 on the same line, 2 on the
 * next frame, and settles most of a second later.
 *
 * Two things depended on that being instant and neither worked:
 *
 *   * the seam fold animated a full period BACKWARDS — twelve cards flying past in reverse,
 *     which is the exact thing THE RAIL DOES NOT REWIND was written to prevent; and worse,
 *     the advance that follows it in the same tick read the pre-fold `scrollLeft` and
 *     overwrote the fold with an ordinary step, so the rail never folded at all and marched
 *     off the end of the doubled list instead;
 *   * `nudge`'s step back off the front read `scrollLeft` on the line after writing it and
 *     got the old value, so the Previous arrow at the start of the rail went somewhere
 *     arbitrary.
 *
 * `behavior: 'instant'` overrides the CSS per call, which is what both of them wanted.
 * It is also why nobody with `prefers-reduced-motion` ever saw any of this: the rail's
 * `motion-reduce:scroll-auto` had already turned the animation off for them.
 */
function jumpTo(el: HTMLElement, left: number) {
  el.scrollTo({ left, behavior: 'instant' })
}

/**
 * Fold the rail back into the FIRST copy of the list — instantly, and invisibly, because the
 * content one period along is the same content, pixel for pixel. This is the whole trick
 * behind a rail that never rewinds: it only ever scrolls right, and the one seam it crosses is
 * a seam it cannot be seen crossing.
 *
 * It must never run mid-gesture or mid-animation. Jumping during a fling cancels the momentum,
 * which is precisely the jolt this exists to avoid — so all three call sites are at rest:
 * before an advance, after a scroll has ended, and before a button press.
 */
function foldToFirstCopy(el: HTMLElement, uniqueCards: number) {
  const period = cardStep(el) * uniqueCards
  // A pixel of slack, because the period is a sum of sub-pixel card widths: the rail can come
  // to rest a hair short of it, and an exact comparison would then never fold.
  if (period > 0 && el.scrollLeft >= period - 1) jumpTo(el, el.scrollLeft - period)
}

/**
 * Where the two arrows go: the left and right edges of the current card, in pixels from the
 * left of the rail.
 *
 * SCROLL-INVARIANT BY CONSTRUCTION, which is why this is arithmetic and not a measurement of
 * the current card itself. The rail snaps, so at every rest position the snapped card is
 * against the rail's own gutter and the current card is `middleOffset` steps to its right —
 * the same place on screen, whichever quote happens to be in it. Measuring the card's rect
 * would agree at rest and disagree on every frame of an advance, and arrows that slide back
 * and forth with the cards are exactly the fidget this rail is trying not to be.
 *
 * THEY MIRROR EACH OTHER: each is centred on an edge of the card, half on and half off. That
 * symmetry is the whole look — an arrow sitting out in the gutter on one side and straddling on
 * the other reads as a mistake, whichever one you look at second.
 *
 * WHAT MAKES IT SAFE IS THAT NEITHER HALF LANDS ON TEXT. The card's `p-6` leaves 24px inside
 * each edge, and the blockquote's `pr-12` widens that to 48px on the right for the gold glyph.
 * A 40px arrow centred on an edge reaches 20px in, so it covers padding and stops short of the
 * first word — by 5px at `sm`, by 7px on a phone with the smaller arrow.
 *
 * THE POSITION IS THE CURRENT CARD'S, ON SCREEN — `snappedLeft`, not the rail's gutter. That
 * distinction is the bug this function shipped with: it recovered the gutter by ADDING
 * `scrollLeft` and then used the result as a screen position without taking the scroll off
 * again, so both arrows sat exactly one resting-scroll-offset too far right. Measured at
 * 24.0px at every width, which put the left arrow 17px over the first word of the quote and
 * the right arrow out past the card's edge in the gutter — one arrow inside the card and one
 * outside it, from a single sign error.
 *
 * THE CLAMP IS A BACKSTOP, NOT THE MECHANISM, and it has now been got wrong twice. The rail
 * needs 24px of room to the left of the leftmost card or an arrow centred on that card's edge
 * hangs off the screen, the clamp pushes it inward, and its inner edge lands on the first word
 * — which is what "on top of the card" looked like. `pl-6` was supposed to be that room and
 * cannot be: see `scroll-pl-6` on the rail for why snapping scrolls plain padding away. If the
 * arrows ever grow, that scroll-padding grows with them: `half + ARROW_AIR` is the floor.
 *
 * `y` is the centre of the CARDS, which is not the centre of the rail: `pt-2 pb-8` is asymmetric
 * (the shadow needs the room below), so a `top-1/2` arrow would sit 12px low. Derived rather
 * than corrected by hand, so it survives a change to either padding — and it tracks the row's
 * height, which is why the observer watching this is a ResizeObserver and not a resize listener.
 */
function arrowAnchors(el: HTMLElement, arrowWidth: number) {
  const at = railGeometry(el)
  if (!at) return null
  const cardLeft = at.snappedLeft + at.middle * at.step
  const half = arrowWidth / 2
  const onScreen = (x: number) =>
    Math.min(Math.max(x, half + ARROW_AIR), el.clientWidth - half - ARROW_AIR)
  return {
    prev: onScreen(cardLeft),
    next: onScreen(cardLeft + at.cardRect.width),
    y: at.cardRect.top - at.railRect.top + at.cardRect.height / 2,
  }
}

/* ── this page load's shuffle seed ──────────────────────────────────────────
   Module scope so `getSnapshot` returns the same value every time React asks; a snapshot
   that changes per call re-renders forever. A full page load reshuffles, a soft navigation
   does not — which is correct, since reshuffling under a reader mid-sentence is worse than
   showing them the same twelve twice. */
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
  heading,
  lede,
}: {
  /**
   * The section heading. Each page passes its own; the default is resolved from the
   * catalogue INSIDE the component rather than in this parameter list, because a default
   * cannot call a hook. See `headingText` below.
   */
  heading?: string
  lede?: string
}) {
  const locale = useMarketingLocale()
  const t = useMarketingT()
  // English readers are told nothing, because for them there is nothing to tell — the
  // quotes are already in their language. See the note beside where this renders.
  const verbatim = locale === BASE_LOCALE ? null : t('mkt.quotes.verbatim')
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
  /**
   * Where the last programmatic scroll was AIMED, so the seam fold cannot run part-way there.
   *
   * ── THE COLLISION THIS SETTLES ───────────────────────────────────────────────
   * Stepping backward off the front of the rail parks it on the seam for an instant — at
   * exactly `period`, the position whose pixels are identical to card 0 — and then glides
   * left from there, which is how the previous card slides in rather than teleporting. But
   * `period` is also precisely the position `foldToFirstCopy` exists to undo, so the
   * `scrollend` from the park fired first, folded a whole period away, and cancelled the glide
   * on its way past. The Previous arrow at the start of the rail did nothing at all.
   *
   * Both halves were correct in isolation, which is why this is a ref and not a fix to either:
   * the fold's precondition was always "the rail is at rest", and a rail one frame into a
   * deliberate manoeuvre is not at rest, however much `scrollend` insists. The aim is what
   * tells them apart.
   *
   * A hand gesture sets no aim, so a swipe still folds on the first `scrollend` as before.
   */
  const aim = useRef<number | null>(null)
  /** The rail's positioning context: the arrows are placed against this, not against a card. */
  const stage = useRef<HTMLDivElement>(null)
  /** Measured for its width only — both arrows are the same size. */
  const arrow = useRef<HTMLButtonElement>(null)

  // Pure: same items, same seed, same order.
  const visible = useMemo(
    () =>
      TESTIMONIALS.length > TESTIMONIAL_DISPLAY_LIMIT
        ? shuffleSeeded(TESTIMONIALS, seed).slice(0, TESTIMONIAL_DISPLAY_LIMIT)
        : TESTIMONIALS.slice(0, TESTIMONIAL_DISPLAY_LIMIT),
    [seed],
  )

  /**
   * The list, twice. This is what makes the rail continuous rather than rewinding — see THE
   * RAIL DOES NOT REWIND in the header. Two copies are enough and three would be waste: the
   * fold happens the moment the second copy's first card reaches the left edge, and at that
   * point everything to the right of it is content the first copy has too.
   *
   * The second pass is hidden from assistive technology. It is the same twelve quotes, and a
   * screen reader reading twenty-four with twelve of them repeated is a worse experience than
   * anything the duplication buys.
   */
  const cards = useMemo(
    () => [
      ...visible.map(t => ({ t, clone: false })),
      ...visible.map(t => ({ t, clone: true })),
    ],
    [visible],
  )

  const drifting = !stopped && !reducedMotion && visible.length > 1

  useEffect(() => {
    if (!drifting) return
    const el = rail.current
    if (!el) return

    // Hover and focus suspend the drift without touching React state — a re-render here
    // would restart the interval and reset the reader's place.
    //
    // On the STAGE, not the rail: the arrows sit over the rail but are siblings of it, so a
    // pointer resting on one is not in the rail's event path and the rail would keep advancing
    // out from under the click. The stage covers both.
    const hover = stage.current ?? el
    let held = false
    const hold = () => { held = true }
    const release = () => { held = false }
    hover.addEventListener('pointerenter', hold)
    hover.addEventListener('pointerleave', release)
    hover.addEventListener('focusin', hold)
    hover.addEventListener('focusout', release)

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
      // There is no end to reach and nothing to rewind: fold back into the first copy if the
      // last advance crossed the seam, then move one card right, always. The fold is here
      // rather than after the scroll so it happens while the rail is at rest — and it is the
      // fallback for browsers without `scrollend`, which is the other place it is done.
      foldToFirstCopy(el, visible.length)
      aim.current = el.scrollLeft + cardStep(el)
      el.scrollTo({ left: aim.current, behavior: 'smooth' })
    }, AUTO_ADVANCE_MS)

    return () => {
      window.clearInterval(id)
      hover.removeEventListener('pointerenter', hold)
      hover.removeEventListener('pointerleave', release)
      hover.removeEventListener('focusin', hold)
      hover.removeEventListener('focusout', release)
      el.removeEventListener('wheel', takeOver)
      el.removeEventListener('pointerdown', takeOver)
      el.removeEventListener('touchstart', takeOver)
      el.removeEventListener('keydown', takeOver)
    }
  }, [drifting, visible.length])

  /**
   * The emphasis follows the rail's scroll position, written straight onto the DOM — and the
   * seam is folded away once the rail comes to rest.
   *
   * Not gated on `drifting`, deliberately, and both halves want it that way: a visitor who has
   * taken the rail over by swiping is precisely the one who cares which quote they are on, and
   * the arrows have to stay continuous after the drift has stopped for good.
   */
  useEffect(() => {
    const el = rail.current
    if (!el) return

    let frame = 0
    const mark = () => {
      frame = 0
      const index = currentCard(el)
      Array.from(el.children).forEach((card, i) => {
        if (i === index) card.setAttribute('data-current', 'true')
        else card.removeAttribute('data-current')
      })
    }
    // Coalesced to one write per frame: a snap scroll fires this event dozens of times per
    // card and every one of them would otherwise read layout back.
    const onScroll = () => { frame ||= requestAnimationFrame(mark) }
    el.addEventListener('scroll', onScroll, { passive: true })

    /**
     * `scrollend` is the only moment it is safe to fold: it fires after a gesture, its
     * momentum, and a smooth scroll have all finished, so the instant jump cannot cancel
     * anything a person is in the middle of.
     *
     * EXCEPT THAT IT ALSO FIRES PART-WAY THROUGH OUR OWN MANOEUVRES, which is what `aim` is
     * for — see the ref. A rail one frame into a two-part programmatic move is not at rest,
     * and folding it there is what stopped the Previous arrow working at the front of the
     * rail. The aim is cleared either way, so the fold that this one declines is simply made
     * by the next `scrollend`, when the rail really has arrived.
     *
     * Where the event is unsupported the listener simply never fires and the auto-advance's own
     * fold carries the drift. What is lost there is the hand-scrolled case: a visitor swiping
     * hard to the right eventually reaches the end of the second copy and stops, having seen
     * the twelve quotes twice. Reachable, not broken — and not worth a `scroll`-plus-timeout
     * reimplementation of an event the platform now has.
     */
    const onScrollEnd = () => {
      const aimed = aim.current
      aim.current = null
      if (aimed !== null && Math.abs(el.scrollLeft - aimed) > 1) return
      foldToFirstCopy(el, visible.length)
    }
    el.addEventListener('scrollend', onScrollEnd)

    // Once now, because the reshuffle has just reordered the cards under the attribute the
    // server put on the first one.
    mark()

    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', onScrollEnd)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [cards, visible.length])

  /**
   * Put the arrows either side of the current card.
   *
   * A ResizeObserver and nothing else, because `arrowAnchors` depends only on the rail's width
   * and the breakpoint's card basis — never on the scroll position. `observe` fires its
   * callback once straight away, which is the initial placement.
   */
  useEffect(() => {
    const el = rail.current
    const box = stage.current
    const button = arrow.current
    if (!el || !box || !button) return

    const observer = new ResizeObserver(() => {
      const at = arrowAnchors(el, button.offsetWidth)
      if (!at) return
      box.style.setProperty('--arrow-prev', `${at.prev}px`)
      box.style.setProperty('--arrow-next', `${at.next}px`)
      box.style.setProperty('--arrow-y', `${at.y}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function nudge(direction: 1 | -1) {
    const el = rail.current
    if (!el) return
    const step = cardStep(el)

    // Both arrows are continuous, and neither is ever a dead control at an end — but they get
    // there by moving the rail across the seam rather than by wrapping to the far side of it.
    // Forward: fold first, so there is always a copy's worth of runway ahead.
    foldToFirstCopy(el, visible.length)
    let target = el.scrollLeft + direction * step
    // Backward off the front: jump forward a whole period first, which is invisible because
    // the content there is identical, and then the scroll left is an ordinary one. `jumpTo`
    // rather than an assignment, because `scroll-smooth` would animate the assignment and
    // leave the read below returning the value from before it — which is what made the
    // Previous arrow land somewhere arbitrary at the start of the rail. The read itself
    // stays, because the browser may still clamp the jump.
    if (target < -1) {
      jumpTo(el, el.scrollLeft + step * visible.length)
      target = el.scrollLeft - step
    }

    // Declared BEFORE the scroll starts, because `scrollend` can fire for the jump above
    // while this one is still on its way — see the `aim` ref.
    aim.current = target
    el.scrollTo({ left: target, behavior: reducedMotion ? 'auto' : 'smooth' })
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
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
              {t('mkt.quotes.eyebrow')}
            </p>
            <h2 id="testimonials-heading" className="mt-3 text-3xl sm:text-4xl">
              {heading ?? t('mkt.quotes.heading')}
            </h2>
            {lede && <p className="mt-4 text-lg text-muted-foreground">{lede}</p>}
            {/* ── WHY THE QUOTES BELOW ARE IN ENGLISH ────────────────────────────────
                Shown only to a reader who is not reading English, because that is the only
                reader for whom it is information. See rule 4 in lib/testimonials.ts: a
                translated testimonial is a sentence the family never approved, so these stay
                verbatim — and an English paragraph sitting unexplained in a Spanish page
                reads as a bug rather than as a decision.

                It is `text-sm text-muted-foreground` rather than a notice or a badge. This is
                a footnote about provenance, not a warning, and dressing it as one would make
                the quotes look doubtful — which is the opposite of what leaving them
                untouched is protecting. */}
            {verbatim && (
              <p className="mt-3 text-sm text-muted-foreground">{verbatim}</p>
            )}
          </div>
        </Reveal>
      </div>

      {/* THE RAIL, and the two arrows that flank the current card.
          `tabIndex={0}` with a label because a scrollable region needs to be reachable and
          named for a keyboard user — that is what lets the arrow keys move it at all.

          `scroll-ps-6` IS THE LEFT ARROW'S ROOM, AND `ps-6` CANNOT BE. This is the whole of the
          second half of the arrow bug, and it is a snapping rule rather than a padding one: with
          `snap-mandatory` the browser aligns the snapped card's start edge to the SCROLLPORT's
          start edge, and plain `padding-left` is inside the scrollport — so the rail scrolls
          straight past it and comes to rest with the leftmost card flush against the screen.
          Measured: `scrollLeft` is 24 at rest on every width, and the card's left edge is at
          x=0. The 24px was there and could not be stood in.

          `scroll-padding-left` shrinks the SNAPPORT instead, so the rest position respects it
          and the card stops 24px in — which is exactly `half + ARROW_AIR` for a `size-10`
          arrow, the room one centred on that card's edge needs to sit on screen rather than
          be clamped inward onto the first word.

          `ps-6` stays beside it: the scroll-padding decides where the rail STOPS, and the
          padding is what makes 24px of scrollable room exist to stop in. The RIGHT padding
          stays at the page gutter so the next card still bleeds off the edge and says the rail
          scrolls.

          THE STAGE is `relative` because the arrows are positioned against it. It is also what
          the hold-on-hover listeners attach to, so that resting a pointer on an arrow stops the
          rail advancing out from under the click — see the drift effect. */}
      <div ref={stage} className="relative mt-10">
        <ul
          ref={rail}
          tabIndex={0}
          role="group"
          aria-label={t('mkt.quotes.railLabel')}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-ps-6 scroll-smooth pt-2 pe-4 pb-8 ps-6 sm:px-6 motion-reduce:scroll-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* `pt-2 pb-8` above is for the current card's shadow, which the scroll container
              would otherwise shear off at its own padding edge. */}
          {cards.map(({ t, clone }, i) => (
            <li
              /* The clone's key has to differ from the card it copies, and the quote is all
                 there is to key on — the same family, twice, is one list of twenty-four. */
              key={`${clone ? 'again' : 'first'}-${t.name}-${t.quote.slice(0, 24)}`}
              /* The server marks the first card — it cannot know how many fit, so it cannot
                 know which one is centred; `currentCard` corrects it on mount and follows the
                 rail from there. `group` is what lets the card below read it. */
              data-current={i === 0 ? 'true' : undefined}
              /* The second copy is scenery: the same quotes, already announced once by the
                 first. Safe to hide only because nothing inside a card is focusable — if one
                 ever gains a link, this becomes an aria-hidden focus trap and the duplication
                 needs rethinking rather than patching. */
              aria-hidden={clone || undefined}
              className="group flex shrink-0 basis-[85%] snap-start sm:basis-[48%] lg:basis-[32%]"
            >
              {/* THE RECEDED STATE IS THE BASE and the emphasis overrides it, because the
                  attribute marks one card out of twenty-four. An outline with muted text, then
                  fill, elevation, full-strength text and true size for the current one —
                  and the whole treatment on hover too, so a quiet card can be brought
                  forward by the visitor rather than only by the rail.

                  No `group-focus-within`, because nothing inside a card is focusable and a
                  variant that can never match reads as a promise being kept. A keyboard user
                  is covered by the rail itself: an arrow key scrolls it, and the highlight
                  follows scroll.

                  The scale is on the FIGURE, never the `<li>`: `cardStep` measures the `<li>`
                  and a transform there would corrupt every scroll calculation in the file. */}
              <figure className="relative flex w-full scale-[0.97] flex-col rounded-2xl border border-border/70 p-6 text-muted-foreground transition-[color,background-color,border-color,box-shadow,transform] duration-500 motion-reduce:transition-none hover:scale-100 hover:bg-card hover:text-foreground hover:shadow-[var(--shadow-card-hover)] group-data-[current=true]:scale-100 group-data-[current=true]:border-brand-primary/30 group-data-[current=true]:bg-card group-data-[current=true]:text-foreground group-data-[current=true]:shadow-[var(--shadow-card-hover)]">
                {/* Gold as a wash behind a decorative glyph, never as a foreground that
                    carries meaning — Legacy is 2.30 on white (see globals.css). Fainter on a
                    receded card: at full strength a rail of gold marks is the loudest thing in
                    the section, which is most of what read as overwhelming. */}
                <Quote
                  aria-hidden="true"
                  className="absolute end-5 top-5 h-8 w-8 text-brand-legacy/10 transition-colors duration-500 group-data-[current=true]:text-brand-legacy/30"
                />
                {/* pe-12 is the reason the glyph is always visible: without it a long first
                    line runs underneath the mark and both become unreadable. The padding
                    reserves the corner rather than hoping the text is short. */}
                <blockquote className="flex-1 pe-12 text-base leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                {/* The rule inside the card tracks the card's own outline, so a receded card
                    is not divided more strongly than it is bounded. */}
                <figcaption className="mt-5 border-t border-border/70 pt-4 transition-colors duration-500 group-data-[current=true]:border-border">
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

        {/* THE ARROWS, one at each edge of the current card.
            They are siblings of the rail rather than children of it, so they hold their place
            while the cards scroll past underneath — a control inside a scroll container slides
            away with its content.

            `--arrow-prev` and `--arrow-next` are arrow CENTRES, written by the placement effect
            above — `-translate-x-1/2` is what makes the custom property mean the centre — and
            they are the card's two edges, so each arrow sits half on the card and half off it.
            See `arrowAnchors` for why that lands on padding and never on a word. The fallbacks
            are the section's own edges, which is both the value for the frame before the effect
            runs and where they stay if JavaScript never arrives — no worse than the arrows
            themselves, which need it to do anything at all.

            `size-9` until `sm` is what lets the left arrow fit beside the leftmost card on a
            phone; the rail's `ps-6` there is derived from this size, so changing one means
            changing the other.

            Opaque and elevated, because unlike the header they now sit ON a card — a
            transparent chip over a quote reads as a printing error. */}
        <button
          ref={arrow}
          type="button"
          onClick={() => { setStopped(true); nudge(-1) }}
          style={{ left: 'var(--arrow-prev, 1.5rem)', top: 'var(--arrow-y, 50%)' }}
          className="absolute z-10 inline-flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted sm:size-10"
          aria-label={t('mkt.quotes.prev')}
        >
          <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => { setStopped(true); nudge(1) }}
          style={{ left: 'var(--arrow-next, calc(100% - 1.5rem))', top: 'var(--arrow-y, 50%)' }}
          className="absolute z-10 inline-flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-card text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted sm:size-10"
          aria-label={t('mkt.quotes.next')}
        >
          <ChevronRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
