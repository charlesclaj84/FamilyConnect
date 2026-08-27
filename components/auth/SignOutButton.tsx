'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearIdleActivity } from '@/lib/idle-timeout'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/layout/LocaleProvider'

export function SignOutButton() {
  const t = useT()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    // `scope: 'local'` — THIS device, not the account. `signOut()` defaults to `'global'`,
    // which revokes every session the account has: signing out on a laptop was also
    // signing the member out of their phone, with nothing on screen suggesting it would.
    // Same rule `InviteMismatchActions` states, and the same one the password panel
    // deliberately breaks in the other direction with `'others'`, where evicting the
    // other devices is the point.
    //
    // It still revokes this session server-side rather than only clearing the cookie, so
    // the button remains a real sign-out.
    await supabase.auth.signOut({ scope: 'local' })
    // The idle timer's marker belongs to the session that just ended. Left behind, it is
    // however old this member's last click was, and the next person to sign in on this
    // browser inherits it — see lib/idle-timeout.ts.
    clearIdleActivity()
    router.push('/')
    router.refresh()
  }

  // Styled for the Heritage band, which is the only place it renders (the signed-in
  // header). `variant="outline"` drew its border and text from the generic ramp, which is
  // dark-on-light — on deep burgundy that was a near-invisible button. An outlined chip in
  // --brand-on-hero keeps it secondary to the family switcher beside it while staying
  // legible: 9.80 in light, 16.30 in dark.
  //
  // If this is ever reused on a pale surface, take the colours as props rather than
  // reverting them here.
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      className="border-brand-on-hero/35 bg-transparent text-brand-on-hero hover:bg-brand-primary hover:text-brand-on-hero"
    >
      {t('auth.signOut')}
    </Button>
  )
}
