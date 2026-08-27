import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { localizedHref } from '@/lib/i18n/route-locale'
import { marketingI18n } from '@/lib/marketing/locale'

/**
 * The closing ask, on every page.
 *
 * ── IT IS ITS OWN FILE, AND THE RSC BOUNDARY IS WHAT PUT IT HERE ────────────────────
 * It lived in `components/marketing/sections.tsx` beside `SectionHeading`, `ComingSoonBadge` and
 * `MoreLink` until the public site learned Spanish and French, and it had to leave the moment it
 * started resolving its own copy.
 *
 * The reason is one import trace. `PlanLadder` is `'use client'` and imports `ComingSoonBadge`
 * from that file, so the whole module lands in a browser bundle — and this band now calls
 * `marketingI18n()`, which reads `next/headers`. `next build` refuses that, correctly, naming
 * the file. Splitting is the fix rather than threading a `t` prop through six pages, because a
 * prop is the thing a seventh page forgets.
 *
 * So the division is: anything a client component may import stays in `sections.tsx` and takes
 * its copy as a prop; anything that resolves the reader's language for itself is a server
 * component and lives on its own. This is the second instance of that split in one commit —
 * `MarketingFooter` resolves and `MarketingHeader` uses a context, for the same reason.
 *
 * IDENTICAL EVERYWHERE ON PURPOSE — same ground, same gold button, same words. A visitor
 * who scrolled past it on the features page should recognise it on the pricing page
 * rather than having to re-read it. The landing page's own closing band established the
 * pattern; this is that band, extracted.
 *
 * Gold on burgundy is the brand's signature pairing and the highest-contrast thing on the
 * page, which is where the primary action belongs. `text-brand-on-legacy` is Ink in BOTH
 * themes — plain `text-brand-ink` turns cream in dark mode and fails at 1.65 on gold.
 *
 * ── IT IS `async` AND RESOLVES ITS OWN COPY; `ComingSoonBadge` BELOW TAKES A PROP ────
 * The two are in one file and are localized in opposite ways, which is not an inconsistency —
 * it is the RSC boundary deciding for us. This band is rendered by the six marketing pages and
 * by nothing else, all of them server components, so it can `await`. `ComingSoonBadge` is
 * rendered by `FeatureShowcase` and `PlanLadder`, both `'use client'`, so it cannot: an async
 * component in a client tree is not a thing React will render.
 *
 * So the badge takes its one word as a REQUIRED prop. Required rather than defaulted, because a
 * default is the thing a call site does not pass — and an English default here would be a
 * *Coming soon* pill on a Spanish page, which is exactly the failure this whole phase is about.
 *
 * ── THE THREE DEFAULTS ARE GONE, AND THAT IS THE SAME ARGUMENT ──────────────────────
 * `title`, `lede` and `primaryLabel` were optional with English defaults. They are optional with
 * TRANSLATED defaults now — resolved from the catalogue rather than written in the signature —
 * so a page that passes nothing gets the right language, and a page that passes something has
 * said so deliberately.
 */
export async function CtaBand({
  title,
  lede,
  primaryLabel,
}: {
  title?: string
  lede?: string
  primaryLabel?: string
}) {
  const { t, locale } = await marketingI18n()

  return (
    <section className="relative overflow-hidden bg-brand-hero px-4 py-20 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="gn-float-slow absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-brand-legacy/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="mb-4 text-3xl text-brand-on-primary sm:text-4xl">
          {title ?? t('mkt.cta.title')}
        </h2>
        <p className="mb-9 text-lg text-brand-on-primary/80">{lede ?? t('mkt.cta.lede')}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={localizedHref(ACCOUNT_ROUTES.register, locale)}>
            <Button
              size="lg"
              className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto"
            >
              {primaryLabel ?? t('mkt.cta.primary')}
            </Button>
          </Link>
          <Link href={localizedHref('/how-it-works', locale)}>
            <Button
              size="lg"
              className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto"
            >
              {t('mkt.cta.secondary')}
            </Button>
          </Link>
        </div>
        <p className="mt-7 text-sm text-brand-on-primary/70">
          {t('mkt.cta.reassure')}
        </p>
      </div>
    </section>
  )
}
