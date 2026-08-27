import type { Metadata } from 'next'
import Image from 'next/image'
import { ShieldCheck, EyeOff, Users, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { StructuredData } from '@/components/marketing/StructuredData'
import { PageHero, SectionHeading, MoreLink } from '@/components/marketing/sections'
import { CtaBand } from '@/components/marketing/CtaBand'
import { marketingPageGraph } from '@/lib/structured-data'
import { APP_PUBLISHER, BRAND_MARK_SRC, APP_LOGO_ALT } from '@/lib/brand'
import { localizedHref } from '@/lib/i18n/route-locale'
import { marketingAlternates, marketingI18n } from '@/lib/marketing/locale'
import { type T } from '@/lib/i18n/t'
import { MetaViewContent } from '@/components/meta/MetaViewContent'

/**
 * ── `generateMetadata`, AND THE ~155-CHARACTER BUDGET STILL BINDS PER LANGUAGE ───────
 * The comment this replaced recorded a draft that ran to 166 and was being cut at the point
 * where it said what the page is about. Spanish and French both run longer than English for the
 * same thought, so the catalogue entries are written to the budget rather than translated past
 * it — see the note beside them.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await marketingI18n()
  return {
    title: t('mkt.about.metaTitle'),
    description: t('mkt.about.metaDescription'),
    alternates: marketingAlternates('/about', locale),
  }
}

/**
 * ── WHAT IS AND IS NOT SOURCED ON THIS PAGE ─────────────────────────────────
 * The founder's letter below is the owner's own words, supplied 2026-08-12. It is the
 * human half this page was missing, and it carries the two facts nothing else here could:
 * six living generations and more than four hundred family members. Set verbatim — the only
 * instructed change was resolving two em-dash asides into ordinary sentences.
 *
 * STILL NOT SOURCED, so still absent: a founding year, a headcount, team photographs, and
 * any "trusted by N families" figure. Each is a checkable fact about real people that this
 * file has no source for, and an About page is the worst place to be caught inventing one —
 * it is the page a cautious customer reads precisely to decide whether to trust us with
 * their family's records.
 *
 * WORTH ASKING THE OWNER FOR: the letter is written in the first person ("that was the part
 * that stayed with me") and is unsigned. A name under it would strengthen it considerably.
 * Do not invent one.
 *
 * Everything else here is verifiable: the brand's stated mission and values
 * (`lib/brand.ts`), the publisher named in the footer and in the `Organization` structured
 * data, and product commitments that are enforced in code rather than asserted in copy.
 */

/**
 * The four commitments, in the reader's language. Icons and colour tokens stay.
 *
 * "Not a values statement. Each of these is something you can check." is the section's own lede,
 * and it is the constraint on the translation: each of the four names a mechanism, so the words
 * are the product's own in that language rather than a general sentiment.
 */
const PRINCIPLE_SHAPES: readonly { icon: LucideIcon; tone: string; chip: string }[] = [
  { icon: EyeOff, tone: 'text-brand-accent', chip: 'bg-brand-accent/12' },
  { icon: ShieldCheck, tone: 'text-brand-ink', chip: 'bg-brand-legacy/20' },
  { icon: Users, tone: 'text-brand-affirm', chip: 'bg-brand-affirm/15' },
  { icon: Sparkles, tone: 'text-brand-accent', chip: 'bg-brand-accent/12' },
]

function principles(t: T) {
  return PRINCIPLE_SHAPES.map((shape, i) => ({
    ...shape,
    title: t(`mkt.about.principle${i}.title`),
    detail: t(`mkt.about.principle${i}.detail`),
  }))
}

/**
 * The founder's letter, paragraph by paragraph.
 *
 * ── THE ENGLISH IS THE OWNER'S WORDS. THE OTHER TWO ARE A RENDERING OF THEM ─────────
 * This file's header says the letter was supplied on 2026-08-12 and set verbatim, and that still
 * describes the English exactly — `mkt.about.letter*` in `lib/marketing/strings/en.ts` is the
 * text as given, moved and not edited.
 *
 * The Spanish and French are NOT the owner's words and the catalogue says so where they live. A
 * translated first-person letter is a normal thing for a marketing site to have, and it is worth
 * being precise about what it is: somebody's account of their own family, rendered into another
 * language by somebody else. If the owner ever supplies their own Spanish, it replaces the
 * translation rather than being reconciled with it.
 *
 * ── WHICH PARAGRAPHS ARE EMPHASISED IS PART OF THE LETTER, NOT OF THE STYLING ───────
 * `strong` marks the six one-line beats — "We could not find it." "So we built it." The file's
 * old comment argues at length that these are PAUSES and must not be merged into their
 * neighbours; keeping the flag in the data rather than in the JSX is what carries that across
 * three languages, because a translator who joined two of them would otherwise silently lose the
 * emphasis as well as the beat.
 */
const LETTER_STRONG = new Set([1, 4, 7, 9, 10])
const LETTER_PARAGRAPHS = 12

function letter(t: T): readonly { text: string; strong: boolean }[] {
  return Array.from({ length: LETTER_PARAGRAPHS }, (_, i) => ({
    text: t(`mkt.about.letter${i}`),
    strong: LETTER_STRONG.has(i),
  }))
}

export default async function AboutPage() {
  const { t, locale } = await marketingI18n()
  const PRINCIPLES = principles(t)
  const LETTER = letter(t)

  return (
    <>
      <MetaViewContent content="about" />
      <StructuredData
        graph={marketingPageGraph({
          path: '/about',
          name: t('mkt.about.graphName'),
          description: t('mkt.about.metaDescription'),
        })}
      />

      {/* `APP_LEAD` and `APP_TAGLINE` were rendered here directly. Both are English prose in
          `lib/brand.ts` — the lead line and the acronym expansion — and both are keyed now for
          the reason `FeatureShowcase` records about `APP_PROMISE`: a brand constant is a
          finished English sentence, and a translator needs the finished sentence rather than a
          constant to interpolate. The product name is still never typed into a component. */}
      <PageHero
        eyebrow={t('mkt.about.eyebrow')}
        title={t('mkt.about.title')}
        lede={t('mkt.about.lede')}
      />

      {/* ── The mission ──────────────────────────────────────────────────── */}
      <section aria-labelledby="mission-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <Image
                src={BRAND_MARK_SRC}
                alt={APP_LOGO_ALT}
                width={72}
                height={72}
                className="h-16 w-16"
              />
              {/* The gold diamond on a hairline rule — the same divider the landing hero
                  uses, reused here so the pages read as one site. Decorative. */}
              <div aria-hidden="true" className="mt-6 flex w-full max-w-xs items-center gap-3">
                <span className="h-px flex-1 bg-brand-legacy/30" />
                <span className="size-1.5 rotate-45 bg-brand-legacy/80" />
                <span className="h-px flex-1 bg-brand-legacy/30" />
              </div>
              <h2 id="mission-heading" className="mt-6 text-3xl sm:text-4xl">
                {t('mkt.about.missionTitle')}
              </h2>

            </div>

            {/* ── THE FOUNDER'S LETTER, in the owner's own words ────────────────
                Supplied 2026-08-12 and set verbatim, with one instructed change: the two
                em-dash asides are resolved into ordinary sentences. "too much of that
                history—and too much of the work—was living in someone's memory" becomes a
                pair of commas, and "the reunion and the dues, yes—but also the names"
                becomes two sentences, which keeps the emphasis the dash was carrying
                instead of flattening it into a comma splice.

                LEFT-ALIGNED, unlike the heading above it. Centred text is fine for three
                lines and hostile at fourteen paragraphs: every line starts in a different
                place, so the eye has to hunt for the beginning of each one. The mark, the
                divider and the heading stay centred; the prose does not.

                THE SHORT PARAGRAPHS ARE THE BEATS and are deliberately not merged into
                their neighbours. "We could not find it." "So we built it." Each is a
                paragraph because each is a pause, and joining them into one tidy sentence
                would remove the reason they work. */}
            <div className="mt-8 space-y-5 text-left text-lg leading-relaxed text-muted-foreground">
              {LETTER.map((para, i) => (
                <p key={i} className={para.strong ? 'font-medium text-foreground' : undefined}>
                  {para.text}
                </p>
              ))}

              {/* The closing line was bold in the owner's draft, and it earns it: it is the
                  sentence the whole letter has been walking toward. Given its own rule and
                  the display serif so it lands as a conclusion rather than as one more
                  emphasised paragraph among five. It is outside the map for that reason —
                  it is a different KIND of thing, not a twelfth beat. */}
              <p className="border-t pt-5 font-heading text-2xl font-semibold text-brand-ink">
                {t('mkt.about.letterClose')}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Principles ───────────────────────────────────────────────────── */}
      <section aria-labelledby="principles-heading" className="bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            id="principles-heading"
            eyebrow={t('mkt.about.principlesEyebrow')}
            title={t('mkt.about.principlesTitle')}
            lede={t('mkt.about.principlesLede')}
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle, i) => (
              <Reveal key={i} delay={(i % 2) * 150} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className={`mb-4 inline-flex rounded-xl p-2.5 ${principle.chip}`}>
                    <principle.icon className={`h-6 w-6 ${principle.tone}`} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {principle.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who is behind it ─────────────────────────────────────────────────
          The letter above is the story; this is the legal entity behind it, and the only
          thing on the page that names a company. APP_PUBLISHER is the same constant the
          footer and the Organization structured data use, so the three cannot disagree
          about who publishes this. A founding year and a team would belong here — see the
          file header for why neither is invented in the meantime. */}
      <section aria-labelledby="publisher-heading" className="bg-background px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
              <h2 id="publisher-heading" className="text-2xl">
                {t('mkt.about.publisherTitle')}
              </h2>
              {/* `APP_PUBLISHER` stays a constant and is INTERPOLATED rather than keyed: it is
                  a legal entity's name, which is the one thing on this page that must read
                  identically in every language, and the footer and the `Organization` graph
                  read the same constant. The sentence around it is the copy. */}
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {t('mkt.about.publisherLede', { publisher: APP_PUBLISHER })}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-3">
                <MoreLink href={localizedHref('/features', locale)}>
                  {t('mkt.about.whatItDoes')}
                </MoreLink>
                <MoreLink href={localizedHref('/why-us', locale)}>
                  {t('mkt.about.whySwitch')}
                </MoreLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title={t('mkt.about.ctaTitle')}
        lede={t('mkt.about.ctaLede')}
      />
    </>
  )
}
