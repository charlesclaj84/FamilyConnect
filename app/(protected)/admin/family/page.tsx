import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getFamilySettings } from '@/app/actions/admin/family'
import { FAMILY_RESOURCE } from '@/components/admin/family-settings'
import { FamilySettingsClient } from '@/components/admin/FamilySettingsClient'
import { PageShell } from '@/components/layout/PageShell'

// "Settings", not "Family Settings" — see the note on the FEATURES entry in
// lib/features.ts. The route and the resource key both stay `admin/family`.
export const metadata = { title: 'Settings' }

/**
 * The family's own identity: its name, and the code relatives join with.
 *
 * The nineteenth `admin/*` surface, and the first about WHICH family this is rather
 * than about running it. Registered by 20260812000000 as 'restricted' per family, so
 * it is administrators-only until a family says otherwise.
 *
 * `reading`, not `wide`. One field and three facts about the family is a single column
 * of content — a 6xl measure would put the Save button most of a screen away from the
 * input it belongs to.
 */
export default async function FamilySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 404s anyone without view, before anything is read. getFamilySettings() checks the
  // same grant again — it is a `'use server'` export with a URL of its own, so the page
  // in front of it is a convenience and not a gate.
  await requireView(user.id, FAMILY_RESOURCE)

  const settings = await getFamilySettings()

  return (
    <PageShell width="reading" className="space-y-8">
      <div>
        <h1 className="mb-1 text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          What your family is called, and the code relatives use to join it.
        </p>
      </div>

      {settings
        ? <FamilySettingsClient settings={settings} />
        : (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            We could not load this family&rsquo;s details. Try again in a moment.
          </p>
        )}
    </PageShell>
  )
}
