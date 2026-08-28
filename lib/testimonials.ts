import { APP_NAME } from '@/lib/brand'

/**
 * What families say. Supplied by the owner, 2026-08-12.
 *
 * ── THREE RULES FOR ANYONE EDITING THIS FILE ────────────────────────────────
 *
 * 1. DO NOT WRITE A TESTIMONIAL. Every entry below came from the business owner, who is
 *    the only person who can speak to whether a family said it and agreed to be quoted.
 *    Inventing one is not a copywriting shortcut — fabricated consumer testimonials are
 *    specifically regulated in the United States (the FTC's rule on fake reviews and
 *    testimonials, 16 CFR Part 465) and carry civil penalties per violation. For a product
 *    whose whole proposition is "trust us with your family's private records", being caught
 *    inventing the families who praised it forfeits the only argument it was making.
 *
 * 2. DO NOT EDIT THE WORDS. Not for grammar, not for length, and — this is the one that
 *    will come up — NOT TO MATCH A STYLE GUIDE. The site is removing corporate vocabulary
 *    from its own voice, and two quotes here contain exactly the words being removed: the
 *    Cooper Family says "our family organization" and the Green Family says "our family
 *    leadership team". Those are their words. A copy sweep stops at the quotation marks.
 *    If a quote genuinely has to change, it goes back to the family for re-approval; it
 *    does not get tidied.
 *
 * 3. `attribution` IS OPTIONAL AND CURRENTLY ABSENT ON EVERY ENTRY. The owner supplied
 *    family names only, so that is what renders. Do not fill the field in with a plausible
 *    role or city — "Reunion chair, Atlanta GA" invented to balance a card is a fabricated
 *    detail attached to a real family's name, which is worse than the empty space it fixed.
 *
 * 4. DO NOT TRANSLATE THEM. Added 2026-08-27, when the public site learned Spanish and
 *    French. This is rule 2 rather than a new rule — **a translation IS an edit of the
 *    words**, and one produced by a machine or by whoever is doing the i18n pass is by
 *    construction a sentence the family did not say and did not approve. Putting it inside
 *    quotation marks over their name is the fabrication rule 1 is about, arriving through a
 *    door that feels like housekeeping.
 *
 *    So `TESTIMONIALS` is NOT in any catalogue and must not be moved into one. Spanish and
 *    French readers see the quotes in the language the families gave them, and the section
 *    says so in one line above the rail — `mkt.quotes.verbatim` — because an English
 *    paragraph sitting unexplained in a Spanish page reads as a bug rather than as a
 *    decision. The CHROME around them is fully translated: the eyebrow, the heading, the
 *    two arrows and the rail's own label.
 *
 *    What would make a translation admissible is the same thing that would make an edit
 *    admissible: the family approving the new words. That is a conversation, not a commit.
 *
 * ── ON THE PRODUCT NAME INSIDE THE QUOTES ───────────────────────────────────
 * It is interpolated rather than typed, because AGENTS.md keeps it in exactly one place so
 * a rename cannot leave half the app behind. Note what that does and does not buy here: it
 * keeps these quotes CONSISTENT with the rest of the app through a rename, and consistency
 * is not permission. If the product is ever renamed, these quotes go back to the families —
 * a sentence somebody approved about one name is not a sentence they approved about the
 * next one.
 */

export interface Testimonial {
  /** Verbatim. See rule 2. */
  quote: string
  /** The name the family agreed to be published under. */
  name: string
  /** Role and/or place, ONLY if the family actually gave one. See rule 3. */
  attribution?: string
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    name: 'The Williams Family',
    quote: `${APP_NAME} gave our family one place to keep everything organized. Instead of searching through group texts, emails, and spreadsheets, we can see what's happening and what needs attention in one place.`,
  },
  {
    name: 'The Johnson Family',
    quote: `Our family is spread across several states, so keeping everyone informed has always been a challenge. ${APP_NAME} makes it much easier for us to stay connected no matter where everyone lives.`,
  },
  {
    name: 'The Robinson Family',
    quote: `Planning our family reunion used to mean juggling spreadsheets, payment apps, and endless text messages. ${APP_NAME} brought everything together and made the entire process feel manageable.`,
  },
  {
    name: 'The Harris Family',
    quote: `What we love most about ${APP_NAME} is that it feels like it was actually built for families. It helps us stay organized without making things complicated.`,
  },
  {
    name: 'The Jackson Family',
    quote: `Collecting family dues used to be one of the hardest responsibilities for our committee. ${APP_NAME} gives everyone a clear place to see what they owe and take care of it.`,
  },
  {
    name: 'The Thompson Family',
    quote: `We have multiple generations in our family, and ${APP_NAME} gives us a way to keep everyone connected while also preserving the history and relationships that make our family special.`,
  },
  {
    name: 'The Davis Family',
    quote: `${APP_NAME} has helped us move away from scattered information. Our announcements, events, family details, and payments finally have a home.`,
  },
  {
    name: 'The Green Family',
    quote: `Our family leadership team needed something simple enough for everyone to use but organized enough to actually help us run things. ${APP_NAME} has been a great fit.`,
  },
  {
    name: 'The Brown Family',
    quote: `The biggest difference for us is communication. Everyone knows where to go for family updates instead of wondering whether something was posted in a text thread they missed.`,
  },
  {
    name: 'The Carter Family',
    quote: `${APP_NAME} makes our family feel more connected between reunions. It's not just something we use once a year—it gives us a place to continue building those relationships all year long.`,
  },
  {
    name: 'The Mitchell Family',
    quote: `We wanted a better way to preserve our family legacy while still handling the everyday things like events and dues. ${APP_NAME} gives us both.`,
  },
  {
    name: 'The Walker Family',
    quote: `Our family has grown so much that managing everything through group chats became overwhelming. ${APP_NAME} gives us structure without taking away the personal feeling of being a family.`,
  },
  {
    name: 'The Lewis Family',
    quote: `Having our family tree, events, announcements, and other important information together makes a huge difference. ${APP_NAME} has helped us become much more organized.`,
  },
  {
    name: 'The Anderson Family',
    quote: `Not everyone in our family is extremely tech-savvy, so simplicity mattered to us. ${APP_NAME} feels straightforward and gives us the tools we need without overwhelming people.`,
  },
  {
    name: 'The Moore Family',
    quote: `Before ${APP_NAME}, there was always a question about where to find something. Now our family members know exactly where to go for updates, events, and other important information.`,
  },
  {
    name: 'The Taylor Family',
    quote: `Our reunion committee spends a lot of time behind the scenes keeping things together. ${APP_NAME} helps reduce some of that administrative work and makes it easier for the whole family to participate.`,
  },
  {
    name: 'The Wilson Family',
    quote: `We love having a dedicated space that belongs to our family. Social media is great for some things, but ${APP_NAME} feels more intentional and focused on keeping our family connected.`,
  },
  {
    name: 'The Martin Family',
    quote: `${APP_NAME} has made it easier to involve younger generations in our family while still honoring the history and traditions established by those who came before us.`,
  },
  {
    name: 'The Cooper Family',
    quote: `For years we talked about needing a better system for our family organization. ${APP_NAME} finally gives us one place for communication, planning, payments, and connection.`,
  },
  {
    name: 'The Allen Family',
    quote: `${APP_NAME} helps us do more than organize a reunion—it helps us organize our family. From staying connected to preserving our history and planning for the future, it gives us a foundation we can continue building on for generations.`,
  },
  {
    name: 'The Henderson Family',
    quote: `${APP_NAME} feels like our family finally has a space that belongs to us. I can share pictures of the kids, family updates, and memories without feeling like we're putting our lives on display for the rest of the internet.`,
  },
  {
    name: 'The Richardson Family',
    quote: `We used to depend on online groups to keep everyone informed, but important posts were always getting buried. ${APP_NAME} is different because everything is centered around our family. No noise, no distractions—just us.`,
  },
  {
    name: 'The Washington Family',
    quote: `One of my favorite things about ${APP_NAME} is being able to enjoy and share pictures of our children in a space designed for family instead of wondering how those photos might be used elsewhere. That peace of mind means a lot to us.`,
  },
  {
    name: 'The Brooks Family',
    quote: `Our family group had hundreds of posts, conversations, and pictures, but finding anything from six months ago was almost impossible. ${APP_NAME} actually organizes our family instead of just giving us another feed to scroll through.`,
  },
  {
    name: 'The Jefferson Family',
    quote: `I didn't realize how much I disliked mixing our private family moments with everything else online until we started using ${APP_NAME}. Now our reunions, announcements, pictures, dues, and family history all have their own home.`,
  },
  {
    name: 'The Coleman Family',
    quote: `${APP_NAME} feels more personal. When I open it, I'm there because of my family—not to scroll through ads, strangers, trending content, or things an algorithm thinks I should see. I really appreciate that difference.`,
  },
  {
    name: 'The Bryant Family',
    quote: `We have children, parents, grandparents, cousins, and relatives all trying to stay connected. ${APP_NAME} gives us a family-centered space where everyone can participate without our memories becoming part of somebody else's content machine.`,
  },
  {
    name: 'The Parker Family',
    quote: `For me, it comes down to ownership and purpose. Our family pictures, conversations, events, and history deserve something more intentional than a general online group. ${APP_NAME} feels like our digital family home, and that's exactly what we were looking for.`,
  },
]

/**
 * How many go into the rail, however many are in the array.
 *
 * TWELVE, raised from eight on 2026-08-13 at the owner's request — and what the number
 * controls is not what it was when it was eight. That was a wall of cards, where the count
 * was "how many will be read before the grid becomes texture rather than evidence". The rail
 * shows two or three at a time, so the count is now its PERIOD: how far a visitor can watch
 * before a quote they have already seen comes round again. Twelve at eight seconds is a
 * minute and a half of new families.
 *
 * It is also the DOM cost, doubled: the rail is continuous, so it renders this many cards
 * twice and folds back at the seam — 24 `<li>` at twelve. See the header of
 * `components/marketing/Testimonials.tsx` for why that is how the seam is hidden.
 *
 * With 28 collected, the component still draws a random subset per page load, so a returning
 * visitor meets different families and the whole collection eventually gets read instead of
 * the last sixteen entries never being seen by anybody.
 */
export const TESTIMONIAL_DISPLAY_LIMIT = 12

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
