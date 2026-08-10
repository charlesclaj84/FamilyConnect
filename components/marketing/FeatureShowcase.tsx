'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Calendar, Wallet, GitBranch, Vote, Megaphone, MessageCircle, Camera,
  FileText, ShieldCheck, BarChart3, Store, Check, ImageIcon, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureFuture, LIVE_FEATURES } from '@/lib/features'
import { APP_NAME } from '@/lib/brand'

// Whether to mark an entry "Coming Soon". Anything tied to a route reads its
// status from lib/features.ts so the landing page can't drift from the app;
// `comingSoon` covers entries that have no route yet at all.
function isComingSoon(entry: { feature?: string; comingSoon?: boolean }) {
  return entry.comingSoon === true || (entry.feature ? isFeatureFuture(entry.feature) : false)
}

function ComingSoonPill({ className }: { className?: string }) {
  return (
    <span className={cn(
      'text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded-full',
      className,
    )}>
      Coming Soon
    </span>
  )
}

// ── Scroll-reveal helper ─────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect() } },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ── Image placeholder (drop a real image at `src` in /public) ────────────────

function ImagePlaceholder({ src, accent }: { src: string; accent: string }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border shadow-sm">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-90', accent)} />
      <div className="gn-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {/* floating decorative shapes */}
      <div className="gn-float absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/20 blur-xl" />
      <div className="gn-float-slow absolute bottom-4 left-6 h-20 w-20 rounded-2xl bg-white/15 blur-lg" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
        <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
          <ImageIcon className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold">Add a screenshot here</p>
        <code className="rounded-md bg-black/25 px-2 py-0.5 text-[11px] font-mono">{src}</code>
      </div>
    </div>
  )
}

// ── Content ──────────────────────────────────────────────────────────────────

interface Spotlight {
  eyebrow: string
  title: string
  blurb: string
  bullets: string[]
  icon: ReactNode
  accent: string      // gradient for the placeholder + icon
  badge: string       // icon chip gradient
  image: string
  feature: string     // route this row is selling — drives its shipped/coming-soon state
}

const spotlights: Spotlight[] = [
  {
    eyebrow: 'Plan it all',
    title: 'Reunions that practically run themselves',
    blurb: 'From the first save-the-date to the day-of check-in, every detail of your family gathering lives in one place — and everyone stays on the same page.',
    bullets: [
      'Multi-day itineraries with nested sub-events',
      'Hotel room blocks with price estimates & booking deadlines',
      'RSVP for your whole household in one tap',
      'Reusable event templates that auto-assign the to-do list',
      'Day-of check-in to see who has arrived',
      'Per-event budgets with line items vs. actual spend',
    ],
    icon: <Calendar className="h-5 w-5" />,
    accent: 'from-emerald-500 via-teal-500 to-cyan-600',
    badge: 'from-emerald-500 to-teal-600',
    image: '/features/events.png',
    feature: '/events',
  },
  {
    eyebrow: 'Money, handled',
    title: 'Dues, funds, and a real profit & loss',
    blurb: 'A complete treasury for your family organization — collect dues your members can actually afford, route every dollar automatically, and see exactly where the money lives.',
    bullets: [
      'Set dues at any cadence — and let each member choose how they pay',
      'Auto-route payments into funds by priority with minimum-balance waterfalls',
      'Family Reunion gets funded first, College Fund follows — automatically',
      'Track manual contributions and milestone disbursements',
      'Watch fund balances update the moment dues come in',
      'A clean P&L ledger: collected → routed → spent → net',
    ],
    icon: <Wallet className="h-5 w-5" />,
    accent: 'from-amber-500 via-orange-500 to-rose-500',
    badge: 'from-amber-500 to-orange-600',
    image: '/features/finances.png',
    feature: '/family-finances',
  },
  {
    eyebrow: 'Know your people',
    title: 'Every branch of the family, mapped',
    blurb: 'Build the living record of your family — who is related to whom, how to reach them, and the legacy that connects every generation.',
    bullets: [
      'Multi-generation tree: parents, grandparents, children & spouses',
      'Handles step-relationships and ex-partners gracefully',
      'Manage your kids — and convert them to adults when they grow up',
      'Rich profiles: contact info, addresses, birthdays, t-shirt sizes',
      'Board positions and active status at a glance',
      'Search and filter the full member directory instantly',
    ],
    icon: <GitBranch className="h-5 w-5" />,
    accent: 'from-violet-500 via-purple-500 to-fuchsia-600',
    badge: 'from-violet-500 to-purple-600',
    image: '/features/family-tree.png',
    feature: '/family-tree',
  },
]

interface MiniFeature {
  title: string
  blurb: string
  icon: ReactNode
  accent: string
  feature?: string     // route backing this card, when it has one
  comingSoon?: boolean // for cards with no route yet
}

const miniFeatures: MiniFeature[] = [
  {
    title: 'Elections',
    blurb: 'Run real officer elections — nominate yourself or others, accept or decline, then vote family-wide. Positions pull straight from your board roster, results tally live, and a launch announcement goes out automatically.',
    icon: <Vote className="h-5 w-5" />,
    accent: 'from-indigo-500 to-blue-600',
    feature: '/elections',
  },
  {
    title: 'Announcements',
    blurb: 'Now anyone in the family can share news. Admins can pin the important stuff to the top so it surfaces right on everyone’s dashboard.',
    icon: <Megaphone className="h-5 w-5" />,
    accent: 'from-amber-500 to-yellow-600',
    feature: '/announcements',
  },
  {
    title: 'Family Chat',
    blurb: 'Real-time group threads and private direct messages keep the whole family talking between gatherings.',
    icon: <MessageCircle className="h-5 w-5" />,
    accent: 'from-sky-500 to-cyan-600',
    feature: '/chat',
  },
  {
    title: 'Photo Collections',
    blurb: 'Spin up a gallery for every event, upload your favorite memories, add captions, and relive the moments together.',
    icon: <Camera className="h-5 w-5" />,
    accent: 'from-pink-500 to-rose-600',
    feature: '/photos',
  },
  {
    title: 'Documents',
    blurb: 'Keep bylaws, forms, meeting minutes, and family records in one shared, always-available place.',
    icon: <FileText className="h-5 w-5" />,
    accent: 'from-slate-500 to-gray-700',
    feature: '/documents',
  },
  {
    title: 'Regions & Chapters',
    blurb: 'Organize a large family into regional chapters with scoped leadership and board positions for every level.',
    icon: <ShieldCheck className="h-5 w-5" />,
    accent: 'from-teal-500 to-emerald-600',
    feature: '/admin/chapters',
  },
  {
    title: 'Leadership Reports',
    blurb: 'Membership, dues collected vs. outstanding, RSVP turnout, and t-shirt counts — the numbers leadership needs at a glance.',
    icon: <BarChart3 className="h-5 w-5" />,
    accent: 'from-rose-500 to-red-600',
    feature: '/admin/reports',
  },
  {
    title: 'Trusted Vendors',
    blurb: 'Family-owned and family-trusted businesses offering members-only products and services.',
    icon: <Store className="h-5 w-5" />,
    accent: 'from-stone-500 to-stone-700',
    comingSoon: true,
  },
]

// ── Section ──────────────────────────────────────────────────────────────────

export function FeatureShowcase() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-muted/40 via-background to-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Reveal className="text-center mb-14 sm:mb-20">
          <div className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" /> One portal for your whole family
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
            Everything it takes to run a family
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {APP_NAME} replaces the group texts, spreadsheets, and shoeboxes of receipts with
            one beautiful, private home for your people, your plans, and your money.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-4">
            <span className="font-medium text-foreground">Live today:</span>{' '}
            {LIVE_FEATURES.map(f => f.label).join(' · ')}. Everything marked
            {' '}<ComingSoonPill className="align-middle" />{' '}is on the way.
          </p>
        </Reveal>

        {/* Spotlight rows */}
        <div className="space-y-20 sm:space-y-28 mb-24">
          {spotlights.map((s, i) => {
            const reversed = i % 2 === 1
            return (
              <Reveal key={s.title}>
                <div className="grid gap-8 lg:gap-14 lg:grid-cols-2 items-center">
                  {/* Copy */}
                  <div className={cn('space-y-5', reversed ? 'lg:order-2' : 'lg:order-1')}>
                    <div className="flex items-center gap-3">
                      <div className={cn('inline-flex p-2.5 rounded-xl text-white shadow-md bg-gradient-to-br', s.badge)}>
                        {s.icon}
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-primary">{s.eyebrow}</span>
                      {isComingSoon(s) && <ComingSoonPill />}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold leading-tight">{s.title}</h3>
                    <p className="text-muted-foreground text-base sm:text-lg">{s.blurb}</p>
                    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 pt-1">
                      {s.bullets.map(b => (
                        <li key={b} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Check className="h-3 w-3" />
                          </span>
                          <span className="text-muted-foreground">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Visual */}
                  <div className={cn(reversed ? 'lg:order-1' : 'lg:order-2')}>
                    <ImagePlaceholder src={s.image} accent={s.accent} />
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* "And so much more" grid */}
        <Reveal className="text-center mb-10">
          <h3 className="text-2xl sm:text-3xl font-bold">…and so much more</h3>
          <p className="text-muted-foreground mt-2">Every tool a thriving family organization needs.</p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {miniFeatures.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 80}>
              <div className="group relative h-full rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-primary/40">
                {isComingSoon(f) && <ComingSoonPill className="absolute top-3 right-3" />}
                <div className={cn(
                  'mb-3 inline-flex p-2.5 rounded-xl text-white shadow-sm bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6',
                  f.accent,
                )}>
                  {f.icon}
                </div>
                <h4 className="text-base font-semibold mb-1">{f.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.blurb}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
