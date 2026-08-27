'use client'

import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/brand'
import {
  hasChosen, readBrowserConsent, subscribeToConsent, writeBrowserConsent,
} from '@/lib/consent'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * The one place a visitor decides whether GENORRA may measure them for advertising.
 *
 * ── IT EXISTS BECAUSE THE META INTEGRATION NEEDS IT, AND IT IS THE ONLY ONE ─────────
 * GENORRA had no consent mechanism before this. There must not now be two: every question
 * about whether marketing measurement may happen — the Pixel loading, a Conversions API
 * call from a server action, an `fbclid` being stored — resolves through
 * `lib/consent.ts`, and this is its only user-facing control. If a consent-management
 * platform is ever adopted, it replaces this file rather than sitting beside it.
 *
 * ── IT SHOWS ONLY WHEN THERE IS A DECISION TO MAKE ──────────────────────────────────
 * Rendered by the root layout only where a Pixel is actually configured for this
 * deployment, and then only until the visitor chooses. So a developer laptop, a preview
 * build and a deployment with no `META_PIXEL_ID` never show it — asking somebody to consent
 * to tracking that is not happening is both noise and a false statement.
 *
 * ── WHAT IT SAYS ────────────────────────────────────────────────────────────────────
 * It names Meta, and it says what the measurement is FOR, because "we use cookies" is a
 * sentence that tells nobody anything. It also states the boundary the whole integration is
 * built around — that family content is never included — since that is the reassurance a
 * person looking at a product holding their family tree actually wants, and it is a claim
 * this codebase can stand behind (see lib/meta/events.ts and lib/meta/identity.ts).
 *
 * ── BOTH CHOICES ARE REAL BUTTONS OF EQUAL WEIGHT ───────────────────────────────────
 * Decline is not a link in the corner, not greyed out and not smaller. A refusal that is
 * harder to make than an acceptance is a dark pattern, and it makes the recorded consent
 * worth less than no consent at all — anything built on it is built on a click somebody was
 * nudged into. `outline` beside `default` is the ordinary secondary-action treatment used
 * throughout the product.
 *
 * ── AND IT IS NOT A MODAL ───────────────────────────────────────────────────────────
 * No overlay, no focus trap, nothing blocking. The site works while it is on screen, which
 * matters because it renders on the marketing pages a visitor has just arrived at from an
 * advertisement — a full-screen interstitial there costs more conversions than the
 * measurement it is asking for could ever recover. It sits at the bottom, above the page,
 * and `role="region"` with a label puts it in the landmark list for a screen reader without
 * seizing focus from whatever the visitor is reading.
 */
export function ConsentBanner() {
  const t = useT()
  // The cookie lives outside React — same instrument and same reasoning as `ThemeToggle`
  // and `MetaPixel`.
  //
  // THE SERVER SNAPSHOT IS `true` — "already chosen" — so the banner is absent from the
  // static HTML and appears one render later, once the browser's own cookie has been read.
  // That is the right way round of two imperfect options: the server cannot read the cookie
  // without making every route in the product dynamic (see `MetaPixel`), so the choice is
  // between a returning visitor briefly seeing a banner they already answered, and a new
  // visitor seeing it a few milliseconds late. The first is a bug; the second is nothing.
  const chosen = useSyncExternalStore(
    subscribeToConsent,
    () => hasChosen(readBrowserConsent()),
    () => true,
  )

  if (chosen) return null

  return (
    <div
      role="region"
      aria-label={t('consent.label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {APP_NAME} can measure which advertisements bring families here, using Meta&apos;s
          advertising tools.{' '}
          <span className="text-foreground">{t('ui.familySRecordsNever')}</span>{' '}
          Only your own account details are used, and only to match this visit to an
          advertisement.
        </p>
        <div className="flex shrink-0 gap-2">
          {/* Declining is listed first on a narrow screen for the same reason it is an
              equal-weight button: the easier choice must not be the one that suits us. */}
          <Button variant="outline" size="lg" onClick={() => writeBrowserConsent('denied')}>
            {t('consent.decline')}
          </Button>
          <Button size="lg" onClick={() => writeBrowserConsent('granted')}>
            {t('consent.allow')}
          </Button>
        </div>
      </div>
    </div>
  )
}
