import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'

/**
 * Legacy URL for Accounting. Gated on `admin/account`, not `admin/dues`: the latter
 * is a features.ts route but not a row in permission_resources, so gating on it
 * would always fall through to the default ('any') and enforce nothing. This is the
 * same tool behind the same key it redirects to.
 */
export default async function AdminDuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/account')
  redirect('/admin/account')
}
