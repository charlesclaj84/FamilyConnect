'use client'

import { useState } from 'react'
import {
  Receipt,
  Landmark,
  Award,
  Settings,
  PiggyBank,
  Split,
  CreditCard,
  Banknote,
  CirclePlus,
  CalendarClock,
  HeartHandshake,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AdminIncomeClient, type BeneficiaryOption, type ScopeOptions } from '@/components/admin/AdminIncomeClient'
import { AdminFundsClient } from '@/components/admin/AdminFundsClient'
import {
  sectionLabel, isIncomeSection,
  type AccountSection, type AccountRights, type IncomeSection,
} from '@/components/admin/account-sections'
import { MainRail } from '@/components/layout/MainRail'
import { ProcessingPanel } from '@/components/admin/ProcessingPanel'
import type { ProcessorStatus } from '@/app/actions/admin/processing'
import type { DuesSchedule, ScheduleUsage } from '@/app/actions/dues'
import type { FundWithStats, FundMilestone, FundAllocationRow } from '@/app/actions/funds'
import { useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

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

/**
 * One item on the second-level rail: the sections its pane renders, and its glyph.
 *
 * ── WHY `sections` IS A LIST WHEN EVERY ITEM TODAY HOLDS EXACTLY ONE ───────────────
 * Dues and Donations were one item spanning two sections between 2026-08-19 and 2026-08-20,
 * on the argument that they are one screen in every way a reader can see: the same table, the
 * same CRUD, the same edit dialog, split only by `kind` and worded by `KIND_COPY`
 * (AdminIncomeClient says so in its own comment).
 *
 * They are two items again, because the thing that argument left out is the GRANT. Two keys
 * behind one caption made an administrator translate two grid rows into one rail word, and a
 * treasurer who held only one of them was shown a caption naming the other. Sameness of table
 * is a weaker fact than difference of permission.
 *
 * The list stays because it costs nothing and it is what makes `visibleGroups` able to narrow
 * an item to the caller's half — see the file header.
 *
 * ── ONE RAIL ITEM, ONE PERMISSION RESOURCE — no exceptions on this rail ───────────
 * Dues and Donations were briefly one item captioned "Dues & Donations", spanning
 * `admin/accounting/dues` and `admin/accounting/donations`. They are two items again as of
 * 2026-08-20, and every item on this rail now maps to exactly one key.
 *
 * The two keys were never the question — they have always been separate rows in
 * `permission_resources`, separate switches on the grid, and they have to stay that way:
 * "Separation of duties — per-feature permissions, so recording dues is not the same as
 * paying money out" is a Free plan bullet in `lib/plans.ts`. What changed is that the RAIL
 * stopped disagreeing with them. A family that lets somebody run the dues schedule but not
 * the donation drives now sees exactly one item, and it is the one they were granted.
 *
 * ── SO EVERY CAPTION COMES FROM ITS RESOURCE, WHICH IS THE ORDINARY RULE ──────────
 * "Captions come from the screen": a rail caption is its resource's `label`, so an
 * administrator matching a switch to the thing it switches off does not have to translate.
 * The merged item could not obey that — two labels, one caption — and carried a hand-set
 * string plus a `captionOf` that had to decide when to use it. Both are gone;
 * `SECTION_LABELS` is the only source of a caption here, and there is no way to type one in.
 *
 * The machinery for a multi-section item is deliberately KEPT (`sections` is still a list,
 * `visibleGroups` still narrows it, `shows()` still asks). It cost nothing to leave, it is
 * what makes a caller holding one grant of a pair see only their half, and this rail has
 * already merged and split one item once.
 */
interface SectionItem {
  /**
   * The sections this item's pane renders, in the order they appear in it. The FIRST is
   * canonical: it is the `?section=` the rail links to and the value `selectSection`
   * writes. `visibleGroups` filters this list down to what the caller may view, so
   * `sections[0]` is always something they can see.
   */
  sections: readonly AccountSection[]
  icon: IconComponent
}

// A FUNCTION of `t` since Phase 5: every caption in here comes from the reader's catalogue
// and cannot be resolved at module load. The SECTION IDS, the icons and the ORDER stay —
// which is what this registry is actually for, and what `LEDGER_RESOURCE`-style grants key
// on. See `components/admin/account-sections.ts`.
function sectionGroups(t: T): {
  label: string
  icon: IconComponent
  items: SectionItem[]
}[] {
  return [
    {
      // "Income", not "Dues": the group holds both what members owe and what they
      // choose to give.
      label: t('acct.section.income'),
      icon: Receipt,
      items: [
        // ── TWO ITEMS AGAIN SINCE 2026-08-20, and the split is the plainer arrangement ──
        // They were one item captioned "Dues & Donations" for a day. Two keys behind one rail
        // caption is a stated exception to "One rail item, one permission resource", and the
        // exception bought nothing here: `admin/accounting/dues` and
        // `admin/accounting/donations` were always separate switches on the grid, so the merged
        // caption's whole job was to translate two grid rows into one rail word — which is a
        // translation an administrator should not have to do at all.
        //
        // Splitting also un-hides a real asymmetry. A dues schedule is a standing OBLIGATION
        // the family assigns; a donation drive is an INVITATION with a goal and a bar. They
        // share a table and nothing else, and stacking them under one heading made the second
        // read as an appendix to the first.
        //
        // EACH GLYPH DESCRIBES ITS OWN HALF, which is what the merged item could not do: it
        // wore the group's own Receipt because either specific icon would have made the item
        // read as one page with the other tacked on.
        { sections: ['dues'], icon: CalendarClock },
        { sections: ['donations'], icon: HeartHandshake },
      ],
    },
    {
      // ── "Funds", NOT "Expenses", SINCE 2026-08-22 ──────────────────────────────────
      // Neither page under this heading is an expense. `funds` is the family's pots and their
      // balances; `routing` is how incoming money is SPLIT between them. Money leaving is a
      // disbursement, and disbursements are a ledger on /transactions, which is not here at
      // all — so the old caption named a thing this group does not contain and sent a treasurer
      // looking for spending under it.
      //
      // IT NOW READS THE SAME AS ITS FIRST PAGE, which `account-sections.ts` warns against in
      // the general case ("the group pill above it already says Income or Funds, so repeating
      // that here would label both levels the same"). The warning is about a page name that
      // adds nothing; this is the other case — the group IS the funds domain and its first page
      // IS the fund list, the same way the Gatherings rail section holds a Gatherings item. The
      // second page keeps its own name and still tells the reader where they are.
      label: 'Funds',
      icon: Landmark,
      items: [
        { sections: ['funds'], icon: PiggyBank },
        { sections: ['routing'], icon: Split },
      ],
    },
    {
      label: t('acct.section.milestones'),
      icon: Award,
      items: [{ sections: ['milestones'], icon: Award }],
    },
    {
      label: t('acct.section.settings'),
      icon: Settings,
      items: [
        { sections: ['processing'], icon: CreditCard },
        { sections: ['bank'], icon: Banknote },
      ],
    },
  ]
}

/**
 * The caption on an item's rail link — always its first visible section's own label.
 *
 * ONE SOURCE, AND NO WAY TO TYPE ONE IN. This took a hand-set `label` off the item while Dues
 * & Donations spanned two sections, and had to decide when to prefer it: narrowed to one
 * section by what the caller may view, "Dues & Donations" would have named a list beside the
 * one on screen. With the item split there is nothing to prefer, so the branch and the field
 * are both gone and "Captions come from the screen" holds here without an exception.
 */
function captionOf(item: SectionItem, t: T): string {
  return sectionLabel(t, item.sections[0])
}

/**
 * A section AdminIncomeClient does not own, handed to one of its two instances to make it
 * render nothing. See `incomeSectionFor` below for the whole argument. Any of funds,
 * routing, milestones, processing or bank would do — that panel only ever asks whether the
 * value is one of its own two — and a real section is named rather than a sentinel invented,
 * so nothing here reads as a fifth pane that exists somewhere.
 */
const NOT_AN_INCOME_SECTION: AccountSection = 'funds'

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
 *
 * THE SLOT HOLDS ONE TRIGGER PER SECTION THE ITEM SHOWS — one per item on today's rail,
 * since Dues and Donations split back apart on 2026-08-20 and nothing else spans two.
 *
 * It is still written as a LIST rather than a single button, and that is not leftover: each
 * trigger is rendered under its OWN `create` grant and sets `creating` to its own section, so
 * a caller who may view a section and not create in it gets the pane and no button. Collapsing
 * it to one would put that decision back in the shell, which is the thing that made "New Dues"
 * appear for somebody who could only add a donation.
 */
function createActions(t: T): Partial<Record<AccountSection, string>> {
  return {
    dues: t('acct.newDues'),
    donations: t('acct.newDonation'),
    funds: t('acct.newFund'),
    milestones: t('acct.newMilestone'),
  }
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
  /** Whether the family has a bloodline to restrict a due to — see AdminIncomeClient. */
  hasBloodline: boolean
  /** The regions and chapters a due can be scoped to — see AdminIncomeClient. Empty when
   *  the caller cannot view Dues, because the page gates the fetch. */
  scopeOptions: ScopeOptions
  /**
   * The family's Stripe connection, or null.
   *
   * NULL MEANS TWO DIFFERENT THINGS and the panel tells them apart: the page passes null when
   * the caller cannot view this section (§5 — the fetch is gated, not the pane), and the action
   * returns null when the read was refused. The panel renders nothing for the first and a
   * warning for the second, which is why this is not a boolean.
   */
  processorStatus: ProcessorStatus | null
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
 * The panel components stay MOUNTED at all times and each returns null for sections it
 * does not own. That is load-bearing, not incidental — they hold optimistic rows,
 * half-filled forms, `useTransition` state, a `routingSnapshot` that is the only undo
 * copy of the allocation table, and `useState` initializers seeded from props and from
 * the clock. Unmounting a panel on every nav click would quietly discard all of it, so
 * the nav deliberately does not remount them.
 *
 * THERE ARE THREE OF THEM, NOT TWO, and that survived the rail split: two AdminIncomeClient
 * instances, one per kind, because that component renders exactly one kind and the shell keeps
 * both mounted whichever pane is showing. `incomeSectionFor` is how each is told whether to
 * draw, and it keeps the mounted-at-all-times rule rather than working around it — which is
 * what stops a half-typed dues form being discarded by a click on Donations.
 *
 * For the same reason navigation here is `setState` + `history.replaceState` rather
 * than a router push: a real navigation refetches the RSC payload and remounts every
 * one of them. The URL stays shareable; only the round trip is skipped.
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
  hasBloodline,
  scopeOptions,
  processorStatus,
}: Props) {
  const t = useT()
  // Only the sections this caller may view, and only the items and rails that still hold
  // one. Derived from the same rights the server actions enforce, so a visible rail always
  // leads somewhere the caller can actually go.
  //
  // NARROWING `sections` ITSELF is what makes AGENTS.md §5 fall out of one filter rather
  // than being remembered twice: the surviving list is BOTH what makes the item appear and
  // what the pane renders, so a caller holding Donations and not Dues gets one rail item
  // showing one block, and a caller holding neither gets no item at all. There is no second
  // place that has to agree about it.
  const visibleGroups = sectionGroups(t)
    .map(group => ({
      ...group,
      items: group.items
        .map(item => ({ ...item, sections: item.sections.filter(s => rights[s].view) }))
        .filter(item => item.sections.length > 0),
    }))
    .filter(group => group.items.length > 0)

  // Landing on a section they cannot view — a stale link, or a grant removed since the
  // page was last open — falls back to the first thing they can see.
  const allowedInitial = rights[initialSection].view
    ? initialSection
    : visibleGroups[0]?.items[0].sections[0] ?? initialSection

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

  // Derived structurally rather than tracked as its own state: the item is whichever one
  // renders the active section and the group is whichever one contains that item, so none of
  // the three can disagree and the URL still needs to carry nothing but `?section=`. That is
  // also why `?section=donations` still works and still has to: it is in every link anyone
  // shared while Donations was a rail item of its own, and it now resolves to the combined
  // item rather than to a page that no longer exists.
  const activeItem =
    visibleGroups.flatMap(group => group.items).find(item => item.sections.includes(section))
    ?? visibleGroups[0]?.items[0]
  const activeGroup =
    visibleGroups.find(group => group.items.some(item => item.sections.includes(section)))
    ?? visibleGroups[0]

  /** Does the pane on screen render this section's block? */
  const shows = (s: AccountSection) => activeItem?.sections.includes(s) ?? false

  /**
   * Which section to hand one of the two AdminIncomeClient instances.
   *
   * That component renders exactly ONE kind, chosen by the `section` it is given, and
   * returns null for a section it does not own — which is the convention the whole shell is
   * built on. Showing dues AND donations in one pane therefore takes two instances, each
   * handed its own kind while the pane is showing it.
   *
   * Both stay MOUNTED whether the pane is showing or not, for the reason in the component
   * doc above: each holds optimistic schedule rows, a half-typed create form and its own
   * `useTransition` state, and a section switch must not discard any of it. So hiding one is
   * done by handing it a section it does not own — the live `section` when that is already
   * such a value, and `NOT_AN_INCOME_SECTION` when it is not. The second case is real rather
   * than defensive: a caller holding only Donations sits on `section === 'donations'` with
   * the dues instance mounted, and handing IT 'donations' would draw the donation list twice.
   */
  const incomeSectionFor = (own: IncomeSection): AccountSection =>
    shows(own) ? own : isIncomeSection(section) ? NOT_AN_INCOME_SECTION : section

  // One trigger per section this pane shows that HAS a create action and the grant for it —
  // one button per item on today's rail, and zero for a caller who may view a section without
  // creating in it. See CREATE_ACTIONS for why this stays a list.
  const createTargets = (activeItem?.sections ?? [])
    .filter(s => createActions(t)[s] && rights[s].create)

  // Reachable: `admin/account` view opens the page, but each section is its own grant,
  // so a caller can hold the page and none of its contents. Better to say so than to
  // render an empty rail beside an empty pane and let them wonder what broke.
  if (visibleGroups.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">{t('adm.canOpenAccountingBut')}</div>
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
        label={t('acct.rail')}
        items={visibleGroups.map(group => ({
          id: group.label,
          label: group.label,
          icon: group.icon,
          href: `/admin/accounting?section=${group.items[0].sections[0]}`,
        }))}
        active={activeGroup?.label ?? ''}
        onSelect={label => {
          const group = visibleGroups.find(g => g.label === label)
          // Re-selecting the group you are already in would throw away where you were
          // inside it, so only a real change moves.
          if (group && group.label !== activeGroup?.label) selectSection(group.items[0].sections[0])
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
            aria-label={`${activeGroup?.label ?? t('acct.heading')} pages`}
            className="flex flex-row flex-wrap gap-2 xl:w-full xl:flex-col xl:gap-0.5"
          >
            {(activeGroup?.items ?? []).map(item => (
              <SectionLink
                key={item.sections[0]}
                id={item.sections[0]}
                label={captionOf(item, t)}
                icon={item.icon}
                active={item.sections.includes(section)}
                onSelect={selectSection}
              />
            ))}
          </nav>
          {createTargets.length > 0 && (
            // Right-aligned, ruled off from the links at xl, and olive: the burgundy of
            // the default button is exactly what the ACTIVE link looks like, so a
            // solid burgundy trigger read as a further page that was selected.
            //
            // `flex-wrap gap-2` is kept although every item now puts at most ONE button here:
            // it was written when Dues & Donations put two side by side, and the layout it
            // produces for one button is identical. Re-simplifying it would have to be undone
            // by the next item that spans two sections, and the wrap costs nothing.
            <div className="ml-auto flex flex-wrap justify-end gap-2 xl:ml-0 xl:mt-3 xl:w-full xl:flex-col xl:border-t xl:pt-3">
              {createTargets.map(target => (
                /* CirclePlus, not a bare Plus: the glyph carries weight against the
                   green fill, and it is not the Pencil this page already uses for
                   editing a row. Every trigger reads "New …" so the rail says the
                   same thing whichever section you are in. */
                <Button
                  key={target}
                  variant="affirm"
                  onClick={() => setCreating(target)}
                >
                  <CirclePlus className="h-4 w-4 mr-1" /> {createActions(t)[target]}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* NO PANE HEADING, ANYWHERE ON THIS RAIL: the group pill above and the highlighted
            rail link already name the page, and a third copy of the same word was the first
            line of every section.

            Dues & Donations was the one exception while it was a single item showing two
            lists — two lists in one pane are two things, so each got an `<h2>`. With the item
            split there is one list per pane again and `labelBlocks` went with it. Do not
            reintroduce a heading here for a single-section pane; if a future item genuinely
            shows two lists, it owes them their headings back. */}
        <div className="min-w-0 space-y-4">
          {/* TWO INSTANCES OF ONE PANEL, one per kind — see `incomeSectionFor` for why that
              is what showing both lists at once costs, and why both stay mounted.

              `creating` IS FILTERED PER INSTANCE, and it has to be. `AdminIncomeClient`
              derives its dialog's open state from `creating` ALONE (`creatingKind !== null`),
              not from its own section, so handing both instances the raw value would open two
              identical New Donation dialogs on top of each other. Filtered, each instance
              answers only for its own kind and the other's `creatingKind` is null — which
              also means only the instance that owns the dialog clears its error message when
              the dialog opens, which is what it always did when there was one of them.

              The mount is guarded by the caller's own grant, not by the pane: `rights` comes
              from the server and cannot change while the page is open, so this decides the
              tree once and never remounts anything. */}
          {rights.dues.view && (
            <div className="space-y-4">
              <AdminIncomeClient
                section={incomeSectionFor('dues')}
                creating={creating === 'dues' ? 'dues' : null}
                onCloseCreate={() => setCreating(null)}
                initialSchedules={initialSchedules}
                scheduleUsage={scheduleUsage}
                rights={rights}
                members={members}
                hasBloodline={hasBloodline}
                scopeOptions={scopeOptions}
              />
            </div>
          )}
          {rights.donations.view && (
            <div className="space-y-4">
              <AdminIncomeClient
                section={incomeSectionFor('donations')}
                creating={creating === 'donations' ? 'donations' : null}
                onCloseCreate={() => setCreating(null)}
                initialSchedules={initialSchedules}
                scheduleUsage={scheduleUsage}
                rights={rights}
                members={members}
                hasBloodline={hasBloodline}
                scopeOptions={scopeOptions}
              />
            </div>
          )}
          {/* `creating` goes down raw here: this panel owns three sections and several
              dialogs, none of which shares a pane with another. */}
          <AdminFundsClient
            section={section}
            creating={creating}
            onCloseCreate={() => setCreating(null)}
            initialFunds={initialFunds}
            allMilestones={allMilestones}
            initialAllocations={initialAllocations}
            rights={rights}
          />
          {section === 'processing' && <ProcessingPanel status={processorStatus} />}
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
function SectionLink({ id, label, icon: Icon, active, onSelect }: {
  /**
   * The CANONICAL section — `sections[0]` of the item. It is what the href carries and
   * what a click selects; an item spanning more than one section is active for any of
   * them, which the caller decides, not this component.
   */
  id: AccountSection
  /**
   * The caption. Passed in rather than looked up here, because Dues & Donations spans two
   * `SECTION_LABELS` entries and neither of them alone names the item — see SectionItem.
   */
  label: string
  icon: IconComponent
  active: boolean
  onSelect: (next: AccountSection) => void
}) {
  return (
    <a
      href={`/admin/accounting?section=${id}`}
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
      {label}
    </a>
  )
}

/**
 * Placeholder for the payment-processor settings. Deliberately inert: there is no
 * processor config schema yet, and a form that looked functional would invite
 * someone to type real Stripe keys into a field that discards them.
 */
// ── ProcessingPanel MOVED OUT ON 2026-08-23 ─────────────────────────────────────────
// It was an inert placeholder here — "Stripe support is planned for a future release" — and
// it is real now, in components/admin/ProcessingPanel.tsx, because it needs a prop. Its own
// header carries why it is a separate file and why this shell's keep-everything-mounted rule
// does not apply to it.

/**
 * Placeholder for the family's bank details — where dues get deposited and what
 * reimbursements are drawn from.
 *
 * Inert for the same reason as ProcessingPanel, and more so: a form that looked
 * functional would invite a treasurer to type a real account and routing number
 * into fields that discard them. Nothing here is stored yet, and the schema this
 * needs (encrypted at rest, readable by far fewer people than 'admin/accounting'
 * grants today) does not exist.
 */
function BankInfoPanel() {
  const t = useT()
  return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-3">
      <Banknote className="h-8 w-8 mx-auto text-muted-foreground" />
      <p className="text-sm font-medium">{t('acct.noBank')}</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('adm.accountDuesDepositedInto')}</p>
      <p className="text-xs text-muted-foreground">{t('adm.notYetAvailableAccount')}</p>
    </div>
  )
}
