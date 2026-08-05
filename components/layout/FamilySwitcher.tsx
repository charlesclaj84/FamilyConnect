'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Home, Star } from 'lucide-react'
import { switchActiveFamily } from '@/app/actions/family'
import type { FamilyMembership } from '@/lib/auth/family'
import { cn } from '@/lib/utils'

/**
 * Switches which family the user is acting in. Rendered only when the account
 * belongs to more than one — a single-family user sees nothing.
 *
 * The switch is server state (see set_active_family), so after it lands we
 * refresh rather than update locally: every family-scoped query on the page,
 * including the sidebar and navbar, has to be re-fetched.
 */
export function FamilySwitcher({ families }: { families: FamilyMembership[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

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
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="menu"
        className="flex max-w-[11rem] items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-sm text-[#0f2540] transition-colors hover:bg-white disabled:opacity-60 sm:max-w-[14rem]"
        title={`Viewing ${active.familyName} — click to switch family`}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {isPending ? 'Switching…' : active.familyName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border bg-card shadow-lg"
          >
            <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your families
            </p>
            <ul className="py-1">
              {families.map(family => (
                <li key={family.familyCode}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(family.familyCode)}
                    disabled={isPending}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:opacity-60',
                      family.isActive ? 'bg-[#e6ecfa] font-medium text-[#0f2540]' : 'hover:bg-muted',
                    )}
                  >
                    <Check
                      className={cn('h-4 w-4 shrink-0', family.isActive ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="min-w-0 flex-1 truncate">{family.familyName}</span>
                    {family.isDefault && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        title="Opens when you log in"
                      >
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <p className="border-t bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
