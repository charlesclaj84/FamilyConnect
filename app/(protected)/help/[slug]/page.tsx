import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireViewOrPending } from '@/lib/auth/permissions'
import { resolveHelpAvailability } from '@/lib/help/availability'
import { getHelpChapter, getHelpPart, helpNeighbours } from '@/lib/help/content'
import { localizeChapter } from '@/lib/help/keys'
import { helpT } from '@/lib/help/strings'
import { stripInline } from '@/lib/help/inline'
import { HelpBlocks } from '@/components/help/HelpProse'
import { HelpAvailabilityNote } from '@/components/help/HelpAvailabilityBadge'
import { PageShell } from '@/components/layout/PageShell'
import { currentUser } from '@/lib/auth/current-user'
import { callerI18n } from '@/lib/i18n/server'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * One chapter of the manual.
 *
 * ── THE PERMISSION KEY IS `help`, NOT `help/<slug>` ─────────────────────────────────
 * AGENTS.md §1 derives the resource key from the route, and that rule is about a page being
 * a permissioned SURFACE. A chapter is not one — it is a section of a single document, the
 * way `?section=` is on Accounting — so all of them gate on the one key their contents page
 * does. Deriving a key per slug would invent twenty resources nobody registered, and every
 * one of them would answer "viewable" by default anyway.
 *
 * The tier check inside `requireViewOrPending` resolves correctly either way:
 * `getFeature()` longest-prefix-matches, so `/help/anything` finds the `/help` entry.
 *
 * ── `reading`, AND THIS IS THE CASE THAT MEASURE EXISTS FOR ─────────────────────────
 * One column of prose read start to finish. Not a card grid, not a table, not a form — see
 * the note in PageShell about what the test actually is, and note that the contents page
 * next door is `wide` for exactly the same reason it is a grid of cards.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const raw = getHelpChapter((await params).slug)
  if (!raw) return { title: 'Help' }
  // THE TAB TITLE AND THE DESCRIPTION ARE THE READER'S. This is the one `generateMetadata` in
  // the product that translates, and it costs nothing extra: `callerI18n(null)` falls through to
  // `Accept-Language` and needs no session, which is right here because the manual is the same
  // document for everybody — there is no per-caller data in it to get wrong.
  const { locale } = await callerI18n(null)
  const chapter = localizeChapter(raw, helpT(locale))
  // No product-name suffix by hand — `app/layout.tsx` sets a `title.template` and appends
  // it. Writing it here renders it twice.
  return { title: `${chapter.title} — Help`, description: stripInline(chapter.summary) }
}

export default async function HelpChapterPage({ params }: Props) {
  const { slug } = await params

  // BEFORE the session is resolved, deliberately: a slug that names no chapter is a 404
  // whoever asks, and there is nothing to authorize on a document that does not exist.
  const raw = getHelpChapter(slug)
  if (!raw) notFound()

  const { user } = await currentUser()
  const { t } = await callerI18n(user?.id ?? null)
  if (!user) redirect('/login')

  const gate = await requireViewOrPending(user.id, 'help')

  const { locale } = await callerI18n(user.id)
  const help = helpT(locale)
  const chapter = localizeChapter(raw, help)

  const part = getHelpPart(slug)
  const { previous, next } = helpNeighbours(slug)
  // Null for a pending caller — see the note on the contents page for why labelling every
  // chapter "not in your access" would be true and useless.
  const availability = gate.pending ? undefined : (await resolveHelpAvailability(user.id)).get(slug)

  // An in-page contents only where there is enough to navigate. Two headings on one screen
  // are their own contents list.
  const showContents = chapter.sections.length >= 3

  return (
    <PageShell width="reading" className="space-y-8">
      <div>
        <Link
          href="/help"
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />{t('hlp.allHelp')}</Link>

        {part && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {part.title}
          </p>
        )}
        <h1 className="mb-2 text-3xl font-bold">{chapter.title}</h1>
        <p className="text-muted-foreground">{chapter.summary}</p>
      </div>

      <HelpAvailabilityNote availability={availability} t={t} />

      {showContents && (
        <nav aria-label={t('hlp.page')} className="rounded-xl border bg-card px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('hlp.page')}</p>
          <ul className="space-y-1 text-sm">
            {chapter.sections.map(section => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {chapter.sections.map(section => (
        <section key={section.id} aria-labelledby={section.id} className="space-y-4">
          {/* `scroll-mt-20` clears the sticky TopBar — without it, following a link from
              the contents above lands the heading underneath the bar. */}
          <h2 id={section.id} className="scroll-mt-20 text-2xl">{section.heading}</h2>
          <HelpBlocks blocks={section.blocks} />
        </section>
      ))}

      {/* The manual reads front to back, so these cross part boundaries rather than
          stopping at the end of each one. */}
      {(previous || next) && (
        <nav aria-label={t('hlp.moreManual')} className="flex flex-wrap gap-3 border-t pt-6">
          {previous && (
            <Link
              href={`/help/${previous.slug}`}
              className="group flex flex-1 basis-64 items-center gap-2 rounded-xl border bg-card px-4 py-3"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Previous</span>
                {/* Explicit colour: the unscoped `a { color: var(--brand-accent) }` in
                    globals.css would otherwise recolour the whole card. */}
                <span className="block truncate font-medium text-foreground">{previous.title}</span>
              </span>
            </Link>
          )}
          {next && (
            <Link
              href={`/help/${next.slug}`}
              className="group flex flex-1 basis-64 items-center justify-end gap-2 rounded-xl border bg-card px-4 py-3 text-right"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Next</span>
                <span className="block truncate font-medium text-foreground">{next.title}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </PageShell>
  )
}
