import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { requireViewOrPending } from '@/lib/auth/permissions'
import { resolveHelpAvailability } from '@/lib/help/availability'
import { HELP_PARTS } from '@/lib/help/content'
import { localizePart } from '@/lib/help/keys'
import { helpT } from '@/lib/help/strings'
import { HelpAvailabilityBadge } from '@/components/help/HelpAvailabilityBadge'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./help.title')
}

/**
 * The contents page of the how-to manual.
 *
 * ── IT IS DELIBERATELY NOT A PERMISSION RESOURCE ────────────────────────────────────
 * AGENTS.md §6 says a new page needs a row in `permission_resources` so a family can
 * restrict it, and warns that a page without one can never be turned off. This is the
 * exception it also names — the same class as the Dashboard and the Personal pages, whose
 * rows 20260806000006 deliberately deleted.
 *
 * The reason is what the page holds: nothing. It reads no family data, names no member and
 * shows no figure. There is no `family_code` on this screen to isolate and no row for RLS
 * to protect — it is documentation of the product, identical for every reader. A family
 * being able to switch off its own instructions is a footgun with no upside, and it would
 * make the one screen that explains permissions the screen a misconfigured permission can
 * hide. So there is no migration for `/help`, and its absence is a decision rather than an
 * oversight.
 *
 * ── WHY `requireViewOrPending` ──────────────────────────────────────────────────────
 * §1's preamble is still owed and still here — this is not the `/coming-soon` exemption —
 * but the guard is the one that admits somebody awaiting approval, and `'help'` is in
 * `PENDING_RESOURCES` beside the three pages that already were. "I have asked to join, what
 * happens now?" is a help question, asked by somebody who cannot reach any other screen to
 * find the answer.
 *
 * Unlike the dashboard, this page does NOT early-return on `gate.pending`: there is nothing
 * below to withhold. What it does instead is stop labelling chapters, because a pending
 * caller resolves to the three pending pages and every other chapter would come back "not
 * in your access" — true this minute, and quite the wrong thing to tell somebody whose
 * access is one decision away.
 */
export default async function HelpIndexPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')
  const { t } = await callerI18n(user.id)

  const gate = await requireViewOrPending(user.id, 'help')

  const { locale } = await callerI18n(user.id)

  const help = helpT(locale)

  const availability = gate.pending ? null : await resolveHelpAvailability(user.id)

  return (
    <PageShell className="space-y-10">
      {/* A cap on a RUN OF PROSE inside a `wide` page, not a page container — no
          `mx-auto`, so it starts exactly where the card grid below it does. Same shape as
          FamilySettingsClient capping its name box: a constraint on one element belongs on
          that element, and the page keeps the measure its neighbours have. */}
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold">{t('page./help.title')}</h1>
      </div>

      {gate.pending && (
        <div className="max-w-3xl rounded-xl border bg-muted/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t('hlp.membershipUndecided', {
              family: gate.membership.familyName,
            })}{' '}
            <Link href="/help/joining-a-family">{t('hlp.creatingJoiningFamily')}</Link>{' '}
            {t('hlp.chapterExplainsNext')}
          </p>
        </div>
      )}

      {/* LOCALIZED ONCE, HERE. `localizePart` returns the same shape, so everything below
          renders unchanged and a key with no translation falls back to the English —
          which is what lets a partly translated manual read as prose rather than as key
          names. See lib/help/keys.ts. */}
      {HELP_PARTS.map(part => localizePart(part, help)).map(part => (
        <section key={part.id} aria-labelledby={`part-${part.id}`} className="space-y-4">
          <div>
            <h2 id={`part-${part.id}`} className="text-2xl">{part.title}</h2>
            <p className="text-sm text-muted-foreground">{part.blurb}</p>
          </div>

          {/* Cards rather than a list, and two columns rather than one: this is a contents
              page, which is horizontal content by the test in PageShell — you scan it for
              the chapter you want rather than reading it start to finish. The chapters
              themselves are the `reading` measure. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {part.chapters.map(chapter => (
              <Link
                key={chapter.slug}
                href={`/help/${chapter.slug}`}
                className="group flex flex-col gap-1 rounded-xl border bg-card p-4 transition-shadow hover:shadow-[var(--shadow-card)]"
              >
                <span className="flex items-start justify-between gap-3">
                  {/* An explicit colour on BOTH the title and the summary. `globals.css`
                      carries an unscoped `a { color: var(--brand-accent) }`, so a card
                      wrapped in a Link comes out entirely terracotta — and gold in dark
                      mode. This is the trap AGENTS.md documents at every rail; a card is
                      the same shape of problem. */}
                  <span className="font-semibold text-foreground group-hover:text-brand-ink">
                    {chapter.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <HelpAvailabilityBadge availability={availability?.get(chapter.slug)} t={t} />
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:-scale-x-100"
                      aria-hidden="true"
                    />
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{chapter.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </PageShell>
  )
}
