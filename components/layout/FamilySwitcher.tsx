'use client'

import { useRef, useState, useTransition } from 'react'
import { useT } from '@/components/layout/LocaleProvider'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Clock, Home, PowerOff, Star } from 'lucide-react'
import { switchActiveFamily } from '@/app/actions/family'
import type { FamilyMembership } from '@/lib/auth/family'
import {
  HEADER_PANEL_CLASS, HEADER_PANEL_SCRIM_CLASS, useCloseOnNavigate,
} from '@/components/layout/header-panel'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'

/**
 * Switches which family the user is acting in. Rendered only when the account
 * belongs to more than one — a single-family user sees nothing.
 *
 * The switch is server state (see set_active_family), so after it lands we
 * refresh rather than update locally: every family-scoped query on the page,
 * including the sidebar and navbar, has to be re-fetched.
 */
export function FamilySwitcher({ families }: {
  families: FamilyMembership[]
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Same reason as the account menu: this panel outlives the page it was opened over,
  // because TopBar is rendered by the layout and never unmounts. See the hook. Above
  // the early return below, because hooks may not sit after one.
  useCloseOnNavigate(open, () => setOpen(false))

  // And closes itself a few seconds after being walked away from — see the hook. Also
  // above the early return, and for the same reason.
  useDismissWhenIdle({
    open,
    close: () => setOpen(false),
    parts: () => [trigger.current, panel.current],
  })

  if (families.length < 2) return null

  const active = families.find(f => f.isActive) ?? families[0]

  function handleSelect(familyCode: string) {
    if (familyCode === active.familyCode) {
      setOpen(false)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await switchActiveFamily(familyCode)
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="menu"
        // A SOLID SAND CHIP, not a translucent one. This is the only control in the
        // header carrying a piece of state rather than an action — which family you are
        // acting in — and on the Heritage band it should read as the identity chip it is,
        // not as a third icon button. `bg-card/70` was a wash of the generic card colour
        // over burgundy, which came out muddy and put the one thing worth reading at the
        // lowest contrast in the bar.
        //
        // --brand-soft / --brand-on-soft is a checked pair (7.31) in both themes.
        className="flex max-w-[8rem] items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1.5 text-sm font-medium text-brand-on-soft shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 sm:max-w-[14rem] sm:px-3"
        title={`Viewing ${active.familyName} — click to switch family`}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {isPending ? t('switcher.switching') : active.familyName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <div
            className={HEADER_PANEL_SCRIM_CLASS}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Below sm this is a sheet pinned under the header rather than a dropdown
              hanging off the trigger — capping the width was not enough, because the
              panel was anchored to a button already well inside the right edge. See
              header-panel.ts. */}
          <div ref={panel} role="menu" className={cn(HEADER_PANEL_CLASS, 'sm:w-64')}>
            <p className="shrink-0 border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('switcher.heading')}
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {families.map(family => (
                <li key={family.familyCode}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(family.familyCode)}
                    disabled={isPending}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-60',
                      family.isActive ? 'bg-brand-soft font-medium text-brand-on-soft' : 'hover:bg-muted',
                    )}
                  >
                    <Check
                      className={cn('h-4 w-4 shrink-0', family.isActive ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="min-w-0 flex-1 truncate">{family.familyName}</span>
                    {/* Same badge, same word as My Families. Switching to a family that
                        has not admitted you is allowed — set_active_family() checks
                        membership, not approval — and it lands on the awaiting-approval
                        screen, so the badge is what makes that a choice rather than a
                        surprise. It matters most for the account this menu exists for:
                        one waiting on two families at once. */}
                    {/* A REMOVED FAMILY STAYS IN THIS LIST, badged. The alternative —
                        dropping it — takes away the only route back to the screen that
                        explains what happened to it, and a family disappearing from the
                        switcher with no account of itself is the "the product is broken"
                        conclusion 20260817000006 chose to keep set_active_family() open in
                        order to avoid. Selecting it lands on the notice screen, so the
                        badge is what makes that a choice rather than a surprise — exactly
                        the argument the Pending badge below carries.

                        `--brand-withheld`, not `--destructive`: nothing has been deleted.
                        Tested positively for 'active', like every gate on this column. */}
                    {family.familyStatus !== 'active' && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-withheld"
                        title={t('switcher.badge.removed')}
                      >
                        <PowerOff className="h-3 w-3" /> Removed
                      </span>
                    )}
                    {family.status === 'pending' && (
                      <span
                        // --brand-accent, not text-amber-700. The amber was a raw
                        // Tailwind palette colour — not a hex, so the ban in AGENTS.md
                        // did not literally catch it, but equally untokenised and equally
                        // invisible to a rebrand. It also had no dark treatment: amber-700
                        // on the dark card was the muddiest thing in the panel. The accent
                        // role IS the attention marker, and it resolves to gold in dark.
                        className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-accent"
                        title={t('switcher.badge.pending')}
                      >
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                    {family.isDefault && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        title={t('switcher.badge.default')}
                      >
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {/* NOT `FormError`, and deliberately the one place in the app that is true.
                This message is the panel's own footer — full-bleed, ruled off the list
                above it, and `shrink-0` inside the panel's flex column. The shared
                component is an inset alert with its own radius and border, which inside
                a bordered dropdown reads as a box in a box and leaves the panel's bottom
                corners showing through behind it. */}
            {error && (
              <p role="alert" className="shrink-0 border-t bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
