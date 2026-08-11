'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Star, Check, Eye, Clock, Ban } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
// switchActiveFamily is no longer called from here — the navbar FamilySwitcher owns
// switching now that "View this family" is gone.
import { setDefaultFamily } from '@/app/actions/family'
import { JoinFamilyDialog } from '@/components/my-families/JoinFamilyDialog'
import { CreateFamilyDialog } from '@/components/my-families/CreateFamilyDialog'
import { InviteMemberDialog } from '@/components/invitations/InviteMemberDialog'
import type { FamilyMembership } from '@/lib/auth/family'
import { cn } from '@/lib/utils'

/**
 * Every family this account belongs to, which one is being viewed, and which one
 * opens on login.
 *
 * The switching controls only appear for multi-family accounts — with a single
 * membership there is nothing to choose between, and "open on login" would be a
 * button that changes nothing. The family itself is still listed, because the
 * family code shown here is worth being able to look up either way. (This used to
 * render as a card inside My Profile and returned null below two families; as its
 * own page it always renders, or a direct visit would be a blank screen.)
 *
 * That last decision is what makes Join reachable: a single-family account renders
 * this section, so the button below is on screen for the people most likely to need
 * it. A membership awaiting approval is listed like any other and badged Pending, with
 * every action withheld — it cannot be made the login default, and it cannot be invited
 * into. The row is there to say "you asked, they have not answered", and nothing else.
 */
export function MyFamiliesSection({ families }: { families: FamilyMembership[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [error, setError] = useState('')
  const [pendingCode, setPendingCode] = useState('')
  const [isPending, startTransition] = useTransition()

  const multi = families.length > 1

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Home className="h-4 w-4" /> My Families
        </CardTitle>
        <CardDescription>
          {multi
            ? <>Your profile details are shared across every family you belong to. Choose which
                one opens when you log in, or switch the family you&apos;re viewing now.</>
            : <>The family this account belongs to. Your profile details are shared across every
                family you join.</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {families.map(family => {
          const busy = isPending && pendingCode === family.familyCode
          const approved = family.status === 'approved'
          return (
            <div
              key={family.familyCode}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
                family.isActive ? 'border-brand-primary/40 bg-brand-soft/60' : 'bg-card',
                !approved && 'opacity-90',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{family.familyName}</span>
                  {family.status === 'pending' && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                  {family.status === 'rejected' && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Ban className="h-3 w-3" /> Declined
                    </span>
                  )}
                  {family.isActive && approved && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-primary">
                      <Eye className="h-3 w-3" /> Viewing
                    </span>
                  )}
                  {family.isDefault && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Family Code: <span className="font-mono">{family.familyCode}</span>
                </p>
              </div>

              {/* Every APPROVED membership, viewed or not — since 20260806000014 the
                  invitation carries its own target family instead of being addressed to
                  whichever one you happen to be looking at. These are never
                  pre-approved: an ordinary member is not deciding who gets in, and for a
                  family you are not currently viewing the database refuses pre-approval
                  outright, because permissions only resolve for the active family.

                  NOT RENDERED for a family that has not admitted you, rather than
                  rendered and hidden with a class. You cannot invite anyone into a room
                  you are still waiting outside of — create_family_invitation() looks for
                  the caller's APPROVED people row in the target family and refuses when
                  there is none, so a hidden button was a control that existed, sat in the
                  DOM and the RSC payload, and answered "You are not an approved member of
                  that family" to anyone who un-hid it. A pending row shows its badge and
                  no actions at all. */}
              {approved && (
                <div className="flex shrink-0 items-center gap-2">
                  <InviteMemberDialog
                    label="Invite Member"
                    className="px-2.5 py-1 text-xs"
                    familyCode={family.familyCode}
                    familyName={family.familyName}
                  />
                </div>
              )}

              {/* "View this family" used to live here. Removed — the navbar
                  FamilySwitcher does the same job from every page, so this was a second
                  control for one action, and the only one that had to be found first. */}
              <div className={cn('shrink-0 items-center gap-2', multi && approved ? 'flex' : 'hidden')}>
                <button
                  type="button"
                  disabled={isPending || family.isDefault}
                  onClick={() => run(family.familyCode, {
                    title: 'Change default family',
                    // The label is just "Default", which does not say default *what* —
                    // so the confirmation is where that gets spelled out.
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
                  {/* The label is "Default" in both states; the icon and the disabled
                      styling are what distinguish "is the default" from "make it the
                      default". busy cannot be true while isDefault, because the button
                      is disabled then. */}
                  {busy ? 'Saving…' : 'Default'}
                </button>
              </div>
            </div>
          )
        })}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {/* Right-aligned, and wrapping rather than shrinking: two buttons plus their
            labels do not fit beside each other on a narrow phone. */}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <CreateFamilyDialog />
          <JoinFamilyDialog />
        </div>
      </CardContent>
    </Card>
  )
}
