import { requireStaffOwner } from '@/lib/auth/staff'
import { listStaffTeam } from '@/app/actions/staff/access'
import { StaffAccessClient } from '@/components/staff/StaffAccessClient'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./staff/access.title')
}

/**
 * Who can open this console, and the screen that changes it.
 *
 * ── THIS PAGE IS THE ONE AGENTS.md SAID SHOULD NOT EXIST ───────────────────────────
 * *"Access is granted BY HAND, with SQL. There is no UI for it and there must not be one
 * until there is a reason — a screen that grants cross-family access is a screen worth
 * attacking."* The reason arrived, and it is the same one every other rule in this repo
 * about touching production is built on: granting by hand means a `psql` session against
 * the hosted database, which "How migrations reach the hosted project" forbids for
 * everything else and for two incidents' worth of reasons. The honest options were a
 * screen or a permanent exception, and the exception was the part nobody was auditing.
 *
 * Every other bullet in that section is unchanged and none was weakened to make room for
 * this: `genorra_staff` still has RLS enabled with ZERO policies, this page still 404s
 * rather than refusing, and there is still no `permission_resources` row for any of it.
 * The full argument is in `app/actions/staff/access.ts`, which is where the writes are.
 *
 * ── THE GUARD IS `requireStaffOwner()`, HERE, AND IT IS NOT THE ONLY COPY ───────────
 * `app/(staff)/layout.tsx` calls `requireStaff()` — STAFFNESS, not ownership — because
 * the other three screens in the console are correctly gated on staffness and narrowing
 * the layout would have silently demoted them. So the layout does not gate this page at
 * all, and the call below is not defensive repetition of an upstream check: it is the
 * only check in the render path.
 *
 * The four actions behind the screen each call it again, and that is AGENTS.md §2 rather
 * than belt-and-braces — a server action reached by POST does not render this page, so a
 * page guard is not in its request path. `staffGrant` is `cache()`d per request, so the
 * page's call and an action's call in the same request cost one query between them.
 *
 * IT 404s AND MUST NEVER LEARN TO REFUSE. A `support` staffer told "owners only" has
 * learned three things they did not have: that this screen exists, that access is granted
 * from inside the product rather than from SQL, and that there is a role above theirs to
 * be talked into. See `lib/auth/staff.ts`.
 *
 * ── THE FETCH IS BEHIND THE SAME GATE AS THE SCREEN (§5) ───────────────────────────
 * `listStaffTeam()` is read here, after the guard, and gates itself as well. It answers
 * `[]` rather than a message on refusal, which is deliberate and is why the client
 * component treats an empty list as a FAULT rather than as an empty team — the caller is
 * standing on a row of it.
 *
 * The whole team is fetched, unpaged and unfiltered, unlike Families and Accounts next
 * door. That is not an oversight: the staff team is single digits by construction, and
 * `emailsFor()` in the action resolves one GoTrue lookup per row precisely because that is
 * the right shape at this size. A pager and a filter box over four rows would be two
 * controls that do nothing, and AGENTS.md's "build every member list for a
 * hundred-member family" is a rule about a FAMILY's roster — the thing that grows
 * because the product succeeds. This list grows because GENORRA hires, and the day it needs
 * paging the fix is a filtered page in the action, not a search box here.
 *
 * ── NO `permission_resources` ROW, NO `FEATURES` ENTRY ─────────────────────────────
 * Both absences are deliberate and both were checked rather than assumed.
 * `permission_resources` is a family's own switch grid, so a row for this would print
 * a "GENORRA Staff" switch on every customer's Members & Access screen and give away
 * the thing the 404 above exists to keep quiet (`lib/auth/staff.ts` sets that out at
 * length). And `lib/features.ts` answers two questions about the MEMBER product — has this
 * shipped, and is it in the family's plan — neither of which applies: `getFeature()` is
 * `undefined` for every path under `/staff` because no registry href covers it, so
 * `isGatedPath()` is false and `proxy.ts` passes this route through untouched. An entry
 * would also put the console in front of `npm run help:check`, which asks that every LIVE
 * feature has a chapter in a manual that documents the member product.
 */
export default async function StaffAccessPage() {
  const { t } = await callerI18n(null)
  await requireStaffOwner()

  const team = await listStaffTeam()

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold">{t('page./staff/access.title')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('stf.everybodyWhoCanOpen')}<code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/scripts/grant_staff.sql</code>,
          because there has to be somebody able to open this screen before it can grant
          anything.
        </p>
      </div>

      <StaffAccessClient team={team} />
    </PageShell>
  )
}
