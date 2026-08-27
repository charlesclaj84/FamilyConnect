'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserPlus } from 'lucide-react'
import { COLLAPSING_CELL, MetaDot, RowMeta } from '@/components/ui/table-collapse'
import { FormError } from '@/components/ui/form-message'
import { useConfirm } from '@/components/ui/confirm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useServerState } from '@/lib/use-server-state'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { StaffRole } from '@/lib/auth/staff'
import {
  grantStaffAccess, revokeStaffAccess, setStaffRole,
  type StaffTeamRow,
} from '@/app/actions/staff/access'
import { useIntlTag, useT } from '@/components/layout/LocaleProvider'
import type { T } from '@/lib/i18n/t'

/**
 * The staff team, and the three things an owner can do to it.
 *
 * ── THE TWO IMPOSSIBLE ACTIONS ARE DISABLED WITH THEIR REASON, NOT MERELY refused(t) ──
 * This is the whole reason this screen is more than a table with two controls on it.
 * `app/actions/staff/access.ts` enforces both rules — nobody changes or revokes their own
 * row (rule 4), and the last owner cannot be demoted or revoked (rule 5) — and an action
 * that refuses is the correct place for enforcement. It is the wrong place to LEARN it.
 *
 * A control that looks available and then says "you cannot do that" teaches somebody that
 * the screen is unreliable, and on this screen the two rules are not arbitrary: they are
 * the two ways a console can be locked with nobody able to reopen it. So the row states
 * the reason in `--brand-withheld` and disables both controls, and the sentence is
 * `aria-describedby` from each of them, so the reason arrives with the control rather than
 * as unrelated text somewhere on the page.
 *
 * THE PRECEDENCE MATCHES THE ACTION'S, AND THAT IS NOT COSMETIC. `refuseSelf` is checked
 * BEFORE `ownerCount` in all three writes, so a row that is both the caller's own and the
 * last owner — which is the common shape on a young database, and the one an owner will
 * meet first — must show the self sentence here too. Two orderings would be a screen and a
 * server that disagree about which rule stopped you.
 *
 * `--brand-withheld` RATHER THAN `--destructive`, deliberately. Nothing has failed and
 * nothing has been deleted: a capability is being withheld, which is exactly the role that
 * token names, and it is a FOREGROUND with no `on-` partner (AGENTS.md, "Colours live in
 * one place"). `--destructive` in this file belongs to `FormError` and to the Revoke
 * button, which are a refused operation and a real deletion.
 *
 * ── RULE 5 IS UNREACHABLE SEQUENTIALLY AND IS RENDERED ANYWAY ──────────────────────
 * The same argument `ownerCount` makes in the action, one layer up. The caller is an owner,
 * and rule 4 already locked their own row, so an owner row that is NOT the caller's implies
 * a second owner exists — meaning `ownerTotal <= 1` can only be true of the caller's own
 * row, where the self sentence wins. Deleting the branch on those grounds would remove the
 * guard and leave the reason for the guard: the day "let an owner step down" is asked for,
 * rule 5 becomes the only thing between a tidy-up and a locked console, and this is the
 * half that has to already be on screen when it does.
 *
 * ── THE LIST IS NOT COPIED INTO CLIENT STATE ───────────────────────────────────────
 * `team` is rendered straight off the prop. All three writes call
 * `revalidatePath('/staff/access')`, so the action's own response carries a fresh render of
 * this page's segment and the prop arrives updated; `router.refresh()` after each success
 * is the belt to that braces, because the failure without it — a screen that appears to
 * ignore a grant that actually landed — is the one this table cannot afford.
 *
 * A `useState(team)` would be deaf to every one of those (which is what
 * `lib/use-server-state.ts` exists to fix), and a `useServerState(team)` would work while
 * protecting nothing: NOTHING HERE IS OPTIMISTIC, deliberately. Everywhere else in this
 * codebase an optimistic row is a kindness; here a row claiming somebody holds owner access
 * when the write was refused is the single worst thing this list can say. The one piece of
 * state seeded from the server is each row's `<Select>` value, which needs it for a reason
 * that has nothing to do with optimism — see `TeamRow`.
 *
 * ── NO PAGER, NO FILTER BOX ────────────────────────────────────────────────────────
 * Unlike Families and Accounts next door, and unlike every member roster in the product.
 * AGENTS.md's "build every member list for a hundred-member family" is a rule about a
 * FAMILY's roster — the list that grows because the product succeeds, where twelve names in
 * development hide the failure at a hundred and twenty. This list grows because GENORRA
 * hires, it is single digits by construction (`emailsFor()` in the action is one GoTrue
 * lookup per row precisely because that is right at this size), and a search box over four
 * rows is a control that does nothing. When it is wrong, the fix is a filtered page in the
 * action.
 */

/** In escalation order, so the most powerful option is the last one in the list. */
const ROLES: readonly StaffRole[] = ['support', 'engineer', 'owner']

function roleLabel(t: T): Record<StaffRole, string> {
  return {
    support: t('staff.support'),
    engineer: t('staff.engineer'),
    owner: t('staff.owner'),
  }
}

/**
 * What each role actually means, and the middle one is the honest part.
 *
 * `lib/auth/staff.ts` is explicit that `support` and `engineer` are the same thing and must
 * not be split on a guess: nothing anywhere distinguishes them, and exactly one boundary is
 * enforced in the product. A hint that invented a difference — "engineers can also…" —
 * would be this screen describing a control nothing consults, which is what
 * `20260808000000` spent a whole migration removing from `permission_resources.actions`.
 * So it says so instead.
 */
function roleHint(t: T): Record<StaffRole, string> {
  return {
    support: t('staff.hint.support'),
    engineer: t('staff.hint.engineer'),
    owner: t('staff.hint.owner'),
  }
}


/**
 * The sentence used when an action refuses with no message of its own.
 *
 * `StaffAccessResult.message` is optional, so this is a type obligation rather than a
 * hypothetical — and it is deliberately vague, because it can only be reached by a refusal
 * that forgot to say why. Every refusal the action actually writes has a sentence, and that
 * sentence is what the screen shows: none of them is restated here, so the screen and the
 * server cannot come to describe the same rule in two different ways.
 */
// A FUNCTION now, for the same reason every other module-scope caption became one.
const refused = (t: T) => t('staff.grantFailed')

/** How a row is named in a sentence, a confirmation and a label. */
function nameOf(row: StaffTeamRow): string {
  return row.email || row.userId
}

export function StaffAccessClient({ team }: { team: StaffTeamRow[] }) {
  const t = useT()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [email, setEmail] = useState('')
  // `''` is a fourth value the action refuses, and it is the point of it — see the
  // placeholder option below.
  const [role, setRole] = useState<'' | StaffRole>('')
  const [note, setNote] = useState('')
  const [grantError, setGrantError] = useState('')

  /**
   * One message for every row operation, above the table.
   *
   * NOT one per row. Both rules a row can break are pre-empted above, so what is left
   * reachable is a transport failure or a row somebody else has just changed — and every
   * one of those sentences is about a RULE or a fault rather than about a person, so
   * nothing is lost by not attaching it to a `<tr>`. Attaching it would cost a second
   * `colSpan` row per person, cutting across the collapsing columns, to render a message
   * that names its own subject.
   */
  const [rowError, setRowError] = useState('')

  /**
   * DERIVED FROM THE SAME LIST THE ROWS RENDER, never passed down separately.
   *
   * A second prop counting owners would be a second copy of a fact this array already
   * carries, and the two could disagree — a row could show "the last owner" while the list
   * beside it showed two. `listStaffTeam()` drops a row whose role is not one of the three
   * and the action counts `role = 'owner'` in SQL, so for OWNERS specifically the two
   * counts cannot differ.
   */
  const owners = team.filter(r => r.role === 'owner').length

  function handleGrant() {
    setGrantError('')
    startTransition(async () => {
      const result = await grantStaffAccess({
        email: email.trim(),
        // Narrowed by the disabled submit below; the action re-checks it at runtime
        // anyway, because a `'use server'` export is a public HTTP endpoint.
        role: role as StaffRole,
        note: note.trim(),
      })
      if (!result.success) {
        setGrantError(result.message ?? refused(t))
        return
      }
      // Cleared only on success. A refused grant keeps every field, because the thing most
      // likely to have been wrong is one character of an address.
      setEmail('')
      setRole('')
      setNote('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg">{t('staff.whoHasAccess')}</h2>

        {/* Beside the controls that cause it. Renders nothing for an empty message, which
            is why there is no `{rowError && …}` guard. */}
        <FormError message={rowError} />

        {team.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            The staff list could not be read. That is a refused query rather than an empty
            team — you are on it, or this page would have answered 404 rather than rendering.
            Try again in a moment, and check the server log for the reason.
          </p>
        ) : (
          /*
           * A real <table> with real `<th scope="col">`, so a cell is announced with the
           * column it belongs to. Below `sm` the two subordinate columns FOLD — they carry
           * `COLLAPSING_CELL` on the heading and on every cell, and the row restates them
           * in a `<RowMeta>` under the address. No `overflow-x-auto` and no `min-w-*` floor:
           * sideways scroll parks the column somebody came for off-screen and takes the
           * heading row away with it (AGENTS.md, "On a phone a table narrows").
           *
           * WHAT STAYS is chosen by what this table answers — who has access, and what
           * kind. So the account, the role control and the revoke control keep their
           * columns; the reason and the provenance fold.
           *
           * THE DATE IS LABELLED IN THE META LINE AND THE NOTE IS NOT, which is the rule
           * about labelling a folded value when its heading was doing the work. "Aug 19th,
           * 2026" under an address is a bare number that could be anything, so it reads
           * "Granted Aug 19th, 2026"; the note is a sentence somebody wrote about why this
           * person has access, and directly under their address it cannot be mistaken for
           * anything else.
           */
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">{t('staff.account')}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{t('staff.access')}</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('staff.why')}</th>
                  <th scope="col" className={cn('px-3 py-2 font-semibold', COLLAPSING_CELL)}>{t('staff.granted')}</th>
                  {/* A column with no caption to give still owes one — without it a screen
                      reader announces the revoke button under whatever heading came last. */}
                  <th scope="col" className="px-3 py-2 font-semibold">
                    <span className="sr-only">{t('money.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.map(row => (
                  <TeamRow
                    key={row.userId}
                    row={row}
                    ownerTotal={owners}
                    onError={setRowError}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg">{t('staff.grantAccess')}</h2>
          <p className="text-sm text-muted-foreground">
            The address has to belong to an account that already exists. Somebody who has
            never registered cannot be granted anything, and this screen will say so rather
            than write a row for an id — which is why it asks for an address and not for a
            user id.
          </p>
        </div>

        {/* A real form, so Enter in the address field submits and Enter in the reason box
            inserts a newline. Both are the browser's own behaviour inside a `<form>` and
            neither is worth hand-rolling with key handlers. */}
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); handleGrant() }}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
              <Label htmlFor="grant-email" required>{t('field.emailAddress')}</Label>
              <Input
                id="grant-email"
                type="email"
                // Nothing about this screen belongs in a browser's saved-address list, and
                // an autofilled colleague from an unrelated form is a grant nobody meant.
                autoComplete="off"
                placeholder={t('staff.emailPh')}
                value={email}
                onChange={e => { setEmail(e.target.value); setGrantError('') }}
              />
            </div>
            <div className="min-w-0 space-y-1.5 sm:w-48">
              <Label htmlFor="grant-role" required>{t('staff.kindOfAccess')}</Label>
              <Select
                id="grant-role"
                value={role}
                onChange={e => { setRole(e.target.value as '' | StaffRole); setGrantError('') }}
              >
                {/* THE PLACEHOLDER IS THE POINT, and it is why this control does not
                    default to Support even though the COLUMN does. The action's header
                    says it: a defaulted role on a form is a control somebody can leave
                    alone without noticing, on the one screen where the value decides
                    whether the newcomer can grant access to anybody else. So the form
                    starts with an answer the action refuses, and the owner has to say. */}
                <option value="">{t('staff.choose')}</option>
                {ROLES.map(r => (
                  <option key={r} value={r}>{roleLabel(t)[r]}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* The consequence of the choice, in words, rather than three role names and a
              guess. Only once something is chosen: a hint under a placeholder would be
              describing whichever option happened to be first. */}
          {role ? (
            <p className="text-xs text-muted-foreground">{roleHint(t)[role]}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="grant-note" required>{t('staff.whyNeeded')}</Label>
            <Textarea
              id="grant-note"
              rows={2}
              autoGrow
              maxRows={4}
              placeholder={t('staff.whyPh')}
              value={note}
              onChange={e => { setNote(e.target.value); setGrantError('') }}
            />
            {/* NO CHARACTER COUNTER AND NO `maxLength`, deliberately. The cap lives in the
                action (`NOTE_MAX`) and is not exported; a `500` typed in here would be a
                second answer that drifts the first time the cap moves, and the refusal
                already names the number. */}
            <p className="text-xs text-muted-foreground">
              Recorded on the row and shown in the list above. It is the only thing that
              will explain this grant to whoever reads the list in a year, which is why it
              is required.
            </p>
          </div>

          {/* NOT `affirm`. That token is the create/record/pay role and it is right for a
              family adding a dues schedule; wearing it here would dress the
              highest-privilege write in the product as a routine addition. Not
              `destructive` either — nothing is being deleted. The primary fill is the
              deliberate one, and it is what the console's other panels use.

              Disabled while there is nothing to submit, which is the house pattern and
              states no rule of its own: every actual refusal is the action's sentence,
              rendered once below. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={isPending || !email.trim() || !role || !note.trim()}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {isPending ? t('staff.granting') : t('staff.grantAccess')}
            </Button>
          </div>

          <FormError message={grantError} />
        </form>
      </section>
    </div>
  )
}

/**
 * One person's access, and the two controls that change it.
 *
 * ── WHY THE ROW IS ITS OWN COMPONENT ───────────────────────────────────────────────
 * Two reasons, and the second is a correctness one rather than tidiness.
 *
 *   * **Its own `useTransition`.** Only the row being changed goes busy, so an owner
 *     working through a list is not locked out of every other row while one write is in
 *     flight — and the row that is disabled is the row they are waiting on.
 *   * **The `<Select>` needs state, and it needs state that ADOPTS THE SERVER.** A
 *     controlled select whose `onChange` does not change state keeps the value the person
 *     picked until the next render — and after a CANCELLED confirmation there is no next
 *     render, so the box would sit there claiming a role the database does not hold. So the
 *     displayed value is `useServerState(row.role)`: it moves optimistically, reverts on a
 *     cancel or a refusal, and adopts whatever the server says next. That is the one piece
 *     of state on this screen and it is presentational — the list itself is never
 *     optimistic (see the file header).
 */
function TeamRow({ row, ownerTotal, onError }: {
  row: StaffTeamRow
  /** How many owners the list holds, for rule 5. */
  ownerTotal: number
  onError: (message: string) => void
}) {
  const intl = useIntlTag()
  const t = useT()
  const confirm = useConfirm()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useServerState<StaffRole>(row.role)

  const label = nameOf(row)

  /**
   * Why this row cannot be changed, or null.
   *
   * SELF FIRST, because that is the order the action checks in. See the file header.
   */
  const lock =
    row.isSelf
      ? t('staff.ownAccess')
      : row.role === 'owner' && ownerTotal <= 1
        ? t('staff.lastOwner')
        : null

  const frozen = isPending || lock !== null
  // Unique per row, so `aria-describedby` on two controls resolves to this row's sentence
  // and not to another row's. Rendered once, so there is no duplicate-id hazard — unlike a
  // control that a collapsing column renders twice, which is why those use `aria-label`.
  const lockId = `staff-access-lock-${row.userId}`

  async function handleRole(next: StaffRole) {
    if (next === row.role) return

    // Moved immediately so the box shows what was picked while the confirmation is open,
    // and put back by every path that does not commit.
    setRole(next)
    onError('')

    /**
     * CONFIRMED ONLY WHEN THE CHANGE CROSSES `owner`, which is the only boundary anything
     * in the product enforces. Support to Engineer changes nothing anybody can do (see
     * `ROLE_HINT`), so a prompt there would be ceremony; to or from Owner changes who can
     * hand out cross-family access, and a `<select>` is a control an arrow key can move
     * while it happens to hold focus. That is not a deliberate act and this makes it one.
     *
     * NOT `destructive`. Neither direction deletes anything: one grants a capability and
     * the other withholds it, and the red treatment would be describing a deletion that is
     * not happening — the same distinction `restoreFamily`'s confirmation draws next door.
     */
    const crossesOwner = next === 'owner' || row.role === 'owner'
    if (crossesOwner) {
      const remaining = ownerTotal - 1
      const ok = await confirm({
        title: next === 'owner'
          ? `Make ${label} an owner?`
          : `Take owner access away from ${label}?`,
        description: next === 'owner'
          ? `${label} will be able to grant staff access, change what kind anybody has, and `
            + 'take it away — including yours. Nothing else about what they can see changes.'
          : `${label} keeps the console and everything it reads, and loses this screen: they `
            + `will not be able to grant staff access to anybody. That leaves `
            + `${remaining} owner${remaining === 1 ? '' : 's'}.`,
        confirmLabel: next === 'owner' ? t('staff.makeOwner') : `Change to ${roleLabel(t)[next]}`,
      })
      if (!ok) {
        setRole(row.role)
        return
      }
    }

    startTransition(async () => {
      const result = await setStaffRole({ userId: row.userId, role: next })
      if (!result.success) {
        setRole(row.role)
        onError(result.message ?? refused(t))
        return
      }
      router.refresh()
    })
  }

  async function handleRevoke() {
    onError('')
    // `destructive: true`, because this one genuinely is: the action DELETES the row, and
    // there is no soft form of it — see its header on why a "disabled" grant would be one
    // more expression between an attacker and every family on the platform.
    const ok = await confirm({
      title: `Remove staff access for ${label}?`,
      description:
        `${label} loses the whole console on their next request: every page in it answers `
        + '404 for them, exactly as it does for a customer. Nothing about their own account '
        + 'or their family memberships changes. The reason recorded for this grant goes with '
        + 'the row and is not kept anywhere, so if they need access again it is a new grant '
        + 'with a new reason.',
      confirmLabel: t('staff.removeAccess'),
      destructive: true,
    })
    if (!ok) return

    startTransition(async () => {
      const result = await revokeStaffAccess({ userId: row.userId })
      if (!result.success) {
        onError(result.message ?? refused(t))
        return
      }
      router.refresh()
    })
  }

  const grantedOn = formatDate(row.grantedAt, intl) ?? '—'
  // NULL IS THREE FACTS AND THE SCREEN MUST NOT PICK ONE — nobody was recorded, the
  // granter's account is gone (`granted_by` is deliberately not a foreign key, so the uuid
  // dangles rather than erasing the trail), or the lookup failed. The action's own comment
  // says all three are honestly "not known from here", so that is what this prints.
  const grantedBy = row.grantedByEmail ? `by ${row.grantedByEmail}` : 'granter not known from here'

  return (
    <tr className="border-b align-top last:border-0 sm:align-middle">
      <td className="px-3 py-2.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {row.email ? (
            <span className="font-medium break-all">{row.email}</span>
          ) : (
            // LISTED, NOT HIDDEN. A grant that exists and cannot be named is the most
            // important row on this screen, so the id stands in for the address and the
            // line under it says which of the two it is.
            <span className="font-mono text-xs break-all">{row.userId}</span>
          )}
          {row.isSelf && (
            <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand-on-soft">
              {t('staff.you')}
            </span>
          )}
        </span>
        {!row.email && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('staff.addressUnknown')}
          </p>
        )}
        {lock && (
          <p id={lockId} className="mt-1 text-xs text-brand-withheld">{lock}</p>
        )}
        <RowMeta>
          {row.note ? (
            <>
              <span>{row.note}</span>
              <MetaDot />
            </>
          ) : null}
          <span>Granted {grantedOn}</span>
          <MetaDot />
          <span>{grantedBy}</span>
        </RowMeta>
      </td>

      <td className="px-3 py-2.5">
        {/* `aria-label` as well as the column heading: five selects reading "Access" in a
            row is not enough to tell an owner which person they are about to change, and
            the name is the whole of what distinguishes them. */}
        <Select
          aria-label={`Access for ${label}`}
          aria-describedby={lock ? lockId : undefined}
          className="sm:w-44"
          value={role}
          disabled={frozen}
          onChange={e => { void handleRole(e.target.value as StaffRole) }}
        >
          {ROLES.map(r => (
            <option key={r} value={r}>{roleLabel(t)[r]}</option>
          ))}
        </Select>
      </td>

      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
        {row.note || '—'}
      </td>

      <td className={cn('px-3 py-2.5 text-muted-foreground', COLLAPSING_CELL)}>
        <span className="whitespace-nowrap">{grantedOn}</span>
        <span className="block text-xs break-all">{grantedBy}</span>
      </td>

      <td className="px-3 py-2.5 text-right">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          aria-label={`Revoke staff access for ${label}`}
          aria-describedby={lock ? lockId : undefined}
          disabled={frozen}
          onClick={() => { void handleRevoke() }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('staff.revoke')}
        </Button>
      </td>
    </tr>
  )
}
