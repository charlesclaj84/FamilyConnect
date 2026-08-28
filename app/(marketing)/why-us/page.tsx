import type { Metadata } from 'next'
import Link from 'next/link'
import {
  MessageSquareX, TableProperties, Share2, Ticket,
  ShieldCheck, Users, Wallet, Search, Layers, Heart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { Testimonials } from '@/components/marketing/Testimonials'
import { PageHero, SectionHeading, MoreLink } from '@/components/marketing/sections'
import { CtaBand } from '@/components/marketing/CtaBand'
import { marketingPageGraph } from '@/lib/structured-data'
import { ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { localizedHref } from '@/lib/i18n/route-locale'
import { marketingI18n } from '@/lib/marketing/locale'
import { localizedAlternates } from '@/lib/i18n/route-locale'
import { type T } from '@/lib/i18n/t'
import { MetaViewContent } from '@/components/meta/MetaViewContent'

/**
 * ── THE LENGTH BUDGETS ARE PER LANGUAGE NOW, AND THEY ARE REAL ──────────────────────
 * The two comments this replaced measured characters against what a search result actually
 * shows: ~155 on desktop, ~120 on a phone for the description, and ~60 for the title once
 * `title.template` has appended the product name. Both drafts had been cut mid-clause.
 *
 * Neither number changes when the language does, and Spanish and French both run longer than
 * English for the same thought — so the catalogue entries are written to the budget rather than
 * translated faithfully past it. `mkt.why.metaTitle` is the tight one: a literal rendering of
 * *Why Families Choose Us Over Spreadsheets* does not fit, so the Spanish and French drop the
 * comparison and keep the claim, which is the half a searcher is scanning for.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await marketingI18n()
  return {
    title: t('mkt.why.metaTitle'),
    description: t('mkt.why.metaDescription'),
    alternates: localizedAlternates('/why-us', locale),
  }
}

/**
 * ── WHY NO COMPETITOR IS NAMED ON THIS PAGE ─────────────────────────────────
 * The comparisons below are to CATEGORIES — a group chat, a spreadsheet, a social group,
 * a generic ticketing tool — and never to a named product. That is a deliberate limit,
 * not timidity:
 *
 *  * A claim about a named competitor's features or price is a factual assertion about
 *    somebody else's business, and it is wrong the moment they ship a release. Comparative
 *    advertising that turns out to be inaccurate is actionable in a way that "a spreadsheet
 *    cannot chase the person who said they would book the hall" simply is not.
 *  * Nobody can verify our claim about their roadmap, but every reader can verify the
 *    category claims here against their own last reunion. Arguments the reader can check
 *    themselves are the ones that persuade.
 *
 * Every statement about OUR side is checkable against the product. Keep it that way — see
 * the rule in `lib/structured-data.ts`, which governs the prose as much as the markup.
 */

/**
 * The four categories, in the reader's language.
 *
 * The rule the header above states survives translation and is worth restating because a
 * translator is exactly who might break it: these are CATEGORIES and never named products. A
 * language whose market has one dominant spreadsheet or one dominant messaging app must still
 * say *a spreadsheet* and *the family group text* — the argument is that a reader can check the
 * claim against their own last reunion, and naming somebody's product replaces a checkable claim
 * with a factual assertion about a third party.
 */
const ALTERNATIVE_ICONS: readonly LucideIcon[] = [MessageSquareX, TableProperties, Share2, Ticket]

function alternatives(t: T): readonly {
  icon: LucideIcon
  what: string
  problem: string
  cost: string
}[] {
  return ALTERNATIVE_ICONS.map((icon, i) => ({
    icon,
    what: t(`mkt.why.alt${i}.what`),
    problem: t(`mkt.why.alt${i}.problem`),
    cost: t(`mkt.why.alt${i}.cost`),
  }))
}

/**
 * The six reasons, in the reader's language. Icons and colour tokens stay.
 *
 * "Every one of these is checkable inside the product on the day you sign up" is the section's
 * own promise, and it binds the translation: each of the six names a mechanism that exists, so
 * the words for it come from the product's own vocabulary in that language rather than from a
 * dictionary. *Separation of duties* is *separación de funciones* / *séparation des tâches*
 * because that is how `lib/plans.ts` sells it.
 */
const REASON_SHAPES: readonly { icon: LucideIcon; tone: string; chip: string }[] = [
  { icon: Layers, tone: 'text-brand-accent', chip: 'bg-brand-accent/12' },
  { icon: Users, tone: 'text-brand-affirm', chip: 'bg-brand-affirm/15' },
  { icon: ShieldCheck, tone: 'text-brand-ink', chip: 'bg-brand-legacy/20' },
  { icon: Wallet, tone: 'text-brand-accent', chip: 'bg-brand-accent/12' },
  { icon: Search, tone: 'text-brand-affirm', chip: 'bg-brand-affirm/15' },
  { icon: Heart, tone: 'text-brand-ink', chip: 'bg-brand-legacy/20' },
]

function reasons(t: T) {
  return REASON_SHAPES.map((shape, i) => ({
    ...shape,
    title: t(`mkt.why.reason${i}.title`),
    detail: t(`mkt.why.reason${i}.detail`),
  }))
}

export default async function WhyUsPage() {
  const { t, locale } = await marketingI18n()
  const ALTERNATIVES = alternatives(t)
  const REASONS = reasons(t)

  return (
    <>
      <MetaViewContent content="whyUs" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/why-us',
          name: t('mkt.why.graphName'),
          description: t('mkt.why.metaDescription'),
        })}
      />

      <PageHero
        eyebrow={t('mkt.why.eyebrow')}
        title={t('mkt.why.title')}
        lede={t('mkt.why.lede')}
      >
        <Link href={localizedHref(ACCOUNT_ROUTES.register, locale)}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            {t('mkt.why.heroPrimary')}
          </Button>
        </Link>
        <Link href={localizedHref('/features', locale)}>
          <Button size="lg" className="w-full border-brand-on-primary/40 bg-transparent px-8 text-base text-brand-on-primary hover:bg-brand-on-primary/10 sm:w-auto">
            {t('mkt.why.heroSecondary')}
          </Button>
        </Link>
      </PageHero>

      {/* ── What you're using now ────────────────────────────────────────── */}
      <section aria-labelledby="alternatives-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="alternatives-heading"
            eyebrow={t('mkt.why.altEyebrow')}
            title={t('mkt.why.altTitle')}
            lede={t('mkt.why.altLede')}
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {ALTERNATIVES.map((alt, i) => (
              <Reveal key={i} delay={(i % 2) * 150} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className="mb-4 inline-flex rounded-xl bg-muted p-2.5">
                    <alt.icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl">{alt.what}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{alt.problem}</p>
                  <p className="mt-4 border-l-2 border-destructive/40 pl-3 text-sm font-medium">
                    {alt.cost}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Six reasons ──────────────────────────────────────────────────── */}
      <section aria-labelledby="reasons-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            id="reasons-heading"
            eyebrow={t('mkt.why.reasonsEyebrow')}
            title={t('mkt.why.reasonsTitle')}
            lede={t('mkt.why.reasonsLede')}
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {REASONS.map((reason, i) => (
              <Reveal key={i} delay={(i % 3) * 160} className="h-full">
                <div className="group h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
                  <div className={`mb-4 inline-flex rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${reason.chip}`}>
                    <reason.icon className={`h-6 w-6 ${reason.tone}`} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold">{reason.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {reason.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The switch is cheap ──────────────────────────────────────────── */}
      <section aria-labelledby="switch-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="rounded-2xl border-2 border-brand-primary/25 bg-card p-6 shadow-[var(--shadow-card-hover)] sm:p-8">
              <h2 id="switch-heading" className="text-2xl">
                {t('mkt.why.switchTitle')}
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {t('mkt.why.switchLede')}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <MoreLink href={localizedHref('/how-it-works', locale)}>
                  {t('mkt.why.switchSteps')}
                </MoreLink>
                <MoreLink href={localizedHref('/pricing', locale)}>
                  {t('mkt.why.switchCost')}
                </MoreLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Testimonials
        heading={t('mkt.why.testimonials')}
        lede={t('mkt.why.testimonialsLede')}
      />

      <CtaBand
        title={t('mkt.why.ctaTitle')}
        lede={t('mkt.why.ctaLede')}
        primaryLabel={t('mkt.why.ctaPrimary')}
      />
    </>
  )
}
