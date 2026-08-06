import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'

/**
 * Legacy URL for the member-facing dues view, which now lives on My Summary
 * (/account-summary — the path keeps the old name because it is a permission key).
 * Gated on `dues` rather than on the destination's resource: this URL *is* the dues
 * page as far as the permission model is concerned, so a family that restricts dues
 * should 404 here instead of bouncing the member onward.
 */
export default async function DuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'dues')
  redirect('/account-summary')
}
