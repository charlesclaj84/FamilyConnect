import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { getNotifications } from '@/app/actions/notifications'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.user_metadata?.first_name
    || user?.email?.split('@')[0]
    || 'Member'

  // Fetch notifications + person id for real-time sub (non-fatal if user not fully set up)
  let notifications: Awaited<ReturnType<typeof getNotifications>> = []
  let personId = ''
  if (user) {
    const admin = createAdminClient()
    const [notifResult, personResult] = await Promise.all([
      getNotifications(),
      admin.from('people').select('id').eq('user_id', user.id).maybeSingle(),
    ])
    notifications = notifResult
    personId = personResult.data?.id ?? ''
  }

  return (
    <header className="border-b bg-[#e6ecf1] sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Family Connect" width={120} height={60} className="h-10 w-auto" />
          <span className="text-xl font-bold text-primary">Family Connect</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-muted-foreground">
            {firstName}
          </span>
          {personId && (
            <NotificationBell initialNotifications={notifications} personId={personId} />
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
