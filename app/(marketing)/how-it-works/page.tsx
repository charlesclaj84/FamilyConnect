import type { Metadata } from 'next'
import Link from 'next/link'
import { UserPlus, KeyRound, Users, CalendarCheck, Wallet, Rocket } from 'lucide-react'
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
 * ── `generateMetadata` RATHER THAN A STATIC OBJECT, AND IT COSTS NOTHING ────────────
 * The title, the description and the `hreflang` set are all per-language now, and none of them
 * can be a module constant any more. That is normally a real cost on the Dashboard — a
 * `generateMetadata` there would need `getUser()` for a browser-tab title — and here it is
 * free: `marketingI18n()` reads a request header `proxy.ts` has already written, and the read is
 * request-cached, so the page body below asking again is not a second one.
 *
 * The 60-character budget the old comment measured still applies and still applies PER LANGUAGE.
 * `mkt.hiw.metaTitle` is held to roughly the English length in the catalogue for that reason — a
 * faithful Spanish rendering of *Set Up Your Family Portal in an Evening* runs past the display
 * budget and is truncated, and a cut title is worse than a shorter one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await marketingI18n()
  return {
    title: t('mkt.hiw.metaTitle'),
    description: t('mkt.hiw.metaDescription'),
    alternates: localizedAlternates('/how-it-works', locale),
  }
}

/**
 * THE STEPS DESCRIBE THE ACTUAL FLOW, in the actual order, using the actual words the
 * product uses on screen — "family code", "approve", "dues plan". A how-it-works page
 * that paraphrases is a page that stops matching the product at the next release, and the
 * first person to notice is somebody who followed it and got lost.
 *
 * ── AND THAT RULE IS WHAT MAKES THE TRANSLATION A JUDGEMENT ─────────────────────────
 * "The actual words the product uses on screen" is a constraint that now has to hold in three
 * languages rather than one. So *family code* is *código familiar* here because that is what
 * `/register` calls it in Spanish, and *dues plan* is *plan de cuotas* because that is what
 * `/accounting/dues-and-donations` calls it — the shell catalogue is the authority, and a
 * better-sounding word that no screen uses would break exactly the promise above.
 *
 * A function of `t` rather than a const, which is the conversion ~40 caption registries in this
 * product have already been through. The ICONS are not copy and stay where they are.
 */
const STEP_ICONS: readonly LucideIcon[] = [UserPlus, KeyRound, Users, CalendarCheck, Wallet]

function steps(t: T): readonly { icon: LucideIcon; title: string; detail: string; aside?: string }[] {
  return STEP_ICONS.map((icon, i) => ({
    icon,
    title: t(`mkt.hiw.step${i}.title`),
    detail: t(`mkt.hiw.step${i}.detail`),
    // Step four has no aside, and an empty catalogue entry is how that is said. `t` answers the
    // KEY for a missing entry, so the empty string has to be present rather than absent —
    // otherwise the gold-bordered callout renders `mkt.hiw.step3.aside` to a reader.
    aside: t(`mkt.hiw.step${i}.aside`) || undefined,
  }))
}

/**
 * ANSWERED IN THE VISIBLE COPY BELOW, which is what lets these become an `FAQPage` node.
 * Adding a question here that the page does not answer is the mismatch that costs rich
 * results — see the note on `marketingPageGraph`.
 *
 * ── THE STRUCTURED DATA IS IN THE READER'S LANGUAGE, MATCHING THE PAGE ──────────────
 * `FAQPage` markup disagreeing with the visible copy is the mismatch above, and English JSON-LD
 * on a Spanish page is its most literal form: the document a crawler reads and the document a
 * person reads would not be the same document. So the graph is built from the same `t` the body
 * renders from, which is why this is a function rather than a const.
 */
const FAQ_COUNT = 5

function faq(t: T): readonly { question: string; answer: string }[] {
  return Array.from({ length: FAQ_COUNT }, (_, i) => ({
    question: t(`mkt.hiw.faq${i}.q`),
    answer: t(`mkt.hiw.faq${i}.a`),
  }))
}

export default async function HowItWorksPage() {
  const { t, locale } = await marketingI18n()
  const STEPS = steps(t)
  const FAQ = faq(t)

  return (
    <>
      <MetaViewContent content="howItWorks" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/how-it-works',
          name: t('mkt.hiw.graphName'),
          description: t('mkt.hiw.metaDescription'),
          faq: FAQ,
        })}
      />

      <PageHero
        eyebrow={t('mkt.hiw.eyebrow')}
        title={t('mkt.hiw.title')}
        lede={t('mkt.hiw.lede')}
      >
        <Link href={localizedHref(ACCOUNT_ROUTES.register, locale)}>
          <Button size="lg" className="w-full bg-brand-legacy px-8 text-base text-brand-on-legacy hover:opacity-90 sm:w-auto">
            {t('mkt.hiw.heroCta')}
          </Button>
        </Link>
      </PageHero>

      {/* ── The steps ─────────────────────────────────────────────────────
          A numbered vertical timeline with a connecting rule. The rule is drawn on the
          list rather than per item so it does not overshoot the last marker — a border
          on each row leaves a stub hanging below the final step. */}
      <section aria-labelledby="steps-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            id="steps-heading"
            eyebrow={t('mkt.hiw.stepsEyebrow')}
            title={t('mkt.hiw.stepsTitle')}
            lede={t('mkt.hiw.stepsLede')}
          />

          <ol className="mt-12 space-y-8">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 130}>
                <li className="relative flex gap-5">
                  {/* The connector, hidden on the last item. `after` rather than a
                      separate element so there is nothing to mis-position. */}
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute start-6 top-14 h-[calc(100%+1rem)] w-px bg-brand-primary/15"
                    />
                  )}
                  <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-card shadow-[var(--shadow-card)]">
                    <step.icon className="h-5 w-5 text-brand-accent" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t('mkt.hiw.stepN', { n: i + 1 })}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{step.detail}</p>
                    {step.aside && (
                      <p className="mt-2 rounded-lg border-s-2 border-brand-legacy bg-brand-soft/50 px-3 py-2 text-sm">
                        {step.aside}
                      </p>
                    )}
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={200}>
            <div className="mt-12 rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)]">
              <div className="mb-3 inline-flex rounded-xl bg-brand-affirm/15 p-2.5">
                <Rocket className="h-6 w-6 text-brand-affirm" aria-hidden="true" />
              </div>
              <h3 className="text-xl">{t('mkt.hiw.wholeSetup')}</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                {t('mkt.hiw.wholeSetupLede')}
              </p>
              <div className="mt-4 flex justify-center">
                <MoreLink href={localizedHref('/features', locale)}>
                  {t('mkt.hiw.seeEverything')}
                </MoreLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────
          Real `<details>` elements. A hand-rolled accordion would need state, keyboard
          handling and `aria-expanded` wiring to match what the browser gives for free —
          and the content stays in the DOM either way, so a crawler and a screen reader
          both read every answer whether it is open or not. */}
      <section aria-labelledby="faq-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            id="faq-heading"
            eyebrow={t('mkt.faqEyebrow')}
            title={t('mkt.hiw.faqTitle')}
          />
          <div className="mt-10 space-y-3">
            {FAQ.map((entry, i) => (
              <Reveal key={entry.question} delay={i * 90}>
                <details className="group rounded-xl border bg-card px-5 py-4 shadow-[var(--shadow-card)] [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold">
                    {entry.question}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-xl leading-none text-brand-accent transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{entry.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Testimonials heading={t('mkt.hiw.testimonials')} />

      <CtaBand
        title={t('mkt.hiw.ctaTitle')}
        lede={t('mkt.hiw.ctaLede')}
        primaryLabel={t('mkt.hiw.ctaPrimary')}
      />
    </>
  )
}
