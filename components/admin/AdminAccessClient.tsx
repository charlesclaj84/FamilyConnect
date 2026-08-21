'use client'

import { Fragment, useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MoreVertical, Plus, Trash2, Pencil, ShieldCheck, Check, Ban, UserCheck,
  Users, KeyRound, Clock, Network, ChevronDown,
} from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
import { SortTh, useTableSort } from '@/components/ui/sortable-header'
import { COLLAPSING_CELL, RowMeta, MetaIf } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'
import {
  createTemplate, renameTemplate, deleteTemplate, setTemplatePermission,
  applyTemplate, setMemberEnabled, searchMembers,
  type TemplateSummary, type ResourceSummary, type PolicyMap, type MemberSummary,
} from '@/app/actions/admin/permissions'
import { usePagedMembers, MemberSearchBox, Pager } from '@/components/admin/MemberSearch'
import {
  ACTIONS, SCOPE_LABEL, SCOPE_STYLE, scopesFor, groupResources,
} from '@/components/admin/resource-groups'
import { formatBoardTitle } from '@/lib/board-positions'
import { MemberProfileEditDialog } from '@/components/admin/MemberProfileEditDialog'
import { MemberPositionDialog } from '@/components/admin/MemberPositionDialog'
import { AdminApprovalsClient } from '@/components/admin/AdminApprovalsClient'
import { AdminRegionsChaptersClient } from '@/components/admin/AdminRegionsChaptersClient'
import { AdminBoardPositionsClient } from '@/components/admin/AdminBoardPositionsClient'
import {
  MemberDetailsDialog, MemberDetailsTrigger,
  type MemberDetails,
} from '@/components/members/MemberDetailsDialog'
import { HelpLink } from '@/components/help/HelpLink'
import { InviteMemberDialog } from '@/components/invitations/InviteMemberDialog'
import { MainRail, type MainRailItem } from '@/components/layout/MainRail'
import type { Applicant } from '@/app/actions/admin/approvals'
import type {
  Region, Chapter, ScopeUsage,
  BoardPosition, BoardPositionHolder, AssignableMember,
} from '@/app/actions/admin/chapters'
import type { FamilyInvitation } from '@/app/actions/invitations'

/**
 * Members & Access — one screen for what used to be three.
 *
 * The old pair could not be merged while a member's access was the union of N group
 * policies layered over a per-person override grid, because no single view could
 * state the answer. One template per member makes the answer a single word on the
 * member's row, and the template's grid the only place it is decided.
 *
 * So: MEMBERS is a filterable list with a row menu, TEMPLATES is the grid,
 * PENDING APPROVAL is the join queue that used to live at /admin/approvals, and
 * ORGANIZATION is the regions and chapters that used to live at /admin/chapters — the
 * four questions you can ask about who is in this family, how it is divided up and what
 * each of them may do.
 *
 * EACH TAB IS GATED SEPARATELY, and that is load-bearing rather than tidy. Four resource
 * keys, one per tab — `admin/users`, `admin/approvals`, `admin/users/templates`,
 * `admin/chapters` — and a tab is absent, with its data unfetched, for a caller who does
 * not hold its key. See the page, which decides all four, and which carries the tier
 * argument for the fourth: `admin/chapters` is `tier: 'plus'` on a page that is Free, so
 * that pane is the one whose grant is not the whole of its gate.
 *
 * The three splits have different reasons and all are worth keeping straight:
 *   * Pending Approval, because the rows behind it are the only place an applicant's
 *     name, email, phone and date of birth are visible to anyone but themselves.
 *   * Permission Templates, because editing a grid can invent authority while
 *     re-templating a member can only hand out authority that already exists — so a
 *     roster administrator need not be someone who can promote themselves.
 *   * Organization, because dividing the family up is what decides who owes a regional or
 *     chapter due (20260817000008) — a treasury decision wearing a geography costume, and
 *     not something every roster administrator should be able to redraw.
 */

export type AccessTab = 'members' | 'templates' | 'approvals' | 'organization'

interface Rights { view: boolean; create: boolean; edit: boolean; remove: boolean }

/** The join queue. Supplied only for the tab that shows it — null otherwise. */
export interface ApprovalsData {
  pending: Applicant[]
  decided: Applicant[]
  canDecide: boolean
  invitations: FamilyInvitation[]
}

/**
 * The family's regions and chapters, and what the caller may do to them. Supplied only
 * for the tab that shows it — null otherwise, on the same terms as `ApprovalsData`.
 *
 * The three write flags travel WITH the data rather than being resolved here, because
 * they are three separate grants on `admin/chapters` and only the server can resolve
 * them (§5: the page decides, the UI follows). They are `canAny` on the page for the
 * reason `/admin/members/organization` gave: a region is family-wide configuration with nobody to
 * own it, so scope 'own' means nothing and `can()` would offer a button every action
 * then refuses.
 */
/**
 * The Organization pane's data — TWO HALVES UNDER TWO KEYS since 2026-08-20.
 *
 * The geography (regions and chapters, `admin/chapters`) and the offices (board positions,
 * `admin/boardpositions`). They are two jobs a family delegates separately — somebody may
 * curate the board roster without being trusted to redraw the regions — so the keys stayed
 * separate when the screens merged, which is AGENTS.md's rule about a pane spanning two keys.
 *
 * `showGeography` / `showBoard` ARE SEPARATE FROM THE ARRAYS BEING EMPTY, and that is the
 * whole reason they exist: an empty `positions` array means "this family has no board
 * positions yet", which the pane says out loud and invites you to fix, while `showBoard: false`
 * means "not yours to see", which it must not mention at all. Inferring one from the other
 * would tell a caller without the grant that the family has nothing — a statement about
 * somebody else's data, made by a screen that was told not to show it.
 */
export interface OrganizationData {
  /** `admin/chapters` — the geography half. False renders no regions and no chapters. */
  showGeography: boolean
  regions: Region[]
  chapters: Chapter[]
  usage: ScopeUsage
  mayCreate: boolean
  mayEdit: boolean
  mayDelete: boolean
  /** `admin/boardpositions` — the offices half. False renders no board section at all. */
  showBoard: boolean
  positions: BoardPosition[]
  holders: BoardPositionHolder[]
  /**
   * The roster for the assignment dialog, and the regions and chapters a scoped position can
   * be assigned to. All three ride on `mayEditBoard` rather than on the view grant, because
   * they exist only to fill that dialog — a view-only caller has no use for a roster and no
   * business receiving one (§5).
   */
  boardMembers: AssignableMember[]
  boardRegions: { id: string; name: string }[]
  boardChapters: { id: string; name: string }[]
  mayCreateBoard: boolean
  mayEditBoard: boolean
  mayDeleteBoard: boolean
}

/**
 * The board-position data the MEMBERS pane needs, and ONLY when that tab is open.
 *
 * ── WHY THE ROSTER CARRIES THIS AT ALL, SINCE 2026-08-20 ───────────────────────────
 * Assigning a position moved off the Organization pane and onto the member's own row, so the
 * roster needs two things it never did: each member's current offices (a column, and the
 * dialog's list) and the family's catalogue of positions (the dialog's picker).
 *
 * ── EVERY FIELD IS GATED, AND NOT ALL BY THE SAME GRANT ────────────────────────────
 * `positions` and `holders` ride on `admin/members/board-positions:view` — without it there is
 * no Position column at all, which is the correct answer for a caller who may see the roster
 * and not the family's offices. `regions` and `chapters` ride on `:edit`, because they exist
 * only to fill the assignment picker; a view-only caller has no use for them (§5).
 *
 * `null` means the whole thing was never fetched — no grant, or the tier does not include it.
 */
export interface MemberBoardData {
  /** Every office the family keeps, for the dialog's picker. */
  positions: BoardPosition[]
  /** Every assignment in the family. Each row filters it on its own `person_id`. */
  holders: BoardPositionHolder[]
  /** Empty unless `mayAssign` — see above. */
  regions: { id: string; name: string }[]
  chapters: { id: string; name: string }[]
  /** `admin/members/board-positions:edit`. False makes the dialog a read-only list. */
  mayAssign: boolean
}

interface Props {
  templates: TemplateSummary[]
  resources: ResourceSummary[]
  tab: AccessTab
  selectedTemplateId: string | null
  policy: PolicyMap
  /** What the caller may do on `admin/users` — the roster, and re-templating someone. */
  memberRights: Rights
  /** What the caller may do on `admin/users/templates` — the grids themselves. */
  templateRights: Rights
  legacy: boolean
  /**
   * The queue, and ONLY when `tab` is 'approvals'. Whether the tab exists is
   * `canViewApprovals`, deliberately a separate prop: tying the tab's presence to the
   * data would make it disappear whenever another tab was open, and sending the data
   * on every tab would publish the queue to the browser for someone who never opened
   * it (AGENTS.md §5).
   */
  approvals: ApprovalsData | null
  /**
   * The family's regions and chapters, and ONLY when `tab` is 'organization'. Same
   * split as `approvals` and for the same two reasons: whether the tab exists is
   * `canViewOrganization`, and sending the data on every tab would publish the
   * family's whole geography to the browser for somebody who never opened it (§5).
   */
  organization: OrganizationData | null
  /**
   * Board positions for the MEMBERS pane, and only when that tab is open — same split as
   * `approvals` and `organization`, for the same two reasons. `null` where the caller holds no
   * board grant, which renders no Position column and no Position item in the row menu.
   */
  board: MemberBoardData | null
  /** Whether the caller may view `admin/approvals` — drives the tab. */
  canViewApprovals: boolean
  /**
   * Whether the caller may view `admin/users` itself — the Members tab. False for
   * someone who reached this page on their Member Approvals or Permission Templates
   * grant alone.
   */
  canViewAccess: boolean
  /** Whether the caller may view `admin/users/templates` — drives the templates tab. */
  canViewTemplates: boolean
  /**
   * Whether the caller may view `admin/chapters` AND the family's plan includes it —
   * drives the Organization tab. It is BOTH, resolved on the page, and it must stay
   * both: `/admin/members/organization` is `tier: 'plus'` while this page is Free, so a grant check
   * alone would light this pane up for a Free family. Nothing here can check a tier, and
   * nothing here should try to.
   */
  canViewOrganization: boolean
  /**
   * Whether to offer Invite Member at all — resolved by the page as
   * `admin/users:create` OR `admin/approvals:edit` at scope 'any'.
   *
   * A SEPARATE PROP RATHER THAN `memberRights.create`, since 2026-08-13, and it is the
   * union for a reason: the button now sits on the rail, which every tab shares, so
   * tying it to the Members grant alone would have TAKEN it away from an approvals
   * administrator who has no roster grant — the one person on this screen whose whole
   * job is deciding who is in the family. Either grant is a caller who may invite from
   * an administration screen; the database decides what the invitation is worth.
   */
  canInvite: boolean
}

export function AdminAccessClient({
  templates, resources, tab, selectedTemplateId, policy, memberRights, templateRights,
  legacy, approvals, organization, board, canViewApprovals, canViewAccess, canViewTemplates,
  canViewOrganization, canInvite,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState('')

  function go(next: { tab?: AccessTab; template?: string | null }) {
    const t = next.tab ?? tab
    const template = next.template === undefined ? selectedTemplateId : next.template
    const params = new URLSearchParams()
    if (t !== 'members') params.set('tab', t)
    if (t === 'templates' && template) params.set('template', template)
    const qs = params.toString()
    router.push(qs ? `/admin/members?${qs}` : '/admin/members')
  }

  // Built from what the caller may actually see, so a visible tab always leads
  // somewhere they can go. Every entry is conditional and each reads its OWN key —
  // four grants, four tabs, any combination of which is a legitimate caller. Order is
  // Members → Organization → Pending Approval → Permission Templates regardless of which of
  // them survive, so a caller holding two of the four sees them in the same relative order
  // as a caller holding all four.
  //
  // ORGANIZATION SITS SECOND, since 2026-08-19, and it was last until then. The argument for
  // last was that the other three are about PEOPLE — who is here, who wants in, what each
  // may do — while this one is about the family's SHAPE, so it should not split them. The
  // argument that won is that shape is what the other three are READ AGAINST: the Members
  // table's Region and Chapter columns are this tab's rows, so an administrator setting a
  // family up does Members, then its shape, and only then works the queue and the grids —
  // which are both ongoing jobs rather than setup. Pending Approval and Permission Templates
  // stay adjacent either way, which is the pairing that actually matters.
  //
  // `Network` and not the `ShieldCheck` the old rail item carried: that icon is the
  // "this template can administer" marker three times over on the Permission Templates
  // pane, and the same glyph meaning two things on one screen is worse than a new one.
  const tabs: MainRailItem<AccessTab>[] = [
    ...(canViewAccess ? [
      { id: 'members' as const, label: 'Members', icon: Users, href: '/admin/members' },
    ] : []),
    ...(canViewOrganization ? [{
      id: 'organization' as const,
      label: 'Organization',
      icon: Network,
      // THE SAME URL `/admin/members/organization` REDIRECTS TO, and the caption is the same word the
      // permission grid prints for `admin/chapters` — AGENTS.md: the grid caption is the
      // rail caption, which is the whole point of "one rail item, one permission
      // resource". The KEY did not move with the label; see the redirect page.
      href: '/admin/members?tab=organization',
    }] : []),
    ...(canViewApprovals ? [{
      id: 'approvals' as const,
      label: 'Pending Approval',
      icon: Clock,
      href: '/admin/members?tab=approvals',
    }] : []),
    ...(canViewTemplates ? [{
      id: 'templates' as const,
      label: 'Permission Templates',
      icon: KeyRound,
      href: '/admin/members?tab=templates',
    }] : []),
  ]

  return (
    <div className="space-y-5">
      {legacy && (
        <div className="rounded-xl border border-brand-legacy/50 bg-brand-soft px-4 py-3 text-sm text-brand-on-soft">
          <span className="font-medium">Permission tables not found.</span> Run the migrations in
          {' '}<code>supabase/migrations</code>. Until then access falls back to the old
          {' '}<code>is_admin</code> flag and nothing changed here takes effect.
        </div>
      )}

      {/* Per TAB, not per page: read-only on the roster and read-only on the grids are
          different facts, and a caller can hold one and not the other. Suppressed
          entirely on Pending Approval, which is neither — telling somebody reviewing
          applicants that they cannot change access settings is a non sequitur. */}
      {tab === 'members' && canViewAccess && !memberRights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view the member list but not change who is on which template.
        </div>
      )}
      {tab === 'templates' && canViewTemplates && !templateRights.edit && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can view what each template grants but not change it.
        </div>
      )}
      {/* Organization's own version, and it is NOT a fourth copy of the sentence above — this
          pane has SIX separate write grants across its two keys and a caller can hold any
          subset, so "read-only" here means holding none of the six. Saying it once at the top
          is the alternative to a disabled control on every row with no explanation beside it,
          which is what the pane would otherwise be.

          SIX AND NOT THREE SINCE 2026-08-20, when Board Positions became the pane's second
          half. Testing only the three geography grants would print "you can see how the family
          is organized but not change it" over a board roster the caller can fully edit — which
          is worse than no notice, because it is a false statement about what the controls in
          front of them do. The grants a caller does not HOLD the view for are false anyway, so
          a board-less caller is judged on the geography three and vice versa. */}
      {tab === 'organization' && organization
        && !organization.mayCreate && !organization.mayEdit && !organization.mayDelete
        && !organization.mayCreateBoard && !organization.mayEditBoard
        && !organization.mayDeleteBoard && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You can see how the family is organized but not change it.
        </div>
      )}

      <FormError message={error} />

      {/* INVITE MEMBER SITS ON THE RAIL FOR ALL THREE TABS, since 2026-08-13, and this is
          a deliberate departure from MainRail's "the active pane's one action" (AGENTS.md,
          "The main rail is a standard component").

          The rule assumes each pane has a DIFFERENT action, and here all three want the
          same one: adding somebody to the family is the job this whole screen is about,
          and it was previously offered twice — once on the Members rail and once inside
          the Pending Approval pane — so the same button appeared in two places at two
          sizes depending on which tab you were on. One button that does not move is
          easier to find than two that take turns. The pane copy is now gone; this is the
          only Invite Member on the page.

          `canInvite` is the union of the two grants that can mean it — see the prop.

          `preApproved` — the invitee is admitted the moment they accept, because the
          person inviting from an administration screen is the person who would have
          approved them a moment later. It is a REQUEST, not an instruction:
          `create_family_invitation` honours it only for a caller holding
          admin/approvals:edit at scope 'any' and silently downgrades otherwise, so a
          roster administrator without the approvals grant sends an ordinary invitation
          and the dialog reports what actually happened. */}
      <MainRail
        label="Members and access"
        items={tabs}
        active={tab}
        onSelect={t => go({ tab: t })}
        action={canInvite ? <InviteMemberDialog preApproved /> : undefined}
      />

      {tab === 'approvals' && approvals && (
        <AdminApprovalsClient
          pending={approvals.pending}
          decided={approvals.decided}
          canDecide={approvals.canDecide}
          invitations={approvals.invitations}
        />
      )}

      {tab === 'members' && (
        <MembersTab templates={templates} rights={memberRights} board={board} onError={setError} />
      )}

      {/* ── Organization ──
          `AdminRegionsChaptersClient` is rendered UNCHANGED, exactly as /admin/chapters
          rendered it. That is deliberate and it is what makes this a move rather than a
          rewrite: the component already owes nothing to its route — it takes its data and
          its three write grants as props, keeps its own `useServerState` so a freshly added
          region survives the refresh, and its actions still `requireScope` on the same key
          they always did. Nothing about it knows or cares that it is a pane now.

          The explanatory paragraph that used to sit above it on its own page went with the
          page and is restated here, because without it the two tables arrive with no
          statement of what National is — the one thing about this screen nobody guesses
          correctly.

          AND THERE IS NO HEADING ABOVE IT, deliberately. `AdminRegionsChaptersClient`
          already renders its own two `<h2>`s ("Regions", "Chapters"), and this file cannot
          demote them — so a third `<h2>` here would sit BESIDE the two it means to contain
          and the document outline would read as three peers rather than a section with two
          parts. The rail item is the pane's name, which is the convention the other three
          panes already follow: AdminApprovalsClient has no pane-level heading either, only
          `<h2>`s for its sections. */}
      {tab === 'organization' && organization && (
        <div className="space-y-8">
          {/* ── THE GEOGRAPHY HALF ────────────────────────────────────────────
              Rendered only under `admin/chapters`, which is what `showGeography` carries. A
              caller who holds only the board roster gets the section below and nothing here —
              not an empty Regions table, which would be a statement about a family's shape
              made by a screen that was told not to show it. */}
          {organization.showGeography && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  How the family divides itself up geographically. A chapter belongs to one
                  region, or it sits under National — which is where everything starts and
                  where a member with no chapter stays. Dues can be scoped to a region or a
                  chapter under <Link href="/admin/accounting?section=dues">Accounting</Link>.
                </p>
                {/* A SECOND PLACED HELP LINK ON THIS SCREEN, and the bar for one is the same
                    as the Permission Templates icon's: a control where a reader can be
                    confidently wrong. National is that control — the absence of a region
                    rather than a row, what a member with no chapter is under, and since
                    20260817000008 what a nationally scoped due bills.

                    It also patches a real gap the move opened. The top bar's question mark
                    resolves `usePathname()` against the chapter routes, so on `/admin/members`
                    it lands on the Members chapter whichever pane is open — and the chapter
                    that documents THIS half still carries `route: '/admin/members/organization'`, a route
                    that is now a redirect nobody navigates to. This link is the only thing on
                    the screen pointing at the chapter that describes it, which is why it is
                    the `inline` variant: there is no heading for an icon to sit beside, and a
                    bare question mark under a paragraph names nothing. */}
                <HelpLink
                  slug="regions-and-chapters"
                  section="what-it-is"
                  label="Regions, chapters and National"
                  variant="inline"
                />
              </div>
              <AdminRegionsChaptersClient
                initialRegions={organization.regions}
                initialChapters={organization.chapters}
                usage={organization.usage}
                mayCreate={organization.mayCreate}
                mayEdit={organization.mayEdit}
                mayDelete={organization.mayDelete}
              />
            </div>
          )}

          {/* ── AND THE OFFICES ───────────────────────────────────────────────
              `AdminBoardPositionsClient` is rendered UNCHANGED, exactly as
              /admin/boardpositions rendered it — the same thing that made Regions & Chapters
              a move rather than a rewrite. It takes its data and its three write grants as
              props, keeps its own `useServerState` so a freshly added position survives the
              refresh, and its actions still `requireScope` on the same key they always did.
              Nothing about it knows it is a pane now.

              THE `<h1>` FROM ITS OLD PAGE IS NOT RESTATED AS AN `<h2>` HERE, for the reason
              the note on the geography half gives: that component renders its own headings
              and this file cannot demote them, so a heading here would sit BESIDE the ones it
              means to contain. What is restated is the one sentence its page carried that the
              component does not — what a board position IS — because arriving at two tables
              of offices with no statement of what the scope column means is the same gap the
              geography half fills with its National paragraph.

              A DIVIDER WHEN BOTH HALVES SHOW, and none when only this one does. Two sections
              of a pane need something between them; a lone section with a rule above it reads
              as the bottom of something that was cut off. */}
          {organization.showBoard && (
            <div className={cn('space-y-6', organization.showGeography && 'border-t pt-8')}>
              <p className="text-sm text-muted-foreground">
                The offices your family keeps. A <strong>Regional</strong> or{' '}
                <strong>Chapter</strong> position is held for one region or one chapter — which
                one is chosen when it is given to somebody — and the same title can exist once
                at each scope. <strong>Who holds what is set on the Members tab</strong>, from
                the member’s own row.
              </p>
              <AdminBoardPositionsClient
                initialPositions={organization.positions}
                mayCreate={organization.mayCreateBoard}
                mayEdit={organization.mayEditBoard}
                mayDelete={organization.mayDeleteBoard}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'templates' && (
        <TemplatesTab
          templates={templates}
          resources={resources}
          selectedTemplateId={selectedTemplateId}
          policy={policy}
          rights={templateRights}
          onError={setError}
          onSelect={id => go({ tab: 'templates', template: id })}
        />
      )}
    </div>
  )
}

// ── Members ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string } | null> = {
  approved: null,
  pending:  { label: 'Awaiting approval', className: 'bg-brand-legacy text-brand-on-legacy' },
  disabled: { label: 'Disabled',          className: 'bg-destructive/10 text-destructive' },
  rejected: { label: 'Declined',          className: 'bg-muted text-muted-foreground' },
}

/**
 * The same four statuses in words, for the detail dialog's `<dl>`.
 *
 * Beside `STATUS_BADGE` deliberately, because a fifth `membership_status` has to be added
 * to BOTH or the dialog prints a raw enum on the one screen whose job is access —
 * `'disabled'` arrived in 20260807000000 and this is the shape that makes the next one
 * visible rather than silent.
 *
 * `approved` has a word here where the badge is deliberately null: a pill saying "Approved"
 * on almost every row of a table is noise, while a blank line in a panel of labelled facts
 * reads as something the product failed to look up. Different jobs, different answers.
 */
const STATUS_WORDS: Record<string, string> = {
  approved: 'Approved',
  pending:  'Awaiting approval',
  disabled: 'Disabled — no access to this family',
  rejected: 'Declined',
}

function MembersTab({ templates, rights, board, onError }: {
  templates: TemplateSummary[]
  rights: Rights
  /** Board positions, or null where the caller holds no board grant — see `MemberBoardData`. */
  board: MemberBoardData | null
  onError: (m: string) => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const { query, setQuery, page, setPage, data, isPending: loading, reload } =
    usePagedMembers(({ query, offset }) => searchMembers({ query, offset }))
  /**
   * Which member's detail dialog is open, held as a person id rather than as the row.
   *
   * The row is looked up out of `data.rows` on every render, so a reload — which every
   * mutation on this tab triggers — is what the open dialog shows rather than a frozen
   * copy of the row as it was when the dialog opened. It also self-closes: re-templating
   * somebody and then paging away leaves no row to find, and the dialog goes with it
   * instead of describing a member who is no longer on screen.
   *
   * It lives HERE rather than on the row, because one dialog per table is one dialog; one
   * per row is fifty modals in the DOM waiting their turn.
   */
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewed = data.rows.find(r => r.personId === viewingId) ?? null

  // WHICH MEMBER THE EDIT PANEL IS OPEN ON. Held as an ID rather than as a row, and
  // deliberately not derived from `data.rows` the way `viewed` is: the edit dialog fetches
  // its own record and must survive the roster underneath it changing — a save calls
  // `reload()`, and a row looked up by identity would go momentarily undefined and unmount
  // the panel mid-transition.
  const [editingId, setEditingId] = useState<string | null>(null)

  // WHICH MEMBER'S POSITIONS ARE OPEN. Held as a row rather than an id, unlike `editingId`
  // above, and the difference is which way the staleness cuts: the position dialog needs the
  // member's NAME for its title and its confirmations, and every write in it ends in
  // `router.refresh()` rather than `reload()` — so the row it was opened with is still the
  // right row, while a lookup would go undefined for a frame as the refreshed page arrives.
  const [positionFor, setPositionFor] = useState<MemberSummary | null>(null)

  async function run(
    options: ConfirmOptions,
    action: () => Promise<{ success: boolean; message?: string }>,
  ) {
    if (!(await confirm(options))) return
    onError('')
    startTransition(async () => {
      const r = await action()
      if (r.success) { reload(); router.refresh() }
      else onError(r.message ?? 'Something went wrong.')
    })
  }

  return (
    <div className="space-y-3">
      <MemberSearchBox value={query} onChange={setQuery} pending={loading}
        placeholder="Filter members by name or email…" />

      {data.rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {query ? 'No members match that filter.' : 'No members with accounts in this family yet.'}
        </p>
      ) : (
        <MemberTable rows={data.rows} templates={templates} rights={rights} board={board}
          busy={isPending} run={run} onView={setViewingId}
          onPosition={setPositionFor} />
      )}

      <Pager page={page} total={data.total} onPage={setPage} />

      {/* ── One member, in full ──
          The SAME component the Member Directory opens, so one person's record reads
          identically on the two screens that list them — which is the rule "A table is a
          table" states about the columns and applies just as much to what left them.

          `extra` is what only this screen knows: the permission template, and whether
          their access is switched off. The searched-by fields — name, email — are in
          there already, and the filter box above still matches on email even though it
          is no longer a column, which is why nothing about the search changed. */}
      <MemberDetailsDialog
        member={viewed ? accessDetails(viewed) : null}
        onClose={() => setViewingId(null)}
        // ── THE HANDOFF: ONE PANEL CLOSES, THE OTHER OPENS ─────────────────────
        // Offered only where the caller holds `admin/members:edit`, which the PAGE
        // resolved and passed down as `rights.edit`. This is the UI following that
        // decision and not the gate — `getMemberProfileForEdit` and `updateUserProfile`
        // each resolve the grant themselves, because a `'use server'` export has a URL
        // whether or not a button exists (AGENTS.md §2).
        //
        // Both state writes happen here rather than being split across the two dialogs,
        // so the order cannot be got wrong: the id is captured BEFORE the detail dialog
        // is closed, since closing it clears the value being captured. The Member
        // Directory passes no `onEdit` at all and so renders the read-only version of
        // the same component.
        onEdit={rights.edit && viewed
          ? () => { setEditingId(viewed.personId); setViewingId(null) }
          : undefined}
      />

      {/* MOUNTED ONLY WHILE OPEN, AND KEYED ON THE MEMBER. The key is what discards the
          previous member's fetched record, form values, error and reset notice — the same
          mechanism AGENTS.md uses at `<main key={familyCode}>`, and the reason that dialog
          needs no reset logic of its own. Without it, a second member opened after a first
          would render the first one's form under the second one's name. */}
      {/* MOUNTED ONLY WHILE OPEN AND KEYED ON THE MEMBER, for `MemberProfileEditDialog`'s
          reason: the key is what discards the previous member's picker state when a second
          row's Position is opened. Rendered only where the caller has a board grant at all —
          `board` is null otherwise, and the row menu offers no Position item either. */}
      {positionFor && board && (
        <MemberPositionDialog
          key={positionFor.personId}
          personName={positionFor.name}
          personId={positionFor.personId}
          positions={board.positions}
          // THIS MEMBER'S holdings, filtered here rather than in the dialog: one place decides
          // whose assignments are shown, and the same `person_id` match feeds the Position
          // column on the row.
          holders={board.holders.filter(h => h.person_id === positionFor.personId)}
          regions={board.regions}
          chapters={board.chapters}
          mayAssign={board.mayAssign}
          onClose={() => setPositionFor(null)}
        />
      )}

      {editingId && (
      <MemberProfileEditDialog
        key={editingId}
        peopleId={editingId}
        onClose={() => setEditingId(null)}
        // `reload()` and not `router.refresh()`: the roster is client-fetched and paged
        // (usePagedMembers), so a refresh would re-render the shell around a list that
        // still holds the old name. `run()` above does both for the row actions because
        // those change a member's ACCESS, which the shell reads; a profile edit does not.
        onSaved={reload}
      />
      )}
    </div>
  )
}

/**
 * One `MemberSummary`, as the shared dialog wants it.
 *
 * The status is spelled out in words rather than passed as the raw enum: `STATUS_BADGE`
 * colours a pill on the row, and a `<dd>` reading "disabled" in body text would be the
 * same fact stripped of the one thing that made it legible. "Approved" is stated too
 * rather than left blank — a member whose access is fine is a fact worth confirming on
 * the screen whose whole job is access.
 */
function accessDetails(member: MemberSummary): MemberDetails {
  return {
    name: member.name,
    phone: member.phone,
    email: member.email,
    location: member.location,
    chapterName: member.chapterName,
    regionName: member.regionName,
    extra: [
      // "Group" and not "Permission template": it is the caption this table's own column
      // prints and the word the Member Directory prints, and an administrator should not
      // have to translate between a column and the dialog behind it.
      { label: 'Group', value: member.templateName ?? 'No template' },
      { label: 'Status', value: STATUS_WORDS[member.status] ?? member.status },
    ],
  }
}

/**
 * The members table.
 *
 * A real <table>, not a flex list dressed as one: these are parallel facts about each
 * member, and a table is the element that says so — a screen reader announces the column
 * when it reads the cell, which is the whole difference between "Eastern" and "Region:
 * Eastern".
 *
 * ── FOUR COLUMNS SINCE 2026-08-19, AND THREE OF THE OLD SIX ARE A DIALOG ────────────
 * Name · Region · Chapter · Group · (row menu). Phone, Email and City/State left the
 * table and moved into `MemberDetailsDialog`, which the name cell opens.
 *
 * The reason is what a COLUMN is for: comparing one fact down a list of a hundred and
 * forty people. Nobody has ever compared phone numbers down this list — they find one
 * person and then want that person's number, which is a dialog — whereas *which region
 * and chapter is this member in* is exactly a down-the-column question, and since
 * 20260817000008 it is the question that decides who owes a regional or chapter due.
 *
 * NOTHING WAS RE-GATED. `searchMembers` fetches exactly what it fetched before, under the
 * same `admin/users:view`; the same grant that showed a phone number in a cell shows it
 * in the dialog. A dialog is not a privacy boundary — see the dialog's own header.
 *
 * ── BELOW `sm` THE MIDDLE THREE FOLD AWAY ──────────────────────────────────────────
 * Restated under the name, leaving Name and the row menu. This used to be a
 * `min-w-[52rem]` table scrolling inside its own container — the note here said the
 * alternative was maintaining two renderings of the row, and it is not: the cells are the
 * same cells, hidden by a media query, with a small block beside them that only renders
 * where they do not. Sideways scrolling cost more than the duplication would have. It hid
 * the row menu, which is the entire point of this table, behind a drag; and the header row
 * scrolled away with the columns it named.
 *
 * Member Directory renders the same four and folds the same three, so the two lists still
 * match column for column at every width.
 */
function MemberTable({ rows, templates, rights, board, busy, run, onView, onPosition }: {
  rows: MemberSummary[]
  templates: TemplateSummary[]
  rights: Rights
  board: MemberBoardData | null
  busy: boolean
  run: (o: ConfirmOptions, a: () => Promise<{ success: boolean; message?: string }>) => void
  onView: (personId: string) => void
  onPosition: (member: MemberSummary) => void
}) {
  // ── THE SAME FOUR SORTABLE COLUMNS THE DIRECTORY HAS ─────────────────────────────
  // AGENTS.md, "A table is a table": these two screens list the same people and answer the same
  // question, so a column added to one is owed to the other — and that now covers SORTING as
  // well as which columns exist. Same keys, same extractors, same fallbacks.
  //
  // Name sorts on LAST name rather than on the rendered "Marcus Allen", which would order the
  // family by first name. Position, Chapter and Group are em-dashes for most of a family, and
  // `lib/sort-rows.ts` puts blanks last in BOTH directions — so sorting descending by Position
  // shows the officers, not the ninety people who hold none.
  //
  // POSITION SORTS THROUGH THE SAME LOOKUP THE CELL RENDERS FROM, which is `board.holders`
  // filtered on the person — not a field on the row, because there is not one: `MemberSummary`
  // carries no title and this screen composes it in the browser from a `BoardPositionHolder`
  // (AGENTS.md says so where it explains why `formatBoardTitle` had to be extracted). Sorting
  // on anything else would order the column by something other than what it shows.
  //
  // A member holding two offices sorts on the FIRST, which is the one the cell shows first.
  // `?? null` and not `?? ''` so `lib/sort-rows.ts` sees an absence rather than a value —
  // `isBlank` treats both alike, and null is the honest one.
  const { rows: sorted, sortProps } = useTableSort(rows, {
    name: m => m.name,
    position: m => board?.holders.find(h => h.person_id === m.personId)?.position_name ?? null,
    chapter: m => m.chapterName,
    group: m => m.templateName,
  }, 'name')

  // `overflow-visible`, not the `overflow-x-auto` that was here: an ancestor with
  // `overflow-x: auto` computes its `overflow-y` to `auto` as well, which is what forced
  // RowMenu to portal its panel to the body in the first place. With the scroll gone
  // there is nothing left to clip, and nothing here should acquire a new clipping
  // ancestor.
  return (
    <div className="overflow-visible rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SortTh label="Name" {...sortProps('name')} className="px-3 py-2 font-semibold" />
            {/* ── POSITION REPLACED REGION ON 2026-08-20 ──────────────────────────────
                Region was DERIVED from the member's chapter (`people.chapter_id ->
                chapters.region_id`), so the two columns beside each other answered one
                question twice: a member in the Austin chapter is in the Texas region by
                construction, and nobody ever compared the two down the list. The region is
                still on the row's detail dialog, where a single record is read in full.

                What replaced it is the fact that had nowhere to live. Board positions are
                assigned from this table now, and a column is what makes "who are our officers"
                a question you can answer by scanning rather than by opening twelve dialogs.

                ABSENT ENTIRELY without the board grant — not blank. `board === null` means the
                caller may see the roster and not the family's offices, and a headed column of
                em-dashes would tell them the family has no officers. */}
            {board && (
              <SortTh label="Position" {...sortProps('position')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
            )}
            <SortTh label="Chapter" {...sortProps('chapter')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
            <SortTh label="Group" {...sortProps('group')} className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)} />
            {/* The menu column has no heading to give. An empty <th> would be announced
                as a blank column header, so the label is present and hidden. */}
            <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(member => (
            <MemberRow key={member.personId} member={member} templates={templates}
              rights={rights} board={board} busy={busy} run={run} onView={onView}
              onPosition={onPosition} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MemberRow({ member, templates, rights, board, busy, run, onView, onPosition }: {
  member: MemberSummary
  templates: TemplateSummary[]
  rights: Rights
  board: MemberBoardData | null
  busy: boolean
  run: (o: ConfirmOptions, a: () => Promise<{ success: boolean; message?: string }>) => void
  onView: (personId: string) => void
  onPosition: (member: MemberSummary) => void
}) {
  const badge = STATUS_BADGE[member.status]
  const disabled = member.status === 'disabled'

  // EVERY office this member holds, as the phrases the dialog prints — from the same
  // `formatBoardTitle`, so the column and the dialog cannot word one assignment two ways.
  // `person_id` is null on an assignment whose account is no longer in this family, and null
  // never matches a real `personId`, which is what keeps such a row off everybody's line.
  const titles = (board?.holders ?? [])
    .filter(h => h.person_id === member.personId)
    .map(h => formatBoardTitle({
      positionName: h.position_name,
      scope: h.scope,
      chapterName: h.chapter_name,
      regionName: h.region_name,
    }))

  return (
    <tr className="border-b last:border-0 align-top sm:align-middle">
      {/* Name carries the status, because that is what the badge qualifies — a
          struck-through name with the badge in another column reads as two facts. */}
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* THE NAME IS THE BUTTON, and it is the only way into the detail dialog. No
              click handler on the `<tr>`, which would be unreachable by keyboard — and on
              THIS table a row-level handler would additionally fire underneath every item
              of the row menu on its way up, opening a dialog behind a confirmation prompt
              unless every one of them remembered to stopPropagation. One target. */}
          <MemberDetailsTrigger
            name={member.name}
            onOpen={() => onView(member.personId)}
            className={cn(disabled && 'text-muted-foreground line-through')}
          />
          {badge && (
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', badge.className)}>
              {badge.label}
            </span>
          )}
        </div>
        {/* The folded columns, below sm only — stacked and LABELLED, because Region and
            Chapter are two proper nouns in a row and "Eastern · Austin" could be read
            either way round once the headings that told them apart have gone. Member
            Directory folds the identical block. Region is never omitted, because every
            member is under one; Chapter is, because plenty of members are in none.

            The template is always shown too: it is what this page is FOR, so unlike a
            missing chapter it is never dropped, and "No template" is a real answer. */}
        <RowMeta className="flex-col items-start gap-y-0.5">
          {/* POSITION WHERE REGION USED TO BE — see the table head. Every title on its own
              line rather than joined: an officer holding two is two facts, and "National
              Treasurer, Austin Chapter Chair" on one folded line is a string nobody can
              parse at 390px. Omitted entirely for a member with none, because a folded
              "Position —" is a line that says nothing. */}
          {titles.map(t => <MetaIf key={t} value={t} prefix="Position" />)}
          <MetaIf value={member.chapterName} prefix="Chapter" />
          <span className="mt-0.5 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-on-soft">
            {member.templateName ?? 'No template'}
          </span>
        </RowMeta>
      </td>
      {/* AN EM-DASH IS RIGHT HERE, unlike the Region column this replaced: Region was never
          absent (a member under no region is National, which is somewhere — 20260817000008),
          whereas most of a family holds no office at all and "no position" is the ordinary
          answer rather than a gap in the record.

          Two titles stack rather than joining with a comma, for the folded line's reason: a
          member can hold a national office and chair a chapter, and those are two facts. */}
      {board && (
        <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
          {titles.length === 0 ? '—' : (
            <span className="flex flex-col gap-0.5">
              {titles.map(t => <span key={t}>{t}</span>)}
            </span>
          )}
        </td>
      )}
      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
        {member.chapterName ?? '—'}
      </td>
      <td className={cn('px-3 py-2.5', COLLAPSING_CELL)}>
        <span className="inline-block whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-on-soft">
          {member.templateName ?? 'No template'}
        </span>
      </td>
      <td className="w-10 px-3 py-2.5 text-right">
      <RowMenu label={`Actions for ${member.name}`} disabled={!rights.edit || busy}>
        {close => (
          <>
            {/* ── TWO LABELLED SECTIONS SINCE 2026-08-20: PERMISSIONS, THEN POSITION ────
                The menu was one unheaded list of templates with the enable/disable under a
                rule, and it grew a second job when board assignment moved onto this row. Two
                headings rather than one, because "put Ada on Administrators" and "make Ada
                the Treasurer" are answers to different questions and the second is not a
                permission — a position grants nothing at all, which is exactly the confusion
                an unheaded list of both would invite.

                A `<p>` and not a `role="group"`: `RowMenu` deliberately refuses `role="menu"`
                (see its header), so claiming group semantics inside a plain disclosure would
                promise the same keyboard behaviour by a side door. A heading that is read out
                in order is what is actually here. */}
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Permissions
            </p>
            {templates.length === 0 && (
              <p className="px-3 pb-2 text-xs text-muted-foreground">No templates yet.</p>
            )}
            {templates.map(t => {
              const current = t.id === member.templateId
              return (
                <button key={t.id} type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft"
                  onClick={() => {
                    close()
                    if (current) return
                    run({
                      title: 'Apply permissions template',
                      description:
                        `Put ${member.name} on "${t.name}"? Their access becomes exactly what that ` +
                        `template grants${member.templateName ? `, replacing "${member.templateName}"` : ''}.`,
                      confirmLabel: 'Apply template',
                      destructive: !t.grantsAdmin && Boolean(member.templateId),
                    }, () => applyTemplate(member.personId, t.id))
                  }}>
                  <Check className={cn('h-3.5 w-3.5 shrink-0', current ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {t.grantsAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              )
            })}

            {/* ── Position ───────────────────────────────────────────────────────────
                Absent for a caller with no board grant — `board` is null then, and the whole
                section including its heading goes with it rather than leaving a heading over
                nothing. The item is offered under VIEW rather than edit, because the dialog is
                a useful read on its own ("what does Ada hold?") and says so; it renders its own
                controls only under `mayAssign`. */}
            {board && (
              <>
                <div className="my-1 border-t" />
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Position
                </p>
                <button type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft"
                  onClick={() => { close(); onPosition(member) }}>
                  <Network className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {titles.length === 0
                      ? 'Give a board position'
                      : titles.length === 1 ? 'Change board position' : 'Board positions'}
                  </span>
                </button>
              </>
            )}

            <div className="my-1 border-t" />

            {member.status === 'pending' ? (
              <Link href="/admin/members?tab=approvals" onClick={close}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                Review in Pending Approval
              </Link>
            ) : member.isSelf ? (
              <p className="px-3 py-1.5 text-xs text-muted-foreground">
                You cannot disable your own access.
              </p>
            ) : (
              <button type="button"
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-soft',
                  !disabled && 'text-destructive',
                )}
                onClick={() => {
                  close()
                  run(disabled ? {
                    title: 'Enable member',
                    description: `Switch ${member.name}'s access back on? They regain everything their template grants.`,
                    confirmLabel: 'Enable',
                  } : {
                    title: 'Disable member',
                    description:
                      `Switch off ${member.name}'s access? They keep their account and their profile, ` +
                      'but can see nothing in this family until you switch it back on.',
                    confirmLabel: 'Disable',
                    destructive: true,
                  }, () => setMemberEnabled(member.personId, disabled))
                }}>
                {disabled
                  ? <><UserCheck className="h-3.5 w-3.5 shrink-0" /> Enable member</>
                  : <><Ban className="h-3.5 w-3.5 shrink-0" /> Disable member</>}
              </button>
            )}
          </>
        )}
      </RowMenu>
      </td>
    </tr>
  )
}

/**
 * The row overflow menu.
 *
 * Hand-rolled rather than pulled from a library because the project's ui/ primitives
 * are plain elements and one more dependency for a popover is not worth it. What it
 * still owes: closing on outside click and on Escape, and returning focus to the
 * trigger, or a keyboard user is stranded inside it.
 *
 * A DISCLOSURE, NOT AN ARIA MENU, deliberately. `role="menu"` is a promise about
 * keyboard behaviour — arrow keys move a roving focus between items, Home/End jump to
 * the ends, Tab leaves the whole widget — and a screen reader announces it as such and
 * changes its own key handling to match. This implements none of that, so claiming the
 * role would leave those users pressing arrow keys at something that does not respond.
 * As a plain expanding panel of buttons and links, Tab works, which is true of what is
 * actually here.
 *
 * THE PANEL IS PORTALLED TO document.body, and that is not decoration. The members table
 * scrolls horizontally inside its own container, and a container with `overflow-x: auto`
 * has `overflow-y: visible` computed to `auto` — so an absolutely positioned panel inside
 * it is clipped at the row, which is how this menu became unusable the moment the list
 * became a table. Rendering into the body with `position: fixed`, anchored to the
 * trigger's measured rect, takes it out of every ancestor's overflow.
 */
function RowMenu({ label, disabled, children }: {
  label: string
  disabled?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Measured on open rather than tracked continuously: the panel closes on the first
  // scroll or resize (below), so a stale rect can never be shown.
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null)
  const panelId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // Ref-free on purpose. `children` is a render prop, so anything handed to it is
  // traced into the render pass — a close() that read trigger.current would count as
  // dereferencing a ref during render. Returning focus to the trigger therefore lives
  // in the Escape handler below, inside an effect, where reading a ref is fine.
  //
  // Nothing is lost on the activation path: every item here opens a confirmation
  // dialog, which takes focus itself and owns restoring it.
  const close = useCallback(() => setOpen(false), [])

  // Closes itself a few seconds after the pointer and focus have both left it — the same
  // hook the three header panels use, so every dropdown in the app goes on the same beat.
  // `parts` looks the portalled panel up by id for the reason the outside-click handler
  // below does: it is not inside `wrap`, so there is no single subtree to test.
  useDismissWhenIdle({
    open,
    close,
    parts: () => [wrap.current, document.getElementById(panelId)],
  })

  useEffect(() => {
    if (!open) return
    // The panel lives outside `wrap` now, so an outside-click test against `wrap` alone
    // would treat every click INSIDE the panel as outside and close it before the button
    // fired. Both subtrees count as inside.
    function onPointer(e: MouseEvent) {
      const target = e.target as Node
      if (wrap.current?.contains(target)) return
      if (document.getElementById(panelId)?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    // A fixed panel does not travel with the page. Closing is the honest response to
    // either — cheaper than re-measuring on every frame, and it is what a menu whose
    // anchor has moved should do anyway. Capture, so a scroll inside the table's own
    // overflow container counts and not just one on the window.
    function onMove() { setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, panelId])

  function toggle() {
    if (open) { setOpen(false); return }
    const r = trigger.current?.getBoundingClientRect()
    // Right-aligned to the trigger, which is what the absolute version did with
    // `right-0`. Kept in viewport coordinates because the panel is position: fixed.
    if (r) setRect({ top: r.bottom + 4, right: window.innerWidth - r.right })
    setOpen(true)
  }

  const expanded: 'true' | 'false' = open ? 'true' : 'false'

  return (
    <div ref={wrap} className="relative shrink-0">
      <button ref={trigger} type="button" disabled={disabled}
        onClick={toggle}
        aria-expanded={expanded} aria-controls={panelId} aria-label={label}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && rect && createPortal(
        <div id={panelId} aria-label={label}
          style={{ top: rect.top, right: rect.right }}
          className="fixed z-50 w-64 overflow-hidden rounded-xl border bg-card py-1 shadow-lg">
          {children(close)}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Templates ───────────────────────────────────────────────────────────────

/**
 * What a closed feature row says it currently grants — "View All · Edit Own", or the honest
 * empty version.
 *
 * ── IT IS WHAT MAKES COLLAPSING THE GRID SAFE ──────────────────────────────────────
 * Every switch used to be on screen at once. Hiding them behind a disclosure is only an
 * improvement if the closed row still answers "what does this template grant here" — without
 * that an administrator would have to open all forty features to read a template, which is
 * strictly worse than the wall it replaced.
 *
 * ONLY WHAT IS ACTUALLY GRANTED IS NAMED. A resource declares only the actions something reads
 * (AGENTS.md), and most declare one or two of the four — so listing every action with a dash
 * beside the absent ones would put three pieces of nothing on almost every row. `'none'` is
 * likewise omitted rather than printed: the interesting fact is what a template CAN do.
 *
 * "Nothing" IS SAID OUT LOUD rather than left blank, because a blank row reads as a row whose
 * summary failed to load. A new template is a complete grid of denials, so this is the state
 * every row is in for the minute after one is created.
 */
function grantSummary(resource: ResourceSummary, policy: PolicyMap): string {
  const granted = ACTIONS
    .filter(action => scopesFor(resource, action).length > 0)
    .map(action => ({ action, scope: policy[`${resource.key}:${action}`] ?? 'none' }))
    .filter(({ scope }) => scope !== 'none')

  if (granted.length === 0) return 'Nothing'
  return granted
    // Capitalised action, then the scope's own word — "View All", "Edit Own". `create` has no
    // own/any distinction (`SCOPES_FOR`), so its granted state reads "Create All", which is the
    // same word the switch itself carries: two vocabularies for one control would be worse.
    .map(({ action, scope }) =>
      `${action[0].toUpperCase()}${action.slice(1)} ${SCOPE_LABEL[scope]}`)
    .join(' · ')
}

function TemplatesTab({
  templates, resources, selectedTemplateId, policy, rights, onError, onSelect,
}: {
  templates: TemplateSummary[]
  resources: ResourceSummary[]
  selectedTemplateId: string | null
  policy: PolicyMap
  rights: Rights
  onError: (m: string) => void
  onSelect: (id: string) => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  /**
   * Which template the new one starts from, or '' for a blank grid.
   *
   * Offered only to a caller who also holds `edit` on this key, because that is what
   * the action demands of a copy — see createTemplate. Showing the choice to someone
   * who may only create would be a control that refuses every time it is used.
   */
  const [copyFrom, setCopyFrom] = useState('')
  /**
   * Resolved against the LIVE list rather than trusted as held, so every control below
   * reads from one value. Deleting the template the form is pointing at is the case
   * that matters: a `router.refresh()` deliberately merges the new server payload
   * without discarding client state, so `copyFrom` would go on naming a row that no
   * longer exists — the radio saying "A copy of…", the sentence beneath it saying
   * nothing is allowed, and Create sending an id the action can only refuse.
   */
  const copySource = templates.find(t => t.id === copyFrom) ?? null
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const selected = templates.find(t => t.id === selectedTemplateId) ?? null
  const sections = groupResources(resources)
  /**
   * Which feature's switches are showing, or null for none — an accordion, one at a time.
   *
   * Keyed on the RESOURCE KEY rather than an index, so it survives `resources` being
   * re-ordered or filtered by tier, and it is reset when the selected TEMPLATE changes:
   * leaving a feature open across that switch would show one template's grid heading over
   * another's switches for the moment before the props land.
   *
   * Genuinely UI-local state, so no `useServerState` and no key — AGENTS.md exempts exactly
   * this ("which nav section is expanded, which dialog is open"). Nothing here is seeded from
   * a family-scoped prop and nothing is written back.
   */
  const [openResource, setOpenResource] = useState<string | null>(null)
  /**
   * Which SECTION cards are unfolded — Community, Gatherings, Accounting, and the rest.
   *
   * ── EVERY CARD STARTS CLOSED, AND THE SET TRACKS OPEN SO THAT STAYS TRUE ──────────
   * An empty set is the initial state and means the whole grid is folded: five named cards,
   * each saying how many features it holds and how many this template grants, and nothing
   * else. That is the screen an administrator actually arrives at — they come here to change
   * ONE switch and they know which area it is in, so opening with forty-six features on
   * screen makes them scroll past forty-five of them.
   *
   * IT TRACKS OPEN RATHER THAN CLOSED FOR ONE REASON, and it is the reason the state was
   * flipped when the default was: whichever way round it is, an empty set has to mean the
   * DEFAULT. Storing the closed ones would make a category added by a later migration arrive
   * unfolded while every other card is shut — one card behaving differently from the rest
   * because nobody edited a list.
   *
   * WHAT PAYS FOR HIDING THINGS ON A PERMISSIONS SCREEN. A switch nobody can find is a
   * permission nobody can grant, so the fold is only admissible because the closed card is
   * not silent: it carries "6 features · 4 granted", which answers "is what I am looking for
   * in here" without opening it, and **Expand all** puts the old full-length page back in one
   * press. Same bargain the per-feature rows already make one level down, where the closed
   * row carries `grantSummary`.
   *
   * ── NOT AN ACCORDION, unlike the feature rows inside it ───────────────────────────
   * One-at-a-time is right for a FEATURE, because opening one is a step in changing it and
   * the panel below is what you are reading. It is wrong for a SECTION: comparing what
   * Community grants against what Admin grants is an ordinary thing to want, and an accordion
   * would make it impossible. So sections toggle independently.
   *
   * Genuinely UI-local state, so no `useServerState` and no key — AGENTS.md exempts exactly
   * this ("which nav section is expanded, which dialog is open"). Nothing here is seeded from
   * a family-scoped prop and nothing is written back.
   */
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(new Set())
  const [openFor, setOpenFor] = useState<string | null>(selectedTemplateId)
  if (openFor !== selectedTemplateId) {
    // Derived during render rather than in an effect: an effect runs after paint, so the
    // first frame after switching template would draw the old feature's panel over the new
    // template's grants. This is the pattern React's own docs call "adjusting state when a
    // prop changes", and it is why `openFor` exists at all.
    //
    // The SECTIONS are reset too, and back to CLOSED: a fold is a reading position rather
    // than a claim about the template, so carrying it across would not be wrong — but a
    // template arrives the same way every time, which is the property that lets somebody
    // learn where things are.
    setOpenFor(selectedTemplateId)
    setOpenResource(null)
    setOpenSections(new Set())
  }

  const allCollapsed = openSections.size === 0
  function toggleSection(category: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  // `confirmWith` is required rather than optional: every caller has to state what it
  // is asking the user, or pass an explicit null to opt out (creates only).
  async function run(
    confirmWith: ConfirmOptions | null,
    action: () => Promise<{ success: boolean; message?: string }>,
    after?: () => void,
  ) {
    if (confirmWith && !(await confirm(confirmWith))) return
    onError('')
    startTransition(async () => {
      const result = await action()
      if (result.success) { after?.(); router.refresh() }
      else onError(result.message ?? 'Something went wrong.')
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* ── Template list ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {/* THE ONE PLACED HELP LINK ON THIS SCREEN, and it is on this tab rather than on
              Members or Pending Approval because this is the tab where a reader can be
              confidently wrong. A grid of switches looks self-explanatory and is not: what
              a scope of 'own' means, why a row shows two actions and not four, and that a
              member has exactly ONE template with nothing layered over it are all facts the
              screen assumes. `members-and-access#templates` states them.

              An icon, not the inline variant: this is a column heading with a create button
              on the other end of it, and words here would out-weigh both.

              The top bar's icon already points at this chapter as a whole from every tab,
              so this is the section-level shortcut and not a duplicate of it — see
              components/help/HelpLink.tsx on why there is not one of these per pane. */}
          {/* A `div`, not a `span`: an `h2` is flow content and a `span` is phrasing, so a
              span wrapping it is invalid even though every browser renders it. */}
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Templates
            </h2>
            <HelpLink
              slug="members-and-access"
              section="templates"
              label="Help: Permission templates"
              className="size-6"
            />
          </div>
          {rights.create && (
            <button type="button" onClick={() => setCreating(c => !c)}
              className="rounded-lg p-1 hover:bg-muted" aria-label="New template">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {creating && (
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <div className="space-y-1">
              <Label htmlFor="new-template-name">Name</Label>
              <Input id="new-template-name" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Reunion Committee" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-template-desc">Description</Label>
              <Input id="new-template-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Optional" />
            </div>

            {/* A real <fieldset>/<legend> radio group rather than a styled div: the
                legend is what makes a screen reader announce "Start from" before each
                option, and native radios bring arrow-key selection with them. Same
                reasoning as MainRail refusing role="tablist" — claim only what is
                implemented, and here the platform implements all of it. */}
            {rights.edit && templates.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="text-sm leading-none font-medium">Start from</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="new-template-start" className="accent-brand-primary"
                    checked={!copySource} onChange={() => setCopyFrom('')} />
                  Blank
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="new-template-start" className="accent-brand-primary"
                    checked={!!copySource}
                    onChange={() => setCopyFrom(templates[0].id)} />
                  A copy of…
                </label>
                {copySource && (
                  <Select className="mt-1" aria-label="Template to copy"
                    value={copySource.id} onChange={e => setCopyFrom(e.target.value)}>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                )}
              </fieldset>
            )}

            <p className="text-xs text-muted-foreground">
              {copySource
                ? `The new template starts with exactly what ${copySource.name} grants today. It is a copy, not a link — changing one afterwards leaves the other alone.`
                : 'A new template starts with nothing allowed. Set what it grants, then apply it to members.'}
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending || !newName.trim()}
                onClick={() => run(null, () => createTemplate(newName, newDesc, copySource?.id ?? null),
                  () => { setNewName(''); setNewDesc(''); setCopyFrom(''); setCreating(false) })}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <ul className="space-y-1">
          {templates.map(t => (
            <li key={t.id}>
              {editingId === t.id ? (
                <div className="space-y-2 rounded-xl border bg-card p-3">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} aria-label="Template name" />
                  <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isPending}
                      onClick={() => run({
                        title: 'Save template',
                        description: editName.trim() && editName.trim() !== t.name
                          ? `Rename "${t.name}" to "${editName.trim()}" and save its description?`
                          : `Save your changes to "${t.name}"?`,
                        confirmLabel: 'Save changes',
                      }, () => renameTemplate(t.id, editName, editDesc), () => setEditingId(null))}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  t.id === selectedTemplateId
                    ? 'bg-brand-primary text-brand-on-primary'
                    : 'bg-brand-soft text-brand-on-soft hover:opacity-90',
                )}>
                  <button type="button" onClick={() => onSelect(t.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5 font-medium">
                      {t.isSystem && <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span className={cn('text-xs', t.id === selectedTemplateId ? 'opacity-70' : 'text-muted-foreground')}>
                      {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                    </span>
                  </button>
                  {rights.edit && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button type="button" aria-label={`Rename ${t.name}`} className="rounded p-1 hover:bg-foreground/10"
                        onClick={() => { setEditingId(t.id); setEditName(t.name); setEditDesc(t.description ?? '') }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!t.isSystem && rights.remove && (
                        <button type="button" aria-label={`Delete ${t.name}`} disabled={isPending}
                          className="rounded p-1 hover:bg-foreground/10" onClick={() => run({
                            title: 'Delete template',
                            description: t.memberCount > 0
                              ? `"${t.name}" still has ${t.memberCount} member${t.memberCount === 1 ? '' : 's'}. Move them to another template first.`
                              : `Delete "${t.name}"? This cannot be undone.`,
                            confirmLabel: 'Delete template',
                            destructive: true,
                          }, () => deleteTemplate(t.id))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ── The grid ─────────────────────────────────────────────────── */}
      <div className="min-w-0">
        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {selected.isSystem && <ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                {selected.name}
              </CardTitle>
              <CardDescription>
                {selected.description || 'What members on this template may do.'}
                {' '}Changes apply immediately to all {selected.memberCount} member
                {selected.memberCount === 1 ? '' : 's'} on it. Only features that have shipped
                are listed; each row says what it grants today, and opening one shows the
                actions that mean something for it.
              </CardDescription>
              {/* THE ONE CONTROL THAT MAKES "CLOSED BY DEFAULT" HONEST. Every section starts
                  folded, so an administrator who wants the whole grid — to read it end to end,
                  or to find a switch whose area they do not know — gets it back in a single
                  press rather than five. It reads the state rather than toggling a flag of its
                  own, so it is never out of step with the cards: open one by hand and it turns
                  into Collapse all. */}
              {sections.length > 1 && (
                <CardAction>
                  <button
                    type="button"
                    onClick={() => setOpenSections(
                      allCollapsed ? new Set(sections.map(s => s.category)) : new Set())}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {allCollapsed ? 'Expand all' : 'Collapse all'}
                  </button>
                </CardAction>
              )}
            </CardHeader>
            {/* ── ONE DISCLOSURE PER FEATURE, since 2026-08-19 ─────────────────────────
                It was a `<table>`: a row per feature and a column per action, every switch on
                screen at once. Three things were wrong with that on a family of any size.

                It is LONG. Forty-odd resources times four actions is a wall of a hundred and
                sixty controls, and an administrator comes here to change ONE of them.

                It could not be read narrow. The table sat in an `overflow-x-auto` box over a
                `min-w-[34rem]`, so on a phone the FEATURE column scrolled out of view and left
                four unlabelled switch groups with no indication of which row you were about to
                change — on the one screen in the app where changing the wrong row hands
                somebody authority they should not have. The fix at the time was a second,
                stacked rendering under `sm`, which meant two layouts to keep in step.

                And a column per action is a column of BLANKS. A resource declares only the
                actions something reads (AGENTS.md), so most rows have one or two of the four;
                the rest of the grid was empty cells that read as switches somebody forgot.

                So each feature is a disclosure now: its name, a summary of what it currently
                grants, and — when it is opened — the actions it actually has. One layout at
                every width, nothing folded, and the feature's name is never off screen while
                its switches are.

                AN ACCORDION, one open at a time. "Then when selected that feature's settings
                show" is the ask, and it is also what keeps the list scannable: several open at
                once and the page is the wall again, in a different shape.

                NOT A `role="tablist"`, NOT A `<details>`. It is a real `<button>` carrying
                `aria-expanded` and `aria-controls`, which is the whole of what a disclosure
                promises and all of it is implemented — the same standard `MainRail` and
                `RowMenu` refuse to claim more than. `<details>` was the obvious alternative and
                is worse here: its open state is DOM state rather than React state, so the
                accordion (close the others) would mean reaching for refs, and Safari announces
                a summary element inconsistently. */}
            <CardContent className="overflow-visible">
              {/* ── A CARD PER SECTION, EACH ONE FOLDABLE, since 2026-08-20 ──────────────
                  The sections were an `h3` over a bordered list, five of them stacked inside
                  one card. That reads as one long document with five headings in it, and the
                  headings are the only thing separating forty-six features — so an
                  administrator looking for one switch scrolls past every other area to reach
                  it. A card is what says "this is a thing on its own", and a fold is what
                  gets the other four out of the way.

                  NESTED CARDS ARE DELIBERATE AND SHALLOW. The outer card is the TEMPLATE —
                  its name, its description, and how many members it applies to — and the
                  inner ones are the areas of the product it grants. Two levels, and the inner
                  card carries `size="sm"` and no ring of its own so it reads as a panel
                  within a card rather than a second card floating on one.

                  THE DISCLOSURE IS THE HEADER, and it is a real `<button>` with
                  `aria-expanded` and `aria-controls` — the same standard the feature rows
                  inside it already meet, and for the reasons stated there: not a `<details>`,
                  whose open state is DOM state rather than React state, and not a
                  `role="tablist"`, which would promise arrow-key roving nothing implements. */}
              <div className="space-y-3">
                {sections.map(({ category, label, rows }) => {
                  const collapsed = !openSections.has(category)
                  const sectionId = `perm-section-${category.replace(/[^a-z0-9]+/gi, '-')}`
                  // WHAT THE FOLDED CARD STILL SAYS. A collapsed section that shows only its
                  // name makes the reader open all five to find where a grant lives, which is
                  // the same failure the per-feature summary line was added to prevent one
                  // level down. So the header carries how many features the area holds and how
                  // many of them this template grants anything on.
                  const grantedCount = rows.filter(({ resource }) =>
                    grantSummary(resource, policy) !== 'Nothing').length

                  return (
                    <Card key={category} size="sm" className="ring-0 border">
                      {/* `p-0` on the header and the padding moved onto the button, so the
                          whole strip is the hit target rather than the text inside it. */}
                      <CardHeader className="p-0">
                        <button
                          type="button"
                          aria-expanded={!collapsed}
                          aria-controls={sectionId}
                          onClick={() => toggleSection(category)}
                          className="flex w-full items-center gap-2 rounded-t-xl px-3 py-2 text-left hover:bg-muted/50"
                        >
                          <ChevronDown
                            aria-hidden="true"
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                              collapsed ? '-rotate-90' : 'rotate-0',
                            )}
                          />
                          {/* A real heading, not a styled div: this is a section of a form and
                              a screen reader reaching it should be told so. `h3` gets its size
                              and weight here because preflight resets them and `globals.css`
                              gives an `h3` only a colour. It is INSIDE the button, which is
                              allowed — a heading is flow content and a button may contain it —
                              and it is what puts the section into the document outline whether
                              the card is folded or not. */}
                          <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                          </h3>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {rows.length} feature{rows.length === 1 ? '' : 's'}
                            {grantedCount > 0 && ` · ${grantedCount} granted`}
                          </span>
                        </button>
                      </CardHeader>

                      {/* HIDDEN WITH `hidden`, NOT UNMOUNTED, so `aria-controls` always points
                          at an element that exists and the feature panel a reader had open
                          inside this section is still open when they unfold it. */}
                      <CardContent id={sectionId} hidden={collapsed} className="overflow-visible px-3">
                        <ul className="divide-y rounded-xl border">
                      {rows.map(({ resource: r, header, nested }) => {
                        const open = openResource === r.key
                        const panelId = `perm-panel-${r.key.replace(/[^a-z0-9]+/gi, '-')}`
                        // Every action this resource actually declares, with the scopes that
                        // mean something for it. Computed once and used three times — for the
                        // summary line, to decide whether there is anything to open, and to
                        // draw the panel — so the three cannot disagree.
                        const actionable = ACTIONS
                          .map(action => ({ action, scopes: scopesFor(r, action) }))
                          .filter(({ scopes }) => scopes.length > 0)

                        return (
                          <Fragment key={r.key}>
                            {header && (
                              <li className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                └ {header}
                              </li>
                            )}
                            <li className={cn(nested && 'pl-4')}>
                              {/* THE SUMMARY IS ON THE CLOSED ROW, and that is what makes
                                  collapsing them safe. Without it an administrator would have
                                  to open every feature to find out what a template grants,
                                  which is strictly worse than the table it replaced. */}
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-controls={panelId}
                                onClick={() => setOpenResource(open ? null : r.key)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
                              >
                                <ChevronDown
                                  aria-hidden="true"
                                  className={cn(
                                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                    open ? 'rotate-0' : '-rotate-90',
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
                                {/* `sr-only` on the wide screens' behalf as well: the same
                                    words a sighted reader sees, so nothing is announced that
                                    is not there and nothing on screen is unannounced. */}
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {grantSummary(r, policy)}
                                </span>
                              </button>

                              {/* HIDDEN WITH `hidden`, NOT UNMOUNTED, so `aria-controls` on the
                                  button always points at an element that exists — a control
                                  naming a missing id is worse than no `aria-controls` at all.
                                  The switches inside are not focusable while it is hidden,
                                  which is the property that matters. */}
                              <div id={panelId} hidden={!open} className="space-y-2 px-3 pb-3 pl-9">
                                {actionable.length === 0 ? (
                                  // A resource with no actions at all. It exists so the
                                  // feature can be REGISTERED (see AGENTS.md on why a page
                                  // needs a row even when nothing is granted per action), and
                                  // saying so is better than an empty panel.
                                  <p className="text-xs text-muted-foreground">
                                    Nothing to set here — this feature is either always
                                    available or governed by the rows above it.
                                  </p>
                                ) : actionable.map(({ action, scopes }) => {
                                  const current = policy[`${r.key}:${action}`] ?? 'none'
                                  return (
                                    <div key={action} className="flex flex-wrap items-center gap-2">
                                      {/* A `<div role="group">` with an accessible name, not a
                                          bare label beside buttons: these are three toggle
                                          buttons that act as one choice, and the group name is
                                          what tells a screen reader which feature and which
                                          verb they belong to. The visible word is `aria-hidden`
                                          so it is not announced twice. */}
                                      <span
                                        aria-hidden="true"
                                        className="w-14 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground"
                                      >
                                        {action}
                                      </span>
                                      <div
                                        role="group"
                                        aria-label={`${r.label} — who may ${action}`}
                                        className="flex gap-0.5"
                                      >
                                        {scopes.map(scope => (
                                          <button
                                            key={scope}
                                            type="button"
                                            // `aria-pressed`, which the table version did not
                                            // have: three buttons where one is "on" is a toggle
                                            // set, and a colour is not an accessible state.
                                            aria-pressed={current === scope}
                                            disabled={!rights.edit || isPending}
                                            onClick={() => run({
                                              title: 'Change what this template grants',
                                              description:
                                                `Set "${selected.name}" to ${action} ${SCOPE_LABEL[scope]}` +
                                                `${scope === 'none' ? ' (not allowed)' : ''} on ${r.label}? ` +
                                                `This applies to all ${selected.memberCount} member` +
                                                `${selected.memberCount === 1 ? '' : 's'} on the template.`,
                                              confirmLabel: 'Change',
                                              destructive: scope === 'none',
                                            }, () => setTemplatePermission(selected.id, r.key, action, scope))}
                                            title={`${r.label} · ${action} · ${SCOPE_LABEL[scope]}`}
                                            className={cn(
                                              'rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60',
                                              current === scope ? SCOPE_STYLE[scope] : 'text-muted-foreground hover:bg-muted',
                                            )}
                                          >
                                            {SCOPE_LABEL[scope]}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </li>
                          </Fragment>
                        )
                      })}
                        </ul>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                <span className="font-medium">All</span> = every record in the family ·
                {' '}<span className="font-medium">Own</span> = only records this member created or belongs to ·
                {' '}<span className="font-medium">—</span> = not allowed
              </p>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Select a template to edit what it grants.</p>
        )}
      </div>
    </div>
  )
}
