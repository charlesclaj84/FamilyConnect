'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, LogOut, UserCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearIdleActivity } from '@/lib/idle-timeout'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { HEADER_PANEL_CLASS, HEADER_PANEL_SCRIM_CLASS } from '@/components/layout/header-panel'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  email: string
  initials: string
  avatarUrl?: string | null
}

/**
 * The account control at the far right of the top bar: a portrait and a chevron, opening
 * a menu.
 *
 * WHAT IT REPLACED. The signed-in header used to end in a bordered "Sign Out" button and
 * a bare theme icon, sitting on a full-width Heritage band. The Golden Master ends the
 * bar with a portrait and a chevron instead, and that is a better division as well as a
 * closer match: sign-out is a rare, consequential action and it had the most permanent
 * real estate in the app, next to the one control people press by accident. Rare and
 * consequential belongs one click in.
 *
 * WHAT IS INSIDE, and why each is here rather than in the bar:
 *
 *   * **Who you are signed in as.** The bar shows a face; a face is not a name, and on a
 *     shared machine "which account is this" is the question the menu exists to answer
 *     first. My Profile is directly under it because that is where the answer is edited.
 *   * **Appearance.** A three-state toggle nobody presses twice a day. It kept a slot in
 *     the bar only because there was nowhere else to put it.
 *   * **Sign out.** Destructive-adjacent and final, so it is last, ruled off, and the only
 *     item in the menu that is not brand-ink.
 *
 * THE FAMILY SWITCHER IS DELIBERATELY NOT IN HERE. It is state — which family you are
 * acting in — not an account action, and it is the one control whose current value has to
 * be readable without opening anything. It stays in the bar as its own chip, and renders
 * nothing at all for a single-family account, which is why the bar still matches the
 * Golden Master for most people.
 */
export function AccountMenu({ name, email, initials, avatarUrl }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    // `scope: 'local'` — THIS device, not the account. `signOut()` defaults to `'global'`,
    // which revokes every session the account has: signing out on a laptop was also
    // signing the member out of their phone, with nothing on screen suggesting it would.
    await supabase.auth.signOut({ scope: 'local' })
    // The idle timer's marker belongs to the session that just ended. Left behind, it is
    // however old this member's last click was, and the next person to sign in on this
    // browser inherits it — see lib/idle-timeout.ts.
    clearIdleActivity()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="menu"
        className="flex items-center gap-1 rounded-full p-0.5 pr-1 text-brand-ink transition-colors hover:bg-brand-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Account menu for ${name}`}
      >
        <Avatar url={avatarUrl} initials={initials} size="sm" className="h-9 w-9" />
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className={HEADER_PANEL_SCRIM_CLASS} onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="menu" className={cn(HEADER_PANEL_CLASS, 'sm:w-64')}>
            <div className="shrink-0 border-b px-3 py-3">
              <p className="truncate text-sm font-semibold text-card-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              <Link
                href="/personal-info"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
              >
                <UserCircle className="h-4 w-4 shrink-0 opacity-70" /> My Profile
              </Link>
              <Link
                href="/my-families"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
              >
                <Users className="h-4 w-4 shrink-0 opacity-70" /> My Families
              </Link>

              {/* The label sits beside the toggle rather than wrapping it, because
                  ThemeToggle is already a button carrying its own aria-label — one that
                  names the CURRENT state and the destination both ("Appearance: Light.
                  Switch to Dark."). Wrapping it in a second interactive element would
                  nest a button in a button and give a screen reader two conflicting
                  accessible names for one control.
                  The row also does not close the menu: cycling Light → Dark → System is
                  something people do two or three times in a row to compare. */}
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-card-foreground">
                <span className="opacity-90">Appearance</span>
                <ThemeToggle />
              </div>
            </div>

            <div className="shrink-0 border-t py-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 shrink-0" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
