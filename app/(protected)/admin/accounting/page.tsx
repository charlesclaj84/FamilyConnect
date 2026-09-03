import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { getDuesSchedules, getScheduleUsage, getDuesScopeOptions } from '@/app/actions/dues'
import { getFunds, getFundAllocations } from '@/app/actions/funds'
import { getProcessorStatus } from '@/app/actions/admin/processing'
import { AdminAccountShell } from '@/components/admin/AdminAccountShell'
import {
  resolveSection, SECTION_RESOURCE,
  type AccountSection, type AccountRights, type SectionRights,
} from '@/components/admin/account-sections'
import { can, canAny } from '@/lib/auth/permissions'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('doc./admin/accounting.title')
}

/**
 * Accounting CONFIGURATION: dues, donations, funds, routing, milestones, settings.
 *
 * The ledgers and the forms that write to them used to load here too — that is why
 * this page once fetched payments, disbursements, contributions and the member list.
 * They live on /transactions now, so none of it is read twice.
 */
export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await requireView(user.id, 'admin/accounting')
  const { t } = await callerI18n(user.id)

  const familyCode = await getMyFamilyCode(user.id)

  // Resolved server-side so the first paint already shows the right section — and so
  // the client's initial state matches the server HTML exactly, which is what keeps
  // this free of hydration mismatch. searchParams is a Promise in Next 16.
  const initialSection = resolveSection((await searchParams).section)

  // One set of rights per section. requireView('admin/accounting') above only says the
  // caller may open the page at all; each rail, each section and each new/edit/delete
  // inside it is its own grant, so someone can maintain the dues schedule without also
  // being able to redraw the routing split or price a milestone.
  //
  // view uses can() — 'own' is a real way to hold view. Everything that WRITES uses
  // canAny(): this is family-wide configuration with no coherent "own" version, which
  // is exactly the case AGENTS.md reserves canAny for.
  const SECTIONS: AccountSection[] = ['dues', 'donations', 'funds', 'routing', 'milestones', 'processing', 'bank']
  const rightsList = await Promise.all(
    SECTIONS.map(async (s): Promise<[AccountSection, SectionRights]> => {
      const resource = SECTION_RESOURCE[s]
      const [view, create, edit, del] = await Promise.all([
        can(user.id, resource, 'view'),
        canAny(user.id, resource, 'create'),
        canAny(user.id, resource, 'edit'),
        canAny(user.id, resource, 'delete'),
      ])
      return [s, { view, create, edit, delete: del }]
    }),
  )
  const rights = Object.fromEntries(rightsList) as AccountRights

  // Gate the FETCH, not just the pane. Props are serialized into the RSC payload and
  // reach the browser whether or not a component renders them, so loading the funds or
  // the dues schedules for someone who may not see that section would publish them
  // regardless of which pane is showing (AGENTS.md §4).
  const [
    schedules, scheduleUsage, fundsData, allocations, milestonesResult, membersResult,
    bloodlineResult, scopeOptions, processorStatus,
  ] = await Promise.all([
    rights.dues.view || rights.donations.view ? getDuesSchedules() : Promise.resolve([]),
    // Gated on the same pair as the schedules themselves: it says which of them the
    // ledger has been posted against, which is only meaningful beside the list.
    rights.dues.view || rights.donations.view ? getScheduleUsage() : Promise.resolve({}),
    // ── AND THE DUES/DONATIONS GRANTS WERE ADDED 2026-09-03 ───────────────────
    // A dues schedule may now name ONE fund to go straight into, skipping the routing
    // waterfall (`20260903000001`), so the schedule form needs the fund NAMES.
    //
    // WIDENED RATHER THAN GATED ON `funds.view` AS WELL, and that is the §5 decision
    // rather than a shortcut. Naming where a due lands is part of configuring the due —
    // a treasurer who may set the dues up and cannot say where the money goes is a
    // control missing for a reason nothing on the screen could explain. What is published
    // is a fund's id and NAME, which is family-wide configuration; the BALANCES ride on
    // the same rows, which is why this is worth stating: `getFunds` returns them, so a
    // dues-only caller now receives figures they would not see on the Funds pane.
    //
    // That is admissible because the pane it would be withheld from is a SCREEN BAND
    // rather than confidentiality — `admin/accounting/funds` has no
    // `permission_table_map` row, so a caller holding `accounting/summary` already reads
    // every fund's balance through PostgREST whatever this switch says (§2c). If it ever
    // needs to be confidentiality, the fix is the one that section prescribes — a
    // narrower projection here, not a narrower grant.
    rights.funds.view || rights.routing.view || rights.milestones.view
      || rights.dues.edit || rights.donations.edit
      ? getFunds() : Promise.resolve([]),
    rights.routing.view ? getFundAllocations() : Promise.resolve([]),
    // Family-scoped explicitly: the service-role client does not apply RLS.
    rights.milestones.view
      ? admin.from('fund_milestones').select('*').eq('family_code', familyCode).order('sort_order')
      : Promise.resolve({ data: [] }),
    // The roster the "this drive is for" picker chooses from, and the names the
    // Donations list prints its "For …" caption with. Gated on Donations alone — Dues
    // has no beneficiaries and never will, so a dues-only treasurer has no business
    // being handed the roster (AGENTS.md §5: props reach the browser whether or not a
    // component renders them).
    //
    // People who can transact, and family-scoped explicitly because the service-role
    // client applies no RLS. The `is_minor` conjunct came off with the column in
    // 20260813000006; `user_id IS NOT NULL` is what always decided this, and it stays —
    // see the longer note on the same query in app/(protected)/transactions/page.tsx.
    rights.donations.view
      ? admin.from('people')
          .select('id, first_name, last_name, nick_name, date_of_birth')
          .eq('family_code', familyCode)
          .not('user_id', 'is', null)
          .order('last_name')
      : Promise.resolve({ data: [] }),
    // ── HAS ANYBODY BEEN MARKED AS BLOODLINE ────────────────────────────────────
    // The answer decides whether "Bloodline only" can be offered on a dues schedule. A
    // family that has marked nobody would be creating a due owed by NOBODY, so the control
    // is disabled rather than offered and then silently collecting nothing (see the field
    // in AdminIncomeClient).
    //
    // A HEAD COUNT, so no row crosses the wire — which makes §5 trivially satisfied here
    // rather than argued. It is still gated on the Dues section, because that is the only
    // place the flag appears and a fetch a caller is not entitled to should not run.
    rights.dues.view
      ? admin.from('people').select('id', { count: 'exact', head: true })
          .eq('family_code', familyCode).eq('is_bloodline', true)
      : Promise.resolve({ count: 0 }),
    // ── WHICH PARTS OF THE FAMILY A DUE CAN BE SCOPED TO ────────────────────────
    // The regions and chapters that EXIST (20260817000008). Gated on the Dues section,
    // because that is the only place the scope field appears — and offering only what
    // exists is the point: a family with neither gets no field at all rather than a
    // disabled control over the single value it would have.
    //
    // NOT `getRegions()`/`getChapters()`, which are gated on `admin/chapters` — the grant
    // to EDIT the family's structure. Maintaining what members owe and drawing the map are
    // different jobs, and the treasurer needs to read the second without holding it.
    rights.dues.view ? getDuesScopeOptions() : Promise.resolve({ regions: [], chapters: [] }),
    // ── THE FAMILY'S PAYMENT PROCESSOR ──────────────────────────────────────────
    // Gated on the Processing section, per §5. What is withheld is small and real: the
    // family's Stripe account id, and whether card payments are live. The action gates
    // itself again on the same key, so this is the FETCH half rather than the only check.
    //
    // NULL FOR A CALLER WHO MAY NOT SEE IT, which is deliberately the same shape the action
    // returns when a READ FAILS — and the panel tells the two apart by which branch it is in
    // rather than by the value, because a caller without the grant never renders the pane at
    // all. See ProcessingPanel's header.
    rights.processing.view ? getProcessorStatus() : Promise.resolve(null),
  ])

  // ── DOES THIS FAMILY HAVE A BLOODLINE TO RESTRICT A DUE TO ──────────────────
  // It asked whether an ANCHOR was set — or a founder to fall back on — because the
  // bloodline was walked from one. `20260902000000` made it `people.is_bloodline`, so the
  // question is whether anybody carries it, and a HEAD count is the whole read.
  //
  // THE ANSWER IS STRICTER THAN IT WAS, deliberately. `created_by` is never null in
  // practice, so the old expression was true for effectively every family — including one
  // that had never thought about its bloodline, which could therefore tick "Bloodline only"
  // and create a due nobody owed. That is exactly the state the field's own hint exists to
  // prevent, and the control was disabled for almost nobody.
  const hasBloodline = (bloodlineResult.count ?? 0) > 0

  // ONE MEASURE AT EVERY WIDTH, since 2026-08-13. This was `max-w-4xl … xl:max-w-6xl`,
  // narrower than the pages either side of it until 1280px, on the argument that the
  // second-level rail only appears at xl. That argument was already stale — the rail's
  // 16rem column is inside the shell, not outside it — and the visible cost was a page
  // that changed width mid-resize while Members next door did not. `wide` is what every
  // horizontal page uses; see components/layout/PageShell.tsx.
  return (
    <PageShell className="space-y-8">
      <h1 className="text-3xl font-bold">{t('page./admin/accounting.title')}</h1>

      <AdminAccountShell
        initialSection={initialSection}
        initialSchedules={schedules}
        scheduleUsage={scheduleUsage}
        initialFunds={fundsData}
        allMilestones={milestonesResult.data ?? []}
        initialAllocations={allocations}
        rights={rights}
        hasBloodline={hasBloodline}
        scopeOptions={scopeOptions}
        processorStatus={processorStatus}
        members={(membersResult.data ?? []).map(m => ({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          nick_name: m.nick_name ?? null,
          date_of_birth: m.date_of_birth ?? null,
        }))}
      />
    </PageShell>
  )
}
