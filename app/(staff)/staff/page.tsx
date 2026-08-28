import Link from 'next/link'
import { ArrowRight, Building2, UserSearch } from 'lucide-react'
import { requireStaff } from '@/lib/auth/staff'
import { getStaffFamilyCounts } from '@/app/actions/staff/families'
import { getStaffMembershipCount } from '@/app/actions/staff/accounts'
import { PageShell } from '@/components/layout/PageShell'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { callerI18n } from '@/lib/i18n/server'

export const metadata = { title: 'Overview' }

/**
 * What the console can do, with the two numbers that say whether anything needs doing.
 *
 * ── IT GATES ITSELF, THOUGH THE LAYOUT ALREADY DID ─────────────────────────────────
 * `requireStaff()` here as well as in `app/(staff)/layout.tsx`, for the reason AGENTS.md
 * §1 gives every page: a guard upstream is a convenience and not a gate. It costs one
 * memoized read (`staffGrant` is `cache()`d per request) and it is what holds if this
 * page is ever rendered through a different layout.
 *
 * ── `PageShell`, AND `wide` ────────────────────────────────────────────────────────
 * The member shell's page container, used here rather than a bespoke measure. Its whole
 * argument is that a per-page `max-w` drifts to whatever its author last had on screen —
 * five different widths were in the tree before it existed — and a console growing its
 * own sixth would be that drift starting again in a new directory. `wide` because the
 * content is cards and, on the two screens below, tables: the `reading` measure is for a
 * single column of prose read start to finish.
 *
 * ── NOTHING HERE IS PER FAMILY, WHICH IS WHY THE COUNTS ARE WORTH PRINTING ─────────
 * Every other count in this codebase is one family's. `removed` in particular has no
 * member-facing reader at all — a family that has been removed cannot show anybody
 * anything — so this is the only screen in the product where somebody can find out that
 * a customer is sitting behind the "no longer available" notice waiting to be let back
 * in. That is what makes it the first thing on the page rather than a column on a table.
 */
export default async function StaffOverviewPage() {
  const { t } = await callerI18n(null)
  await requireStaff()

  // Both gate themselves again, and both go through the service role on purpose — see
  // the headers on the two action modules for why §3's usual family-scoping obligation
  // is inverted rather than forgotten.
  const [families, memberships] = await Promise.all([
    getStaffFamilyCounts(),
    getStaffMembershipCount(),
  ])

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">{APP_NAME} staff console</h1>
        <p className="max-w-2xl text-muted-foreground">{t('stf.crossFamilyToolsAnswering')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ConsoleCard
          href="/staff/families"
          icon={Building2}
          title="Families"
          blurb="Every family, its plan, how many members it has, and whether it has been removed. Restoring one is here."
        >
          <Figure value={families.total} label={families.total === 1 ? 'family' : 'families'} />
          <Figure value={families.active} label="active" />
          {/* `--brand-withheld`, NEVER `--destructive`. A removed family has lost no rows
              — removal is a status column and the way back is one click on the next
              screen — so the alarm hue would be describing a deletion that did not
              happen. That token is exactly the reversible-capability-withheld role, and it
              is a foreground only: it has no `on-` partner, so it is never a fill behind
              text (AGENTS.md, "Colours live in one place"). */}
          <Figure
            value={families.removed}
            label="removed"
            className={families.removed > 0 ? 'text-brand-withheld' : undefined}
          />
        </ConsoleCard>

        <ConsoleCard
          href="/staff/accounts"
          icon={UserSearch}
          title="Accounts"
          blurb="Every sign-in account, whether its address is confirmed, whether it has ever been used, and which families it belongs to."
        >
          {/* MEMBERSHIPS, and the label says memberships. There is no cheap honest count
              of ACCOUNTS: counting DISTINCT user_id is not expressible in PostgREST and
              GoTrue's admin list returns no dependable total (see
              lib/auth/account-state.ts). One person in three families is three of these
              and one account, so calling this "accounts" would be a number a support
              engineer repeats to a customer and is wrong about. */}
          <Figure
            value={memberships}
            label={memberships === 1 ? 'membership' : 'memberships'}
          />
        </ConsoleCard>
      </div>

      <section className="rounded-xl border bg-card p-5 text-sm text-card-foreground">
        <h2 className="mb-2 text-base font-semibold">{t('stf.accessConsole')}</h2>
        {/* THIS PARAGRAPH WAS FALSE FOR MOST OF 2026-08-19 and is worth a note, because the
            way it went wrong is the way this kind of copy always goes wrong. It read "there is
            no screen that grants it, deliberately" — an accurate statement of the old design,
            left standing on the landing page after /staff/access shipped, one click from a nav
            item that contradicted it. Prose describing an absence has no test: nothing fails
            when the absence ends. If the grant flow moves again, this is the sentence to
            change, and AGENTS.md's staff-console section is the other one. */}
        <p className="text-muted-foreground">{t('stf.staffAccessRow')}<code className="rounded bg-muted px-1 py-0.5 text-xs">genorra_staff</code>.
          An <strong className="font-medium text-foreground">owner</strong> grants and revokes it
          from <strong className="font-medium text-foreground">Access</strong>, by email address, with
          a note saying why — support and engineer roles cannot open that screen or read the team.
          The very first owner is still seeded by hand with SQL, because a console that could
          bootstrap its own first account would need no account to do it.
        </p>
        <p className="mt-2 text-muted-foreground">{t('stf.anybodyWithoutRowGets')}</p>
      </section>
    </PageShell>
  )
}

/** One destination: a card that is entirely a link, with its figures inside it. */
function ConsoleCard({
  href,
  icon: Icon,
  title,
  blurb,
  children,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    // Explicit `text-card-foreground`: globals.css paints every bare anchor
    // `--brand-accent`, and a whole card in terracotta is not a design decision anybody
    // made. Same note as the nav in the header band.
    <Link
      href={href}
      className="group flex flex-col rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:border-brand-primary/40 hover:bg-brand-soft/30"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
        <ArrowRight
          className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{blurb}</p>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">{children}</dl>
    </Link>
  )
}

/**
 * A number and what it counts, as a `<dt>`/`<dd>` pair so the two are associated.
 *
 * `flex-col-reverse` rather than writing the `<dd>` first: a definition list requires the
 * term before its description, and a `<dd>` with no preceding `<dt>` is invalid markup
 * that assistive technology reads as an orphan. The figure still sits above its caption,
 * because reversing the visual order costs one class and rewriting the semantics costs
 * the association.
 */
function Figure({ value, label, className }: {
  value: number
  label: string
  className?: string
}) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn('text-2xl font-semibold tabular-nums', className)}>{value}</dd>
    </div>
  )
}
