'use client'

import { useRef, useState } from 'react'
import {
  Receipt,
  Landmark,
  Award,
  PenLine,
  Settings,
  CalendarClock,
  History,
  PiggyBank,
  Split,
  ArrowUpRight,
  DollarSign,
  HandCoins,
  CreditCard,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminDuesClient } from '@/components/admin/AdminDuesClient'
import { AdminFundsClient } from '@/components/admin/AdminFundsClient'
import { SECTION_LABELS, type AccountSection } from '@/components/admin/account-sections'
import type { DuesSchedule, DuesPayment } from '@/app/actions/dues'
import type {
  FundWithStats,
  FundMilestone,
  FundDisbursement,
  FundAllocationRow,
} from '@/app/actions/funds'

interface Person {
  id: string
  first_name: string
  last_name: string
  nick_name?: string | null
  date_of_birth?: string | null
}

type IconComponent = React.ComponentType<{ className?: string }>

/**
 * The rail, grouped by what an admin is trying to DO rather than by which table
 * the data lives in. That is why the two "record" forms sit together under Manual
 * Recording even though separate components own them, and why Milestones is a peer
 * of Dues and Funds rather than buried inside Funds.
 */
const SECTION_GROUPS: {
  label: string
  icon: IconComponent
  items: { id: AccountSection; icon: IconComponent }[]
}[] = [
  {
    label: 'Dues',
    icon: Receipt,
    items: [
      { id: 'schedules', icon: CalendarClock },
      { id: 'payments', icon: History },
    ],
  },
  {
    label: 'Funds',
    icon: Landmark,
    items: [
      { id: 'funds', icon: PiggyBank },
      { id: 'routing', icon: Split },
      { id: 'disbursements', icon: ArrowUpRight },
    ],
  },
  {
    label: 'Milestones',
    icon: Award,
    items: [{ id: 'milestones', icon: Award }],
  },
  {
    label: 'Manual Recording',
    icon: PenLine,
    items: [
      { id: 'record-payment', icon: DollarSign },
      { id: 'record-disbursement', icon: HandCoins },
      { id: 'record-contribution', icon: Plus },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [{ id: 'processing', icon: CreditCard }],
  },
]

interface Props {
  initialSection: AccountSection
  initialSchedules: DuesSchedule[]
  initialPayments: DuesPayment[]
  initialFunds: FundWithStats[]
  allMilestones: FundMilestone[]
  allDisbursements: FundDisbursement[]
  initialAllocations: FundAllocationRow[]
  members: Person[]
}

/**
 * Shell for the Accounting admin page: owns which section is showing and renders
 * the two-level nav that switches it: groups along the top, and the active group's
 * pages in a left rail beside the pane.
 *
 * Only the section is state. The active group is derived from it, so there is no
 * way for the highlighted group and the visible pane to fall out of step, and the
 * URL carries one parameter instead of two.
 *
 * The two panel components stay MOUNTED at all times and each returns null for
 * sections it does not own. That is load-bearing, not incidental — both hold
 * optimistic rows, half-filled forms, `useTransition` state, a `routingSnapshot`
 * that is the only undo copy of the allocation table, and `useState` initializers
 * seeded from props and from the clock. Unmounting a panel on every nav click
 * would quietly discard all of it, so the nav deliberately does not remount them.
 *
 * For the same reason navigation here is `setState` + `history.replaceState` rather
 * than a router push: a real navigation refetches the RSC payload and remounts both
 * clients. The URL stays shareable; only the round trip is skipped.
 */
export function AdminAccountShell({
  initialSection,
  initialSchedules,
  initialPayments,
  initialFunds,
  allMilestones,
  allDisbursements,
  initialAllocations,
  members,
}: Props) {
  const [section, setSection] = useState<AccountSection>(initialSection)

  // Handlers that jump sections after an await need the CURRENT section, not the
  // one captured when the click happened. See AdminDuesClient's post-save jump.
  const sectionRef = useRef(section)

  function selectSection(next: AccountSection) {
    setSection(next)
    sectionRef.current = next
    // Rebuilt from the live search string rather than assembled from scratch, so a
    // section switch never drops another query param someone arrived with.
    // replaceState, not pushState: Back leaves the page instead of walking back
    // through every section visited, which is how the old tab strips behaved.
    const params = new URLSearchParams(window.location.search)
    params.set('section', next)
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
  }

  // Derived structurally rather than tracked as its own state: the group is
  // whichever one contains the active section, so the two can never disagree and
  // the URL still needs to carry nothing but `?section=`.
  const activeGroup =
    SECTION_GROUPS.find(group => group.items.some(item => item.id === section)) ?? SECTION_GROUPS[0]

  // A rail holding a single link is not navigation — for one-page groups the pane
  // takes the full width instead.
  const hasSubNav = activeGroup.items.length > 1

  return (
    <div className="space-y-6">
      {/* Level one: the groups. Clicking one opens its first page. */}
      <nav
        aria-label="Accounting areas"
        className="flex flex-wrap items-center gap-2 border-b pb-3"
      >
        {SECTION_GROUPS.map(group => {
          const active = group.label === activeGroup.label
          const target = group.items[0].id
          return (
            <a
              key={group.label}
              href={`/admin/account?section=${target}`}
              aria-current={active ? 'page' : undefined}
              onClick={e => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                // Land on the group's first page. Re-clicking the group you are
                // already in would otherwise throw away where you were inside it.
                if (!active) selectSection(target)
              }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[#0f2540] text-[#e6ecf1] font-medium'
                  : 'bg-[#e6ecfa] text-[#0f2540] hover:opacity-90',
              )}
            >
              <group.icon className="h-4 w-4 shrink-0" />
              {group.label}
            </a>
          )
        })}
      </nav>

      <div className={cn('grid gap-6', hasSubNav && 'xl:grid-cols-[16rem_1fr]')}>
        {/* Level two: the pages inside the active group. Two or three short links,
            so below xl this lies flat above the pane rather than squeezing it — a
            16rem column would leave the pane under the routing table's
            min-w-[560px] at 1024px. */}
        {hasSubNav && (
          <nav
            aria-label={`${activeGroup.label} pages`}
            className="flex flex-row flex-wrap gap-2 xl:flex-col xl:gap-0.5"
          >
            {activeGroup.items.map(item => (
              <SectionLink
                key={item.id}
                id={item.id}
                icon={item.icon}
                active={section === item.id}
                onSelect={selectSection}
              />
            ))}
          </nav>
        )}

        <div className="min-w-0 space-y-4">
          {/* Suppressed when it would only repeat the group pill above it — true for
              one-page groups named after their page, like Milestones. Settings still
              gets a title, because "Processing" says something "Settings" does not. */}
          {SECTION_LABELS[section] !== activeGroup.label && (
            <h2 className="text-lg font-semibold">{SECTION_LABELS[section]}</h2>
          )}

          <AdminDuesClient
            section={section}
            sectionRef={sectionRef}
            onNavigate={selectSection}
            initialSchedules={initialSchedules}
            initialPayments={initialPayments}
            members={members}
          />
          <AdminFundsClient
            section={section}
            initialFunds={initialFunds}
            allMilestones={allMilestones}
            allDisbursements={allDisbursements}
            initialAllocations={initialAllocations}
            members={members}
          />
          {section === 'processing' && <ProcessingPanel />}
        </div>
      </div>
    </div>
  )
}

/**
 * One page link in the sub-nav — a column beside the pane at xl, a wrapping row
 * above it below that. One component for both so they cannot drift apart.
 *
 * A real <a href> rather than a button, so cmd-click, middle-click and
 * copy-link-address all work — a plain left click is intercepted and handled
 * locally. Deliberately not next/link: ten <Link>s would each prefetch the same
 * dynamic route, and we would be working against Link's navigation to avoid the
 * remount that navigation causes.
 */
function SectionLink({ id, icon: Icon, active, onSelect }: {
  id: AccountSection
  icon: IconComponent
  active: boolean
  onSelect: (next: AccountSection) => void
}) {
  return (
    <a
      href={`/admin/account?section=${id}`}
      aria-current={active ? 'page' : undefined}
      onClick={e => {
        // Leave modified and non-primary clicks to the browser.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        onSelect(id)
      }}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          // The explicit text colours are required: globals.css has an unscoped
          // `a { color: #1aa88a }` that would otherwise paint every item teal.
          ? 'bg-[#0f2540] text-[#e6ecf1] font-medium'
          : 'bg-[#e6ecfa] text-[#0f2540] hover:opacity-90',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {SECTION_LABELS[id]}
    </a>
  )
}

/**
 * Placeholder for the payment-processor settings. Deliberately inert: there is no
 * processor config schema yet, and a form that looked functional would invite
 * someone to type real Stripe keys into a field that discards them.
 */
function ProcessingPanel() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-3">
      <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="text-sm font-medium">No payment processor connected</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Dues and disbursements are recorded by hand today, under Manual Recording.
        Connecting a processor will let members pay their dues online and have those
        payments post — and route into funds — on their own.
      </p>
      <p className="text-xs text-muted-foreground">Stripe support is planned for a future release.</p>
    </div>
  )
}
