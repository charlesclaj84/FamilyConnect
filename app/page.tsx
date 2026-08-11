import Image from 'next/image'
import Link from 'next/link'
import { User, Users, CalendarCheck, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureShowcase } from '@/components/marketing/FeatureShowcase'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  APP_NAME, APP_LEAD, APP_VALUES, APP_LOGO_ALT, APP_BANNER_ALT,
  BRAND_MARK_SRC, BRAND_LOCKUP_REVERSED_SRC,
} from '@/lib/brand'

/**
 * The three values, expanded.
 *
 * Keyed off APP_VALUES rather than restating the words, so the brand file stays
 * the single source: change a value there and this stops compiling until the
 * copy for it exists, instead of silently rendering two of the three.
 *
 * This replaced `provides.png`, a bitmap of the same three words. As markup it
 * reflows on a phone, recolours in dark mode, and can be read aloud — none of
 * which the image could do.
 */
const VALUE_DETAIL: Record<(typeof APP_VALUES)[number], {
  blurb: string
  icon: LucideIcon
  tone: string
}> = {
  Connect: {
    blurb: 'Every branch of the family in one private place — chat, directory, and the tree that ties them together.',
    icon: Users,
    tone: 'text-brand-accent',
  },
  Plan: {
    blurb: 'Reunions that practically run themselves, from the first save-the-date to day-of check-in.',
    icon: CalendarCheck,
    tone: 'text-brand-affirm',
  },
  Celebrate: {
    blurb: 'Photos, milestones and stories, kept for the generations who come after you.',
    icon: Sparkles,
    // Ink, not Legacy gold. Gold is 2.30 on this card and an icon that carries
    // meaning needs 3:1 — gold is a surface colour here, never a foreground.
    tone: 'text-brand-ink',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="border-b bg-brand-bar sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image src={BRAND_MARK_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="h-9 w-9 shrink-0" priority />
            {/* The wordmark is set, not placed: `.gn-wordmark` is the brand board's
                letterspaced Cormorant caps in CSS, so it stays crisp at any size and
                follows the theme. An <img> of the wordmark would do neither. */}
            <span className="gn-wordmark truncate text-xl text-brand-ink">{APP_NAME}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="outline" className="gap-1.5">
                <User className="h-4 w-4" />
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Banner — the gold lockup on Heritage. This is the one place the full
          artwork appears: mark, wordmark, acronym and the three values together. */}
      <div className="w-full flex justify-center bg-brand-hero px-4 py-10 sm:py-14">
        <Image
          src={BRAND_LOCKUP_REVERSED_SRC}
          alt={APP_BANNER_ALT}
          width={1700}
          height={520}
          className="w-full max-w-2xl h-auto"
          priority
        />
      </div>

      {/* Values strip */}
      <section aria-label={`What ${APP_NAME} is for`} className="border-b bg-card">
        <div className="max-w-6xl mx-auto grid gap-8 px-4 py-12 sm:px-6 sm:grid-cols-3 sm:gap-10">
          {APP_VALUES.map(value => {
            const { blurb, icon: Icon, tone } = VALUE_DETAIL[value]
            return (
              <div key={value} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                <Icon className={`h-6 w-6 ${tone}`} aria-hidden="true" />
                <h2 className="text-lg tracking-[0.14em] uppercase">{value}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{blurb}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-soft/50 to-background py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block mb-5 px-3 py-1 rounded-full bg-brand-soft text-brand-on-soft text-sm font-medium">
            Private &amp; Secure for Your Family
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            {APP_LEAD}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            The all-in-one portal to plan events, share memories, and keep your family close — no matter the distance.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                Join Your Family
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <FeatureShowcase />

      {/* CTA Banner */}
      <section className="py-16 px-4 bg-gradient-to-b from-brand-soft/50 to-background">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl mb-4">Ready to connect?</h2>
          <p className="mb-8 text-muted-foreground">
            Create your free account and bring your family together.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-base px-8">
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span className="gn-wordmark text-base text-brand-ink">{APP_NAME}</span>
            <span>{APP_LEAD}</span>
            <div className="flex gap-4">
              <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
            </div>
          </div>
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ClearPath Digital. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
