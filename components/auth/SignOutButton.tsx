'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
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
      Sign Out
    </Button>
  )
}
