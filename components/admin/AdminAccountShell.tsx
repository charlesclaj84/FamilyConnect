'use client'

import { useState } from 'react'
import {
  Receipt,
  Landmark,
  Award,
  Settings,
  CalendarClock,
  PiggyBank,
  Split,
  CreditCard,
  Banknote,
  HeartHandshake,
  CirclePlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AdminIncomeClient, type BeneficiaryOption } from '@/components/admin/AdminIncomeClient'
import { AdminFundsClient } from '@/components/admin/AdminFundsClient'
import {
  SECTION_LABELS, type AccountSection, type AccountRights,
} from '@/components/admin/account-sections'
import { MainRail } from '@/components/layout/MainRail'
import type { DuesSchedule, ScheduleUsage } from '@/app/actions/dues'
import type { FundWithStats, FundMilestone, FundAllocationRow } from '@/app/actions/funds'

type IconComponent = React.ComponentType<{ className?: string }>

/**
 * The rail, grouped by what an admin is trying to DO rather than by which table the
 * data lives in.
 *
 * Everything here is CONFIGURATION: what members owe, what they can give to, the pots
 * money lands in, how it splits, what an award is worth, how payments are processed.
 * An admin visits when something changes, which is rarely.
 *
 * The ledgers used to live here too, under a Transactions group. They are the day's
 * work rather than administration, so they moved to /transactions in the main nav
 * along with the three forms that append to them — which also took them out from
 * behind the `admin/account` permission, where a treasurer who only records money had
 * no business needing full Accounting rights.
 */
const SECTION_GROUPS: {
  label: string
  icon: IconComponent
  items: { id: AccountSection; icon: IconComponent }[]
}[] = [
  {
    // "Income", not "Dues": the group holds both what members owe and what they
    // choose to give.
    label: 'Income',
    icon: Receipt,
    items: [
      { id: 'dues', icon: CalendarClock },
      { id: 'donations', icon: HeartHandshake },
    ],
  },
  {
    // "Expenses": where money leaves from — the funds themselves, and the share of
    // income that tops them up.
    label: 'Expenses',
    icon: Landmark,
    items: [
      { id: 'funds', icon: PiggyBank },
      { id: 'routing', icon: Split },
    ],
  },
  {
    label: 'Milestones',
    icon: Award,
    items: [{ id: 'milestones', icon: Award }],
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [
      { id: 'processing', icon: CreditCard },
      { id: 'bank', icon: Banknote },
    ],
  },
]

/**
 * Sections whose pane has one "create" action, and the label its trigger carries.
 *
 * The trigger lives at the foot of the sub-nav, not in the pane: the pane is a list
 * of what already exists, and a button sitting on top of it was the first thing the
 * eye landed on. The dialog and every form field still belong to the panel that owns
 * the data — the shell only holds WHICH create dialog is open, because only the
 * shell knows which section the rail is showing.
 *
 * Every trigger here is always enabled. "New Milestone" needs a fund to hang off,
 * but the shell's fund list is the server's, one revalidation behind the optimistic
 * one the funds panel keeps — so a just-created fund would leave the button dead.
 * The panel, which does know, explains it inside the dialog instead.
 */
const CREATE_ACTIONS: Partial<Record<AccountSection, string>> = {
  dues: 'New Dues',
  donations: 'New Donation',
  funds: 'New Fund',
  milestones: 'New Milestone',
}

interface Props {
  initialSection: AccountSection
  initialSchedules: DuesSchedule[]
  /** Which schedules the ledger has been posted against — see AdminIncomeClient. */
  scheduleUsage: Record<string, ScheduleUsage>
  initialFunds: FundWithStats[]
  allMilestones: FundMilestone[]
  initialAllocations: FundAllocationRow[]
  /** Per-section grants, resolved on the server from SECTION_RESOURCE. */
  rights: AccountRights
  /** Adults a donation drive can be for — see AdminIncomeClient. Empty when the
   *  caller cannot view Donations, because the page gates the fetch. */
  members: BeneficiaryOption[]
}

/**
 * Shell for the Accounting admin page: owns which section is showing and renders
 * the two-level nav that switches it: groups along the top, and the active group's
 * pages in a left rail beside the pane.
 *
 * The section is state; so is which create dialog is open, because its trigger
 * lives in the rail the shell renders (see CREATE_ACTIONS). The active group is
 * DERIVED from the section, so the highlighted group and the visible pane cannot
 * fall out of step, and the URL carries one parameter instead of two.
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
  scheduleUsage,
  initialFunds,
  allMilestones,
  initialAllocations,
  rights,
  members,
}: Props) {
  // Only the sections this caller may view, and only the rails that still hold one.
  // Derived from the same rights the server actions enforce, so a visible rail always
  // leads somewhere the caller can actually go.
  const visibleGroups = SECTION_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => rights[item.id].view) }))
    .filter(group => group.items.length > 0)

  // Landing on a section they cannot view — a stale link, or a grant removed since the
  // page was last open — falls back to the first thing they can see.
  const allowedInitial = rights[initialSection].view
    ? initialSection
    : visibleGroups[0]?.items[0].id ?? initialSection

  const [section, setSection] = useState<AccountSection>(allowedInitial)

  // Which section's create dialog is open, or null. Keyed by section rather than a
  // boolean per form so the rail's single trigger needs no per-section wiring.
  const [creating, setCreating] = useState<AccountSection | null>(null)

  function selectSection(next: AccountSection) {
    setSection(next)
    // A dialog belonging to the section being left must not survive the switch.
    setCreating(null)
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
    visibleGroups.find(group => group.items.some(item => item.id === section)) ?? visibleGroups[0]

  // Reachable: `admin/account` view opens the page, but each section is its own grant,
  // so a caller can hold the page and none of its contents. Better to say so than to
  // render an empty rail beside an empty pane and let them wonder what broke.
  if (visibleGroups.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        You can open Accounting, but none of its sections have been shared with you.
        Ask an administrator for access to the areas you need — dues, donations, funds,
        routing, milestones or payment settings are each granted separately.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Level one: the groups, on the standard main rail. Clicking one opens its
          first page.
          The rail is keyed by GROUP LABEL rather than by section, because a group is
          not itself a destination — `active` is the group containing the visible
          section, and selecting one lands on its first page. */}
      <MainRail
        label="Accounting areas"
        items={visibleGroups.map(group => ({
          id: group.label,
          label: group.label,
          icon: group.icon,
          href: `/admin/account?section=${group.items[0].id}`,
        }))}
        active={activeGroup?.label ?? ''}
        onSelect={label => {
          const group = visibleGroups.find(g => g.label === label)
          // Re-selecting the group you are already in would throw away where you were
          // inside it, so only a real change moves.
          if (group && group.label !== activeGroup?.label) selectSection(group.items[0].id)
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[16rem_1fr]">
        {/* Level two: the pages inside the active group. Two or three short links,
            so below xl this lies flat above the pane rather than squeezing it — a
            16rem column used to leave the pane narrower at 1024px than the routing
            table's `min-w-[560px]` floor. The floor is gone (the table folds now —
            components/ui/table-collapse.tsx) and the flat layout stays regardless:
            a 16rem column for two links is a poor trade at any pane width.
            Rendered for every group, including the one-page ones, so the pane starts
            in the same place and the create button has a fixed home wherever you are.

            The create trigger sits with the rail but outside the <nav>: it does not
            navigate, and a nav landmark listing a button reads as a broken link to a
            screen reader. */}
        <div className="flex flex-row flex-wrap items-start gap-2 xl:flex-col xl:gap-0">
          <nav
            aria-label={`${activeGroup?.label ?? 'Accounting'} pages`}
            className="flex flex-row flex-wrap gap-2 xl:w-full xl:flex-col xl:gap-0.5"
          >
            {(activeGroup?.items ?? []).map(item => (
              <SectionLink
                key={item.id}
                id={item.id}
                icon={item.icon}
                active={section === item.id}
                onSelect={selectSection}
              />
            ))}
          </nav>
          {CREATE_ACTIONS[section] && rights[section].create && (
            // Right-aligned, ruled off from the links at xl, and olive: the burgundy of
            // the default button is exactly what the ACTIVE link looks like, so a
            // solid burgundy trigger read as a further page that was selected.
            <div className="ml-auto flex justify-end xl:ml-0 xl:mt-3 xl:w-full xl:border-t xl:pt-3">
              {/* CirclePlus, not a bare Plus: the glyph carries weight against the
                  green fill, and it is not the Pencil this page already uses for
                  editing a row. All three triggers read "New …" so the rail says the
                  same thing whichever section you are in. */}
              <Button
                variant="affirm"
                onClick={() => setCreating(section)}
              >
                <CirclePlus className="h-4 w-4 mr-1" /> {CREATE_ACTIONS[section]}
              </Button>
            </div>
          )}
        </div>

        {/* No pane heading: the group pill above and the highlighted rail link
            already name the page, and a third copy of the same word was the first
            line of every section. */}
        <div className="min-w-0 space-y-4">
          {/* `creating` goes down raw rather than as a boolean per dialog: each panel
              owns several, and it already reads `section` the same way. */}
          <AdminIncomeClient
            section={section}
            creating={creating}
            onCloseCreate={() => setCreating(null)}
            initialSchedules={initialSchedules}
            scheduleUsage={scheduleUsage}
            rights={rights}
            members={members}
          />
          <AdminFundsClient
            section={section}
            creating={creating}
            onCloseCreate={() => setCreating(null)}
            initialFunds={initialFunds}
            allMilestones={allMilestones}
            initialAllocations={initialAllocations}
            rights={rights}
          />
          {section === 'processing' && <ProcessingPanel />}
          {section === 'bank' && <BankInfoPanel />}
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
          // `a { color: var(--brand-accent) }` that would otherwise paint every item terracotta.
          ? 'bg-brand-primary text-brand-on-primary font-medium'
          : 'bg-brand-soft text-brand-on-soft hover:opacity-90',
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
        Dues and disbursements are recorded by hand today, from the Transactions ledgers.
        Connecting a processor will let members pay their dues online and have those
        payments post — and route into funds — on their own.
      </p>
      <p className="text-xs text-muted-foreground">Stripe support is planned for a future release.</p>
    </div>
  )
}

/**
 * Placeholder for the family's bank details — where dues get deposited and what
 * reimbursements are drawn from.
 *
 * Inert for the same reason as ProcessingPanel, and more so: a form that looked
 * functional would invite a treasurer to type a real account and routing number
 * into fields that discard them. Nothing here is stored yet, and the schema this
 * needs (encrypted at rest, readable by far fewer people than 'admin/account'
 * grants today) does not exist.
 */
function BankInfoPanel() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-3">
      <Banknote className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="text-sm font-medium">No bank account on file</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        The account dues are deposited into, and that disbursements and event expenses
        are paid from, will be recorded here — so the numbers on a check or a transfer
        do not have to be looked up somewhere else.
      </p>
      <p className="text-xs text-muted-foreground">
        Not yet available. Account details need encrypted storage and a narrower
        permission than Accounting before they can be kept here.
      </p>
    </div>
  )
}
