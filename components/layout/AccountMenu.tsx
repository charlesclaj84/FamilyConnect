'use client'

import { useRef, useState } from 'react'
import { useT } from '@/components/layout/LocaleProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ExternalLink, LogOut, ShieldCheck, UserCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearIdleActivity } from '@/lib/idle-timeout'
import { Avatar } from '@/components/ui/Avatar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import {
  HEADER_PANEL_CLASS, HEADER_PANEL_SCRIM_CLASS, useCloseOnNavigate,
} from '@/components/layout/header-panel'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  email: string
  initials: string
  avatarUrl?: string | null
  /**
   * Whether this account may open the GENORRA staff console.
   *
   * RESOLVED ON THE SERVER and handed down — see `app/(protected)/layout.tsx`. It cannot
   * be worked out here: `genorra_staff` has RLS enabled with no policy, so the browser
   * cannot read it, and the alternative a client check would need (a flag in user
   * metadata) is writable by its owner through GoTrue's own endpoint. This prop is the
   * whole of what the browser is told, and it decides a link rather than an access —
   * every route under `/staff` gates itself again and 404s a caller without a row.
   */
  isStaff?: boolean
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
 *   * **The GENORRA staff console**, for the handful of accounts that have it, and for
 *     nobody else. It is in this menu rather than in the rail because it is a property of
 *     the ACCOUNT and not of the family: the rail is built from `viewableResources()`,
 *     which answers per family, and a link that appears there would read as one of this
 *     family's screens. It is ruled off from the two items above it and labelled as
 *     leaving the product, because it does — a different app, in a different window.
 *   * **Sign out.** Destructive-adjacent and final, so it is last, ruled off, and the only
 *     item in the menu that is not brand-ink.
 *
 * THE FAMILY SWITCHER IS DELIBERATELY NOT IN HERE. It is state — which family you are
 * acting in — not an account action, and it is the one control whose current value has to
 * be readable without opening anything. It stays in the bar as its own chip, and renders
 * nothing at all for a single-family account, which is why the bar still matches the
 * Golden Master for most people.
 */
export function AccountMenu({ name, email, initials, avatarUrl, isStaff = false }: Props) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // TopBar lives in the layout and never unmounts, so neither does this flag — the menu
  // stayed on screen over whatever page you navigated to next. Every item in here
  // already closes it on the way out; this covers the navigations it does not start,
  // which is all of them: a rail link (the rail is not under the scrim — see the hook),
  // Back, Forward, a redirect, the idle timeout.
  useCloseOnNavigate(open, () => setOpen(false))

  // AND THIS COVERS BEING WALKED AWAY FROM. The scrim closes the menu on a click; nothing
  // closed it on somebody simply moving on, so a panel naming the signed-in account and
  // its email address sat over the page until the next click landed. The trigger and the
  // panel are named individually rather than by the wrapper around them: the wrapper also
  // contains the full-viewport scrim, so testing it would call every pointer position on
  // the page "inside the menu".
  useDismissWhenIdle({
    open,
    close: () => setOpen(false),
    parts: () => [trigger.current, panel.current],
  })

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
        ref={trigger}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="menu"
        className="flex items-center gap-1 rounded-full p-0.5 pe-1 text-brand-ink transition-colors hover:bg-brand-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('account.menuFor', { name })}
      >
        <Avatar url={avatarUrl} initials={initials} size="sm" className="h-9 w-9" />
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className={HEADER_PANEL_SCRIM_CLASS} onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={panel} role="menu" className={cn(HEADER_PANEL_CLASS, 'sm:w-64')}>
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
                <UserCircle className="h-4 w-4 shrink-0 opacity-70" /> {t('account.profile')}
              </Link>
              <Link
                href="/my-families"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
              >
                <Users className="h-4 w-4 shrink-0 opacity-70" /> {t('account.families')}
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
                <span className="opacity-90">{t('account.appearance')}</span>
                <ThemeToggle />
              </div>
              {/* ── THE LANGUAGE IS NOT IN HERE, AND IT WAS UNTIL 2026-08-29 ───────────
                  It sat right here, beside Appearance, on the argument that the two are the
                  same kind of thing: how the product presents itself to this one person,
                  changed in place, not a page to visit. That reading is still true and was
                  not enough. Appearance is a preference somebody sets once; the language is
                  the thing standing between a reader and every other word on the screen, and
                  a member who has just been handed a screen they cannot read should not have
                  to guess that the fix is behind a portrait. It is a control in the bar now,
                  beside the bell — see `TopBar` for the ordering. */}
              {/* THE STAFF CONSOLE, and only for staff.
                  ─────────────────────────────────────────────────────────────────
                  `isStaff` is a SERVER answer (see the prop). This renders nothing at
                  all for everybody else — not a disabled item, not a greyed one — so the
                  menu of a member who is not staff says nothing about a console existing.
                  That is the same decision `requireStaff()` makes by answering 404
                  instead of "not authorized"; a visible-but-inert item here would give
                  away in the account menu exactly what the 404 is protecting.

                  `target="_blank"` because it is a different application: a support
                  engineer works the console BESIDE the family they are looking at, and a
                  same-tab navigation would throw away whatever they were reading. The
                  console's own layout inherits nothing from this shell, so there is no
                  going "back" to a half-built version of it either.

                  `rel="noopener"` is not optional on a `_blank` link: without it the new
                  document gets a live `window.opener` handle to this one and can navigate
                  it. It costs nothing and the omission is the kind that is never noticed.

                  A ruled section of its own, above sign-out, so it reads as leaving the
                  product rather than as a third personal page. */}
              {isStaff && (
                <div className="mt-1 border-t pt-1">
                  <Link
                    href="/staff"
                    target="_blank"
                    rel="noopener"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-muted"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1">
                      {t('account.staff')}
                      {/* Said in words, not left to the icon. "Opens in a new window" is
                          the one thing a link that changes context owes its reader, and a
                          bare arrow glyph is decoration to anyone using a screen reader. */}
                      <span className="block text-xs text-muted-foreground">
                        {t('account.staffHint')}
                      </span>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t py-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 shrink-0" /> {t('account.signOut')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
