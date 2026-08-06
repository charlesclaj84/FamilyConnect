'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Star, Check, Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
import { switchActiveFamily, setDefaultFamily } from '@/app/actions/family'
import type { FamilyMembership } from '@/lib/auth/family'
import { cn } from '@/lib/utils'

/**
 * Every family this account belongs to, which one is being viewed, and which one
 * opens on login. Hidden for single-family accounts, where there is nothing to
 * choose between.
 */
export function MyFamiliesSection({ families }: { families: FamilyMembership[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [pendingCode, setPendingCode] = useState('')
  const [isPending, startTransition] = useTransition()

  if (families.length < 2) return null

  // Switching which family you are *viewing* is navigation and passes null;
  // changing the login default edits a stored preference, so it confirms.
  async function run(
    familyCode: string,
    confirmWith: ConfirmOptions | null,
    action: () => Promise<{ success: boolean; message?: string }>,
  ) {
    if (confirmWith && !(await confirm(confirmWith))) return
    setError('')
    setPendingCode(familyCode)
    startTransition(async () => {
      const result = await action()
      setPendingCode('')
      if (result.success) router.refresh()
      else setError(result.message ?? 'Something went wrong.')
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Home className="h-4 w-4" /> My Families
        </CardTitle>
        <CardDescription>
          Your profile details are shared across every family you belong to. Choose which
          one opens when you log in, or switch the family you&apos;re viewing now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {families.map(family => {
          const busy = isPending && pendingCode === family.familyCode
          return (
            <div
              key={family.familyCode}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
                family.isActive ? 'border-[#0f2540]/40 bg-[#e6ecfa]/60' : 'bg-card',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{family.familyName}</span>
                  {family.isActive && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0f2540] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#e6ecfa]">
                      <Eye className="h-3 w-3" /> Viewing
                    </span>
                  )}
                  {family.isDefault && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Star className="h-3 w-3" /> Login default
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Family Code: <span className="font-mono">{family.familyCode}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!family.isActive && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(family.familyCode, null, () => switchActiveFamily(family.familyCode))}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    {busy ? 'Switching…' : 'View this family'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending || family.isDefault}
                  onClick={() => run(family.familyCode, {
                    title: 'Change login default',
                    description: `Open ${family.familyName} by default when you log in?`,
                    confirmLabel: 'Make default',
                  }, () => setDefaultFamily(family.familyCode))}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                    family.isDefault
                      ? 'bg-muted text-muted-foreground'
                      : 'border hover:bg-muted',
                  )}
                >
                  {family.isDefault ? <Check className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                  {family.isDefault ? 'Opens on login' : busy ? 'Saving…' : 'Open on login'}
                </button>
              </div>
            </div>
          )
        })}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
