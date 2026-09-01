import Link from 'next/link'
import { Hourglass, ArrowRight, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { T } from '@/lib/i18n/t'

/**
 * Full-page state served in place of a gated feature by the roadmap gate in
 * proxy.ts. Signed-in members are never *shown* an unshipped feature — the
 * sidebar and dashboard omit them entirely — so this is only reached by
 * navigating straight to a gated URL (an old bookmark, a stale notification
 * link). It names the feature and points at what already works, rather than
 * dead-ending on a 404.
 *
 * ── THE "AVAILABLE NOW" LIST IS RESOLVED FOR THE CALLER, since 2026-08-22 ──────────
 * It rendered `LIVE_FEATURES` unfiltered until then — every live route in the product, to
 * everybody. As the registry grew that became a list of forty-one destinations including
 * every administrator screen and every paid one, so an ordinary member of a Free family
 * reaching a gated URL was handed a menu of about twenty pages that answer 404 or redirect
 * them to `/upgrade`. It was logged as "three administrator links" when there were three:
 * the defect grew with the product, which is exactly what a hand-unfiltered list does.
 *
 * THE LIST ARRIVES AS A PROP AND IS NOT READ HERE (§5). The page resolves it with
 * `viewableResources()` — the same call the sidebar builds the rail from, so this screen and
 * the rail cannot disagree about where a member may go — and passes only what survives. A
 * list that is fetched and then filtered in the component has already been serialized into
 * the RSC payload; this one is never assembled.
 */
export function ComingSoonScreen({ label, blurb, available, t }: {
  /**
   * The reader's language, bound. A PROP rather than `useT()`, because this is a Server
   * Component — a hook here passes `tsc`, passes `eslint`, compiles, and fails on the
   * first render. See lib/i18n/server.ts.
   */
  t: T
  label: string
  blurb: string
  /**
   * Where this caller may actually go, resolved on the page. Empty is a real answer — a
   * pending applicant has almost nothing — and the block is dropped rather than rendered
   * with an empty list under a heading promising otherwise.
   */
  available: readonly { href: string; label: string }[]
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Hourglass className="h-7 w-7" />
      </div>

      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" /> {t('soon.heading')}
      </div>

      <h1 className="mb-2 text-xl font-semibold sm:text-2xl">{label}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{blurb}</p>

      {/* DROPPED ENTIRELY WHEN THERE IS NOWHERE TO SEND THEM. A heading reading "Available
          now" over an empty list is worse than no heading — it reads as a failure to load
          rather than as an honest answer about a caller who has just joined. */}
      {available.length > 0 && (
        <div className="mb-8 rounded-2xl border bg-card px-4 py-5 text-start">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('soon.availableNow')}
          </p>
          <ul className="flex flex-col gap-1">
            {available.map(feature => (
              <li key={feature.href}>
                <Link
                  href={feature.href}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-brand-soft hover:text-brand-on-soft"
                >
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:-scale-x-100" />
                  {feature.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/dashboard" className={buttonVariants() + ' justify-center'}>
        {t('soon.back')}
      </Link>
    </div>
  )
}
