import { CalendarCheck, Images, Megaphone, Globe } from 'lucide-react'
import { Reveal } from '@/components/marketing/Reveal'
import { marketingI18n } from '@/lib/marketing/locale'
import { ComingSoonBadge } from '@/components/marketing/sections'
import { APP_NAME } from '@/lib/brand'

/**
 * The roadmap headline: a public-facing family website that assembles itself from what
 * the family is already doing inside the product.
 *
 * ── LABELLED "COMING SOON" EVERYWHERE, AND THAT IS NOT OPTIONAL ──────────────
 * Every entry point to this section carries `ComingSoonBadge`, the heading says it, and
 * the closing line says it again. A roadmap item presented as shipped is the one
 * marketing claim that reliably produces a refund request and a review saying the
 * product lied — and this codebase already draws that line in `lib/features.ts`, where a
 * route with `status: 'future'` renders `/coming-soon` instead of pretending. This is the
 * same rule applied to the marketing surface.
 *
 * It is still the strongest thing on the roadmap, so it gets a real section rather than a
 * line in a list: it is the only feature here that turns a private tool into something a
 * family can show people, and "your family already made the content" is the part
 * competitors cannot copy quickly.
 *
 * THE MOCK IS MARKUP, NOT A SCREENSHOT. There is nothing to screenshot yet, and a
 * mocked-up image of an unbuilt feature is the kind of asset that outlives the decision
 * to build it. Markup also reflows on a phone, recolours in dark mode and can be read
 * aloud — the same argument `app/page.tsx` makes for having replaced `provides.png`.
 */

/**
 * The three inputs, in the reader's language.
 *
 * Icons and colour tokens stay here; the two lines each card prints are keyed. The `label` was
 * also the React key and is not any more — an index is, because a translated label is a poor key
 * for the ordinary reason that it changes when the copy does.
 */
const SOURCE_SHAPES = [
  { icon: CalendarCheck, tone: 'text-brand-affirm', chip: 'bg-brand-affirm/15' },
  { icon: Images, tone: 'text-brand-accent', chip: 'bg-brand-accent/12' },
  // Ink, not Legacy: gold is 2.30 on this card and an icon carrying meaning needs 3:1.
  // Gold is the wash here and never the foreground.
  { icon: Megaphone, tone: 'text-brand-ink', chip: 'bg-brand-legacy/20' },
] as const

export async function LivingSitePreview() {
  const { t } = await marketingI18n()
  const SOURCES = SOURCE_SHAPES.map((shape, i) => ({
    ...shape,
    label: t(`mkt.living.src${i}.label`),
    detail: t(`mkt.living.src${i}.detail`),
  }))

  return (
    <section
      aria-labelledby="living-site-heading"
      className="relative overflow-hidden bg-brand-soft/40 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="gn-float absolute -end-24 top-1/3 h-72 w-72 rounded-full bg-brand-legacy/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <div className="flex items-center justify-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
                {t('mkt.living.eyebrow')}
              </p>
              <ComingSoonBadge label={t('mkt.comingSoon')} />
            </div>
            <h2 id="living-site-heading" className="mt-3 text-3xl sm:text-4xl">
              {t('mkt.living.title')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('mkt.living.lede')}
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* The three inputs */}
          <div className="space-y-4">
            {SOURCES.map((source, i) => (
              <Reveal key={i} delay={i * 160}>
                <div className="flex gap-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
                  <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${source.chip}`}>
                    <source.icon className={`h-5 w-5 ${source.tone}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground">{source.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {source.detail}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* The mock. A browser chrome frame around a stylised page — deliberately
              abstract: coloured blocks and rules rather than invented family names,
              because a mock full of plausible-looking fake content is the thing that
              gets screenshotted and quoted back as a promise. */}
          <Reveal delay={240}>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card-hover)]">
              <div className="flex items-center gap-2 border-b bg-brand-soft/60 px-4 py-3">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-brand-primary/30" />
                <span aria-hidden="true" className="size-2.5 rounded-full bg-brand-primary/20" />
                <span aria-hidden="true" className="size-2.5 rounded-full bg-brand-primary/10" />
                <span className="ms-2 inline-flex items-center gap-1.5 truncate rounded-md bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
                  <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
                  yourfamily.{APP_NAME.toLowerCase()}.com
                </span>
              </div>

              <div aria-hidden="true" className="space-y-4 p-5">
                {/* Hero band */}
                <div className="relative overflow-hidden rounded-xl bg-brand-hero p-5">
                  <div className="gn-shimmer absolute inset-0 opacity-40" />
                  <div className="relative space-y-2">
                    <div className="h-2 w-24 rounded-full bg-brand-legacy/70" />
                    <div className="h-4 w-48 rounded-full bg-brand-on-primary/80" />
                    <div className="h-2 w-32 rounded-full bg-brand-on-primary/40" />
                    <div className="mt-3 h-6 w-28 rounded-lg bg-brand-legacy/80" />
                  </div>
                </div>
                {/* Gallery strip */}
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(n => (
                    <div key={n} className="aspect-square rounded-lg bg-brand-accent/15" />
                  ))}
                </div>
                {/* News rows */}
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-muted" />
                  <div className="h-2 w-5/6 rounded-full bg-muted" />
                  <div className="h-2 w-2/3 rounded-full bg-muted" />
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {t('mkt.living.illustration')}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
