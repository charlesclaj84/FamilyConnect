import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { cn } from '@/lib/utils'

/**
 * The three pieces every marketing page repeats, in one file so six pages cannot drift
 * into six slightly different versions of the same band.
 *
 * They are server components. Nothing here is interactive — `Reveal` is the only client
 * boundary and it is already isolated — so the public surface pays for one small
 * observer and nothing else.
 */

/**
 * A page's opening band: eyebrow, `h1`, lede, and optional actions.
 *
 * `h1` RATHER THAN `h2`, and only one of these per page. Each marketing page is about one
 * thing and this states it — the SEO audit that prompted these pages flagged two of the
 * existing ones for having no `h1` at all, and a page whose largest text is not its
 * heading has the same problem in a subtler form.
 *
 * The animation is CSS (`gn-rise`), not `Reveal`. This is above the fold on every page,
 * and an intersection observer here either fires immediately or holds the hero blank
 * until React hydrates — see the note on `Reveal`.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: ReactNode
  lede: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden bg-brand-hero px-4 py-16 sm:px-6 sm:py-20">
      {/* Atmospheric only. Two soft pools stop a large flat field of burgundy reading as
          a plain colour block — the same treatment as the landing hero, so the pages feel
          like one site. `aria-hidden`, because they mean nothing. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="gn-float absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-legacy/12 blur-3xl" />
        <div className="gn-float-slow absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-brand-accent/12 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="gn-rise text-xs font-semibold uppercase tracking-[0.18em] text-brand-legacy">
          {eyebrow}
        </p>
        {/* Explicit colour: the base layer paints h1/h2 with --brand-ink, which is
            burgundy in light mode and invisible on this ground. */}
        <h1 className="gn-rise gn-rise-1 mt-4 text-4xl leading-[1.15] text-brand-on-primary lg:text-5xl">
          {title}
        </h1>
        <p className="gn-rise gn-rise-2 mx-auto mt-5 max-w-2xl text-lg text-brand-on-primary/80 sm:text-xl">
          {lede}
        </p>
        {children && (
          <div className="gn-rise gn-rise-3 mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            {children}
          </div>
        )}
      </div>
    </section>
  )
}

/** A centred section heading for the bands below a hero. `h2`, since the page has its h1. */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
  onDark = false,
}: {
  eyebrow?: string
  title: ReactNode
  lede?: ReactNode
  id?: string
  onDark?: boolean
}) {
  return (
    <Reveal>
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow && (
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-[0.18em]',
              onDark ? 'text-brand-legacy' : 'text-brand-accent',
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className={cn('mt-3 text-3xl sm:text-4xl', onDark && 'text-brand-on-primary')}
        >
          {title}
        </h2>
        {lede && (
          <p
            className={cn(
              'mt-4 text-lg',
              onDark ? 'text-brand-on-primary/80' : 'text-muted-foreground',
            )}
          >
            {lede}
          </p>
        )}
      </div>
    </Reveal>
  )
}

/**
 * The closing ask, on every page.
 *
 * IDENTICAL EVERYWHERE ON PURPOSE — same ground, same gold button, same words. A visitor
 * who scrolled past it on the features page should recognise it on the pricing page
 * rather than having to re-read it. The landing page's own closing band established the
 * pattern; this is that band, extracted.
 *
 * Gold on burgundy is the brand's signature pairing and the highest-contrast thing on the
 * page, which is where the primary action belongs. `text-brand-on-legacy` is Ink in BOTH
 * themes — plain `text-brand-ink` turns cream in dark mode and fails at 1.65 on gold.
 */
export function CtaBand({
  title = 'Bring your family together',
  lede = 'Create your free account and have your first reunion, directory and family tree running this week.',
  primaryLabel = 'Create Your Free Account',
}: {
  title?: string
  lede?: string
  primaryLabel?: string
}) {
  return (
    <section className="relative overflow-hidden bg-brand-hero px-4 py-20 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="gn-float-slow absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-brand-legacy/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="mb-4 text-3xl text-brand-on-primary sm:text-4xl">{title}</h2>
        <p className="mb-9 text-lg text-brand-on-primary/80">{lede}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={ACCOUNT_ROUTES.register}>
            <Button
              size="lg"
              className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto"
            >
              {primaryLabel}
            </Button>
          </Link>
          <Link href="/how-it-works">
            <Button
              size="lg"
              className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto"
            >
              See how it works
            </Button>
          </Link>
        </div>
        <p className="mt-7 text-sm text-brand-on-primary/70">
          Free to start. No card required. Your family&apos;s data is never shared or sold.
        </p>
      </div>
    </section>
  )
}

/** The pill that marks something as not-yet-shipped. Used wherever a roadmap item appears. */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // `w-fit` because this is rendered on its own line as often as it is rendered
        // beside a heading, and a flex COLUMN stretches its children: on /features'
        // catalogue cards the pill ran the full width of the card and read as a banner
        // rather than as a tag. `inline-flex` alone does not survive being a flex item.
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-brand-legacy/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-ink',
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" /> Coming soon
    </span>
  )
}

/** An inline "read more" link, styled once so six pages agree. */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent transition-colors hover:text-brand-ink"
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  )
}
