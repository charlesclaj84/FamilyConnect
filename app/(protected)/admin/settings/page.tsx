import { redirect } from 'next/navigation'
import { requireView } from '@/lib/auth/permissions'
import { getFamilySettings } from '@/app/actions/admin/family'
import { getPlatformBilling } from '@/app/actions/billing'
import { FAMILY_RESOURCE, resolveSettingsPane } from '@/components/admin/family-settings'
import { FamilySettingsClient } from '@/components/admin/FamilySettingsClient'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'

// "Settings", not "Family Settings" — see the note on the FEATURES entry in
// lib/features.ts. The route and the resource key both stay `admin/family`.
export const metadata = { title: 'Settings' }

interface Props {
  searchParams: Promise<{ pane?: string }>
}

/**
 * The family's own identity: its name, and the code relatives join with.
 *
 * The nineteenth `admin/*` surface, and the first about WHICH family this is rather
 * than about running it. Registered by 20260812000000 as 'restricted' per family, so
 * it is administrators-only until a family says otherwise.
 *
 * `wide`, like every other page. This was `reading` on the argument that a 6xl measure
 * would put the Save button most of a screen away from the input it belongs to — and that
 * turned out to be an argument about the FIELD rather than about the page. The button sits
 * under the input, not beside it, so what the wide measure actually stretched was the name
 * box itself; `FamilySettingsClient` caps that box instead, which is where the constraint
 * belongs. The page starts where its neighbours start.
 *
 * ── THREE PANES ON A RAIL, AND STILL ONE `requireView` ─────────────────────────────
 * `?pane=` is resolved HERE rather than in the shell, so the first paint is already the
 * right pane and a bookmarked `?pane=family` does not flash the plan on its way there.
 *
 * There is deliberately NO union of `can()` calls above, which is what a multi-pane page
 * usually owes: `/admin/members` decomposes `requireView` because each of its four panes
 * carries its own resource key, and a page that does that must then re-do
 * `requireFamilyActive` and `requireTier` by hand (AGENTS.md, "A PAGE THAT RESOLVES PANES BY
 * HAND OWES THE TIER AND REMOVED-FAMILY CHECKS BY HAND TOO"). All three of these panes are
 * governed by `admin/settings` alone, so the one guard is the whole gate and all three of its
 * folded checks are still made — the failure mode that rule exists to prevent cannot arise
 * here because nothing has been taken apart. Splitting Billing onto the rail on 2026-08-25
 * did not change that: it is a third PANE, not a third KEY.
 *
 * The one grant that IS separate, `admin/settings/remove`, gates a control inside the Family
 * pane rather than a pane of its own, and `getFamilySettings()` resolves it on the server as
 * `canRemove` — so a caller without it never receives the props that section would render.
 */
export default async function FamilySettingsPage({ searchParams }: Props) {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  // 404s anyone without view, before anything is read. getFamilySettings() checks the
  // same grant again — it is a `'use server'` export with a URL of its own, so the page
  // in front of it is a convenience and not a gate.
  await requireView(user.id, FAMILY_RESOURCE)
  const { t } = await callerI18n(user.id)

  // BOTH BEHIND THE SAME GRANT, which is the decision `getPlatformBilling`'s header argues:
  // choosing a plan and paying for it are one job on one screen, so billing rides
  // `admin/settings` rather than inventing a key an administrator would have to find and set
  // before the pane they were already looking at would work.
  const [settings, billing, params] = await Promise.all([
    getFamilySettings(), getPlatformBilling(), searchParams,
  ])
  const pane = resolveSettingsPane(params.pane)

  return (
    <PageShell className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('page./admin/settings.title')}</h1>
      </div>

      {settings
        ? <FamilySettingsClient settings={settings} initialPane={pane} billing={billing} />
        : (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">{t('adm.weCouldNotLoad')}</p>
        )}
    </PageShell>
  )
}
