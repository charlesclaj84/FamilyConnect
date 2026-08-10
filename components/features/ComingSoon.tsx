import Link from 'next/link'
import { Hourglass, ArrowRight, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { LIVE_FEATURES } from '@/lib/features'

/**
 * Full-page state served in place of a gated feature by the roadmap gate in
 * proxy.ts. Signed-in members are never *shown* an unshipped feature — the
 * sidebar and dashboard omit them entirely — so this is only reached by
 * navigating straight to a gated URL (an old bookmark, a stale notification
 * link). It names the feature and points at what already works, rather than
 * dead-ending on a 404.
 */
export function ComingSoonScreen({ label, blurb }: { label: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Hourglass className="h-7 w-7" />
      </div>

      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Coming Soon
      </div>

      <h1 className="mb-2 text-xl font-semibold sm:text-2xl">{label}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{blurb}</p>

      <div className="mb-8 rounded-2xl border bg-card px-4 py-5 text-left">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Available now
        </p>
        <ul className="flex flex-col gap-1">
          {LIVE_FEATURES.map(feature => (
            <li key={feature.href}>
              <Link
                href={feature.href}
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-brand-tint hover:text-brand-navy"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                {feature.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/dashboard" className={buttonVariants() + ' justify-center'}>
        Back to dashboard
      </Link>
    </div>
  )
}
