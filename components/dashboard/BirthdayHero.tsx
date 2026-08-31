import Link from 'next/link'
import { Cake, PartyPopper } from 'lucide-react'
import type { T } from '@/lib/i18n/t'
import type { MyBirthdayBanner } from '@/lib/birthday-greetings'

/**
 * The gold band on a member's dashboard on their own birthday, with confetti.
 *
 * ── THE PRODUCT GREETS THE PERSON TO THEIR FACE, AND POSTS NOTHING ─────────────────
 * This is the whole of what the product writes. Nothing here reaches the family's board; a
 * pinned announcement exists only when a relative composed one, and then this band links to
 * it. `20260831000002`'s header and `app/actions/birthdays.ts` both carry the decision: a warm
 * message a relative realises was generated has told them the family did not remember.
 *
 * So the two halves of the copy are deliberately different in kind. The greeting is from
 * GENORRA and says so; the line underneath is either "your family has posted something" with a
 * way through, or nothing of the sort. **It never says the family spoke when nobody did**, and
 * `birthday.familyPosted` / `birthday.fromUs` carry a note in the catalogue saying they must
 * not be merged.
 *
 * ── A SERVER COMPONENT, WITH NO JAVASCRIPT AT ALL ─────────────────────────────────
 * It was `'use client'` with a `useEffect` gating the confetti, and `react-hooks/set-state-in-effect`
 * refused it — correctly, and the refusal pointed at a better design rather than a workaround.
 * The confetti is a CSS animation: it runs at first paint, needs no hook, no state and no
 * bundle, and the `from` keyframe is `opacity: 0` so there is no frame where static dots sit
 * on the band waiting for hydration. Nothing on this band is interactive except one `<Link>`.
 *
 * `t` is therefore a PROP — the rule `audit:client-hooks` enforces and `DuesBalanceKpi`'s own
 * prop argues: a component with no directive is compiled into whichever side imports it, and
 * `useT()` in one imported by a Server Component throws.
 *
 * ── IT DEGRADES TO SOMETHING DIGNIFIED, WHICH IS THE THIRD DECISION ───────────────
 * No photograph, no age, no year. TODO.md: *"it has to degrade to something dignified for a
 * relative with no photograph and no recorded birth year, which is most of an older generation
 * on a real family tree."* So the band draws the cake, the first name and the confetti — three
 * things every greetable member has.
 *
 * ── `--brand-legacy`, NEVER `--destructive`, AND THE GOLD HAS NO `on-` PARTNER ─────
 * Legacy gold is 2.30 against white and cannot carry text in light mode; `globals.css` says so
 * beside the token and warns that a partner token would invite exactly that. So gold is the
 * rule, the glow and the confetti, and the words sit on the Heritage fill in
 * `--brand-on-hero`. The one gold SURFACE is the link, which carries `--brand-ink` — ink on
 * gold is 6.14, the pairing that token's note names as the safe one.
 */
export function BirthdayHero({ banner, t }: { banner: MyBirthdayBanner; t: T }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-legacy/40 bg-brand-hero px-5 py-6 sm:px-7 sm:py-7">
      <Confetti />

      {/* The gold hairline along the top — the kit's treatment for a celebratory band, and the
          one place `--brand-legacy` is unambiguously right: a rule carries no text. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-brand-legacy" />

      <div className="relative flex items-start gap-3 sm:gap-4">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-legacy/20 text-brand-legacy sm:size-12"
        >
          <Cake className="size-5 sm:size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-legacy">
            {t('birthday.today')}
          </p>
          <h2 className="mt-1 text-2xl font-bold leading-tight text-brand-on-hero sm:text-3xl">
            {t('birthday.heroGreeting', { name: banner.firstName })}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm text-brand-on-hero/85">
            {/* TWO DIFFERENT SENTENCES, and the difference is the whole design. */}
            {banner.greetedAnnouncementId ? t('birthday.familyPosted') : t('birthday.fromUs')}
          </p>
          {banner.greetedAnnouncementId && (
            <Link
              href="/community/announcements"
              // Explicit colour: `globals.css` carries an unscoped
              // `a { color: var(--brand-accent) }`, which on this Heritage band would come out
              // terracotta on burgundy and be nearly unreadable. Same trap MainRail, Sidebar
              // and AdminAccountShell each carry a comment about.
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-legacy px-3 py-1.5 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90"
            >
              <PartyPopper className="size-4" aria-hidden="true" />
              {t('birthday.readIt')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The confetti.
 *
 * ── CSS AND NO LIBRARY, FOR `MarketingHeader`'s REASON ────────────────────────────
 * Thirty absolutely positioned spans and two keyframes. A confetti package is a dependency, a
 * canvas and a render loop bought for one band that appears on one day a year — and this file
 * sits in the Dashboard's tree, which every member loads.
 *
 * ── IT RUNS ONCE AND STOPS, AND THAT IS ACCESSIBILITY RATHER THAN TASTE ───────────
 * Three seconds, `animation-iteration-count: 1`. A permanent animation on the screen a member
 * lands on is what WCAG 2.2.2 is about, and it is irritating by the fourth page load besides.
 * `motion-reduce:hidden` removes it entirely rather than slowing it: somebody who has asked
 * for no motion has asked for no motion, and thirty static dots would be the worse answer for
 * decoration that carries no information. `globals.css` belts that with `display: none` on the
 * two classes.
 *
 * ── DETERMINISTIC, NOT RANDOM ─────────────────────────────────────────────────────
 * `Math.random()` in a component that renders on the server is a hydration mismatch, and the
 * calendar module already refuses `Math.random()` for the same class of reason. A fixed spread
 * also reads as designed rather than as noise.
 */
function Confetti() {
  const pieces = Array.from({ length: 30 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 10) * 0.12}s`,
    // The brand's own celebratory set: Legacy gold, Warmth, and the cream already on this band.
    tone: ['bg-brand-legacy', 'bg-brand-warm', 'bg-brand-on-hero'][i % 3],
    size: i % 4 === 0 ? 'h-2.5 w-1' : 'h-1.5 w-1.5',
    spin: i % 2 === 0 ? 'gn-confetti-a' : 'gn-confetti-b',
  }))

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 rounded-[1px] ${p.tone} ${p.size} ${p.spin}`}
          style={{ left: p.left, animationDelay: p.delay }}
        />
      ))}
    </span>
  )
}
