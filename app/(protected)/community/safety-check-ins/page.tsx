import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAny, requireView } from '@/lib/auth/permissions'
import { resolveZone } from '@/lib/auth/zone'
import {
  getCheckInComposer, getCheckInRights, getCheckIns, getMyOpenCheckIns,
} from '@/app/actions/safety-check-ins'
import { SafetyCheckInsClient } from '@/components/safety/SafetyCheckInsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Safety Check-Ins' }

/**
 * Ask the relatives in one area whether they are safe. `/community/safety-check-ins`, Premium.
 *
 * ── ONE `requireView`, AND IT IS DOING THREE JOBS ──────────────────────────────────
 * §1's preamble. It folds `requireFamilyActive` and `requireTier` in, which is why this page names
 * neither — and this screen has ONE key rather than a union of pane grants, so it does not fall
 * into the trap AGENTS.md describes under "A PAGE THAT RESOLVES PANES BY HAND OWES THE TIER AND
 * REMOVED-FAMILY CHECKS BY HAND TOO".
 *
 * THAT FOLDED `requireTier` IS NOW THIS SCREEN'S PRIMARY GATE, since 2026-08-23: the route moved
 * to Premium because the channel it is meant to run on is SMS. A family below Premium is
 * redirected to `/upgrade` from here.
 *
 * **AND ANSWERING IS DELIBERATELY NOT BEHIND IT.** `answerCheckIn`, `getMyOpenCheckIns` and the
 * Dashboard banner resolve `requireMember()` and the policies' `self_expr` and consult no tier at
 * all — so a relative who has already been asked can always answer, on any plan, including a
 * family that lapses mid-emergency. A tier withholds SCREENS, never rows, and this is the screen
 * where that rule earns its keep. **Do not tier-check an action in that module.**
 *
 * `requireView` resolves with `can()`, which is TRUE for scope `'own'` — and `'own'` is what the
 * General template holds on this key. That is deliberate and the migration's §10 argues it: a
 * member has to be able to open this screen to answer, so a `'none'` default would have made a
 * family's own emergency check-in answerable only by administrators.
 *
 * ── AND TWO MORE CHECKS, NEITHER REDUNDANT ─────────────────────────────────────────
 *   `canAny(create)` decides whether the audience picker is FETCHED at all (§5). The audience
 *   list carries every region and chapter name with a head count against each, which is useless
 *   to somebody who cannot raise a check-in — and props reach the browser in the RSC payload
 *   whether a component renders them or not, so the fetch is skipped rather than the control
 *   hidden.
 *
 *   `canAny(view)` — resolved inside `getCheckIns` rather than here — decides whether the ROSTER
 *   is read. Scope `'own'` is not a way to read who else is unaccounted for; §5's fifth decision
 *   calls a completed check-in the sharpest PII this product would hold.
 *
 * ── THE ONE FETCH WITH NO GRANT IN FRONT OF IT ─────────────────────────────────────
 * `getMyOpenCheckIns()`. Being asked whether you are safe is not a capability a family delegates,
 * so it is `requireMember()` and the policies' `self_expr` and nothing else. It is also why the
 * Dashboard banner exists: `/dashboard` has no permission row and cannot be restricted, so even a
 * family that sets this key to `'none'` for its General template can still answer. That
 * redundancy is deliberate — see the migration's §10.
 */
export default async function SafetyCheckInsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'community/safety-check-ins')

  const canRaise = await canAny(user.id, 'community/safety-check-ins', 'create')

  const [checkIns, mine, rights, composer, zone] = await Promise.all([
    getCheckIns(),
    getMyOpenCheckIns(),
    getCheckInRights(),
    // §5: the audience list is not fetched for somebody who cannot raise one. The action
    // resolves the same grant itself, because this page is a convenience and not a gate (§2).
    canRaise ? getCheckInComposer() : Promise.resolve({ audiences: [], people: [] }),
    resolveZone(user.id),
  ])

  return (
    <PageShell className="space-y-6">
      <SafetyCheckInsClient
        // §8: `null` from the action is a REFUSED read, not an empty list, and the client says so
        // rather than rendering "nothing open" over an outage. On this screen those two are
        // further apart than anywhere else in the product — one of them means nothing is
        // happening.
        initialCheckIns={checkIns}
        myCheckIns={mine}
        audiences={composer.audiences}
        people={composer.people}
        rights={rights}
        zone={zone}
      />
    </PageShell>
  )
}
