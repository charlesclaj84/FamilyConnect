/**
 * Real quotes from real families. Paste them here.
 *
 * ── THE ARRAY IS EMPTY, AND FILLING IT WITH INVENTED QUOTES IS NOT AN OPTION ──
 * Not a stylistic position. Fabricated consumer testimonials are specifically regulated
 * in the United States — the FTC's rule on fake reviews and testimonials (16 CFR Part 465,
 * effective 2024) reaches invented endorsements and carries civil penalties per violation,
 * and "we were going to replace them with real ones" is not a defence for the period they
 * were published. A cached search result outlives the edit that was going to fix it.
 *
 * It is also the worst possible risk for THIS product. The entire proposition is "trust us
 * with your family's private records, their addresses and your children's names". A brand
 * caught inventing the families who praised it has lost the only argument it was making,
 * and the screenshot is permanent.
 *
 * And they do not work. Anyone evaluating software has learned to discount a wall of
 * five-star cards attributed to plausible names. Two verifiable quotes outperform seventy
 * invented ones, and the gap is not close.
 *
 * ── HOW TO FILL IT PROPERLY ─────────────────────────────────────────────────
 * 1. Ask families who have actually used it. The reunion chair, the treasurer, the person
 *    who was keeping the spreadsheet — they are the ones with something specific to say.
 * 2. Get permission in writing for the exact wording and the exact attribution. Drafting a
 *    quote and asking someone to approve or edit it is normal practice and entirely fine;
 *    publishing one they never saw is not.
 * 3. Quote them verbatim. Do not tidy the grammar — the unevenness is what makes it read
 *    as a person rather than as copy.
 * 4. Attribute honestly. A first name and a family is plenty: "Deborah, Allen Family
 *    Reunion". A role adds weight: "Treasurer, Whitfield Family Association".
 * 5. Two is enough to publish. The grid is built to read deliberately at two, three or
 *    eight rather than looking sparse.
 *
 * Once there are real ones, add `Review` nodes and an honest `aggregateRating` to
 * `lib/structured-data.ts` — page first, markup second, which is the order that file's
 * header insists on.
 */

export interface Testimonial {
  /** Verbatim. */
  quote: string
  /** The name they agreed to be published under. */
  name: string
  /** Their role and/or family, e.g. 'Reunion chair, Allen Family'. */
  attribution: string
}

/**
 * EMPTY ON PURPOSE. Adding an entry publishes it to genorra.com.
 *
 * There is no length restriction: the card is built for a one-line reaction and for a
 * four-line story, and a mix of both is what a real collection looks like.
 */
export const TESTIMONIALS: readonly Testimonial[] = []

/**
 * How many appear at once, however many are in the array.
 *
 * Eight, because a testimonial wall stops being read at about that point — past it the
 * cards become texture rather than evidence, and the visitor scrolls. With more than eight
 * collected, the component shows a random eight per page load, so a returning visitor sees
 * different families and the whole collection eventually gets read.
 */
export const TESTIMONIAL_DISPLAY_LIMIT = 8

/**
 * mulberry32 — a small, fast PRNG that is DETERMINISTIC given its seed.
 *
 * The seed is what makes the shuffle usable from a React render. `Math.random()` called
 * while rendering is impure: React may re-run a render, and a component that returns a
 * different order each time it is asked is one that flickers. Seeded, `shuffleSeeded` is a
 * pure function of its arguments, so it can live in a `useMemo` and be correct.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher-Yates, on a copy, driven by a seeded generator.
 *
 * `sort(() => Math.random() - 0.5)` is the usual one-liner and it is genuinely broken — the
 * comparator is inconsistent, so the result is neither uniform nor stable across engines,
 * and V8's sort systematically favours some positions. This is correct and it is pure.
 *
 * A seed of 0 returns the original order untouched, which is what the server renders: see
 * the component for why the server and the client deliberately disagree here, and how that
 * is done without a hydration mismatch.
 */
export function shuffleSeeded<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items]
  if (seed === 0) return copy
  const rand = mulberry32(seed)
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
