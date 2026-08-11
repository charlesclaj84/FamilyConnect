// No 'use client'. Extracting Reveal took the last hook out of this file, and
// what remains is data and markup — so the whole showcase (three spotlights,
// eight feature cards, all their copy) renders on the server and ships no JS.
// Only `Reveal` itself crosses to the client. Adding a hook or a handler here
// would need the directive back; prefer putting it in a small client child.
import type { ReactNode } from 'react'
import Image, { type StaticImageData } from 'next/image'
import {
  Calendar, Wallet, GitBranch, Vote, Megaphone, MessageCircle, Camera,
  FileText, ShieldCheck, BarChart3, Store, Check, ImageIcon, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureFuture } from '@/lib/features'
import { APP_NAME } from '@/lib/brand'
import { Reveal } from '@/components/marketing/Reveal'

// Screenshots are STATICALLY IMPORTED, not referenced by a `/public` URL string,
// and the difference is the bug this replaced: the spotlights carried
// `image: '/features/events.png'` as a plain string, nothing under `public/`
// answered that path, and nothing anywhere said so — a string src that resolves
// to nothing renders an empty box in silence. A static import of a file that is
// not there fails `next build`.
//
// It also means the intrinsic width and height (and the blur placeholder) come
// from the file rather than being restated here, so swapping in a screenshot of
// a different shape needs no code change. These are 1200x1080; the frame follows
// the image, which is why there is no aspect ratio on it.
//
// They live here rather than in `public/` deliberately. `public/` is the three
// identity folders and nothing else (AGENTS.md, "Artwork paths"), and a static
// import does not need to be there — colocating them with the only component
// that renders them keeps both rules intact.
import eventsShot from './screenshots/events.png'
import financesShot from './screenshots/finances.png'
import familyTreeShot from './screenshots/family-tree.png'

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

// ── Brand tones ──────────────────────────────────────────────────────────────

/**
 * The palette a feature card may draw on.
 *
 * This replaced eleven ad-hoc Tailwind ramps — emerald/teal/cyan, violet/fuchsia,
 * sky, rose, stone — which read as a generic SaaS rainbow next to a burgundy and
 * gold identity. Every tone here is a brand token.
 *
 * Each is a WASH plus a matching foreground, rather than white on a saturated
 * fill, because two of the four brand hues cannot carry white text: Legacy gold
 * is 2.30 against white and Growth olive is 4.22, both short of AA. A tinted chip
 * with the accessible token as the icon colour is legible in both themes and
 * looks more considered than a filled square anyway.
 */
const TONES = {
  heritage: 'bg-brand-primary/12 text-brand-ink',
  warmth: 'bg-brand-accent/12 text-brand-accent',
  growth: 'bg-brand-affirm/15 text-brand-affirm',
  // Gold never carries its own text on a pale ground, so this one is a gold wash
  // under ink rather than gold-on-gold.
  legacy: 'bg-brand-legacy/20 text-brand-ink',
} as const

type Tone = keyof typeof TONES

/**
 * Placeholder grounds, which DO carry white text.
 *
 * Deliberately restricted to Heritage and the deeper hero burgundy: those are the
 * only two roles that stay dark in both themes, so white stays readable after the
 * theme flips. `--brand-accent` becomes Legacy gold in dark mode and would strand
 * white text on it — which is exactly the kind of bug a "just use the brand
 * colours" sweep introduces if nobody checks the dark side.
 */
const PLACEHOLDER_GROUNDS = [
  'bg-gradient-to-br from-brand-hero via-brand-primary to-brand-hero',
  'bg-gradient-to-tr from-brand-primary via-brand-hero to-brand-primary',
  'bg-gradient-to-r from-brand-hero via-brand-primary to-brand-hero',
] as const

// ── The spotlight visual ─────────────────────────────────────────────────────

/**
 * A screenshot if the row has one, the animated brand ground if it does not.
 *
 * The placeholder is not dead code kept for sentiment: a spotlight added ahead
 * of its screenshot should say so on the page rather than leave a hole, and
 * `image` is optional for exactly that. It is also what `gn-shimmer` and the two
 * `gn-float` keyframes in globals.css exist for.
 */
function SpotlightVisual({
  image, alt, accent,
}: { image?: StaticImageData; alt: string; accent: string }) {
  if (image) {
    return (
      <div className="overflow-hidden rounded-3xl border shadow-sm">
        {/*
          `h-auto w-full` with the intrinsic size from the import: the box takes
          the image's own ratio, so nothing is cropped and nothing is letterboxed.
          `sizes` matters here — the column is half of a 6xl grid on large screens
          (~34rem) and the full width below it, and without saying so Next serves
          the whole-viewport candidate to every phone.
        */}
        <Image
          src={image}
          alt={alt}
          placeholder="blur"
          sizes="(min-width: 1024px) 34rem, 100vw"
          className="h-auto w-full"
        />
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border shadow-sm">
      <div className={cn('absolute inset-0 opacity-95', accent)} />
      <div className="gn-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {/* floating decorative shapes */}
      <div className="gn-float absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/20 blur-xl" />
      <div className="gn-float-slow absolute bottom-4 left-6 h-20 w-20 rounded-2xl bg-white/15 blur-lg" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white">
        <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
          <ImageIcon className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold">Screenshot coming soon</p>
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
  accent: string      // placeholder ground — one of PLACEHOLDER_GROUNDS
  badge: Tone         // icon chip tone
  image?: StaticImageData   // omit and the row renders the placeholder instead
  imageAlt: string    // what the screenshot SHOWS — the title is already on the page
  feature: string     // route this row is selling — drives its shipped/coming-soon state
}

const spotlights: Spotlight[] = [
  {
    eyebrow: 'Plan it all',
    title: 'Family Reunions and events that practically run themselves',
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
    accent: PLACEHOLDER_GROUNDS[0],
    badge: 'warmth',
    image: eventsShot,
    imageAlt: 'The events screen: a multi-day reunion itinerary with its sub-events, RSVP counts and day-of check-in.',
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
    accent: PLACEHOLDER_GROUNDS[1],
    badge: 'legacy',
    image: financesShot,
    imageAlt: 'The finances screen: fund balances, dues collected against outstanding, and the routing waterfall that fills each fund in priority order.',
    feature: '/family-finances',
  },
  {
    eyebrow: 'Know your family',
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
    accent: PLACEHOLDER_GROUNDS[2],
    badge: 'growth',
    image: familyTreeShot,
    imageAlt: 'The family tree screen: several generations laid out as connected cards, with spouses and children branching from each couple.',
    feature: '/family-tree',
  },
]

interface MiniFeature {
  title: string
  blurb: string
  icon: ReactNode
  accent: Tone
  feature?: string     // route backing this card, when it has one
  comingSoon?: boolean // for cards with no route yet
}

const miniFeatures: MiniFeature[] = [
  {
    title: 'Elections',
    blurb: 'Run real officer elections — nominate yourself or others, accept or decline, then vote family-wide. Positions pull straight from your board roster, results tally live, and a launch announcement goes out automatically.',
    icon: <Vote className="h-5 w-5" />,
    accent: 'heritage',
    feature: '/elections',
  },
  {
    title: 'Announcements',
    blurb: 'Now anyone in the family can share news. Admins can pin the important stuff to the top so it surfaces right on everyone’s dashboard.',
    icon: <Megaphone className="h-5 w-5" />,
    accent: 'legacy',
    feature: '/announcements',
  },
  {
    title: 'Family Chat',
    blurb: 'Real-time group threads and private direct messages keep the whole family talking between gatherings.',
    icon: <MessageCircle className="h-5 w-5" />,
    accent: 'warmth',
    feature: '/chat',
  },
  {
    title: 'Photo Collections',
    blurb: 'Spin up a gallery for every event, upload your favorite memories, add captions, and relive the moments together.',
    icon: <Camera className="h-5 w-5" />,
    accent: 'growth',
    feature: '/photos',
  },
  {
    title: 'Documents',
    blurb: 'Keep bylaws, forms, meeting minutes, and family records in one shared, always-available place.',
    icon: <FileText className="h-5 w-5" />,
    accent: 'heritage',
    feature: '/documents',
  },
  {
    title: 'Regions & Chapters',
    blurb: 'Organize a large family into regional chapters with scoped leadership and board positions for every level.',
    icon: <ShieldCheck className="h-5 w-5" />,
    accent: 'growth',
    feature: '/admin/chapters',
  },
  {
    title: 'Leadership Reports',
    blurb: 'Membership, dues collected vs. outstanding, RSVP turnout, and t-shirt counts — the numbers leadership needs at a glance.',
    icon: <BarChart3 className="h-5 w-5" />,
    accent: 'warmth',
    feature: '/admin/reports',
  },
  {
    title: 'Trusted Vendors',
    blurb: 'Family-owned and family-trusted businesses offering members-only products and services.',
    icon: <Store className="h-5 w-5" />,
    accent: 'legacy',
    comingSoon: true,
  },
]

// ── Section ──────────────────────────────────────────────────────────────────

export function FeatureShowcase() {
  // A flat ground, deliberately. This was a three-stop gradient between two
  // values a tenth of a step apart, which cost a paint and read as nothing.
  // Contrast on this page now comes from the dark bands above and below it.
  return (
    <section className="bg-muted/50 px-4 py-16 sm:py-24">
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
            one beautiful, private home for your family, your plans, and your money.
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
                      <div className={cn('inline-flex p-2.5 rounded-xl', TONES[s.badge])}>
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
                    <SpotlightVisual image={s.image} alt={s.imageAlt} accent={s.accent} />
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
              {/* A resting shadow, not just a hover one. White on cream is
                  1.069:1, so without it these cards had no edge at all until
                  you pointed at them. */}
              <div className="group relative h-full rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-primary/40 hover:shadow-[var(--shadow-card-hover)]">
                {isComingSoon(f) && <ComingSoonPill className="absolute top-3 right-3" />}
                <div className={cn(
                  'mb-3 inline-flex p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6',
                  TONES[f.accent],
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
