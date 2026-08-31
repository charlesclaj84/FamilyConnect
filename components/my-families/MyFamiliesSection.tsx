'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Star, Check, Eye, Clock, Ban, PowerOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm, type ConfirmOptions } from '@/components/ui/confirm'
import { FormError } from '@/components/ui/form-message'
// switchActiveFamily is no longer called from here — the navbar FamilySwitcher owns
// switching now that "View this family" is gone.
import { setDefaultFamily } from '@/app/actions/family'
import { JoinFamilyDialog } from '@/components/my-families/JoinFamilyDialog'
import { CreateFamilyDialog } from '@/components/my-families/CreateFamilyDialog'
import { InviteMemberDialog } from '@/components/invitations/InviteMemberDialog'
import type { FamilyMembership } from '@/lib/auth/family'
import { cn } from '@/lib/utils'
import { useT } from '@/components/layout/LocaleProvider'

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
  const t = useT()
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
      else setError(result.message ?? t('meet.wentWrong'))
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Home className="h-4 w-4" /> {t('fam.heading')}
        </CardTitle>
        <CardDescription>
          {multi
            ? <>{t('ui.profileDetailsSharedAcross')}</>
            : <>{t('ui.familyAccountBelongsProfile')}</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {families.map(family => {
          const busy = isPending && pendingCode === family.familyCode
          const approved = family.status === 'approved'
          // LISTED, NEVER HIDDEN. Dropping a removed family from this page would take the
          // one screen that could explain what happened to it and make the family vanish
          // with no account of itself — which is exactly the conclusion "the product is
          // broken" that 20260817000006 chose to allow the switch in order to avoid.
          // Tested positively for 'active', like every other gate on this column.
          const removed = family.familyStatus !== 'active'
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
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-legacy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-legacy">
                      <Clock className="h-3 w-3" /> {t('fam.pending')}
                    </span>
                  )}
                  {/* `--brand-withheld`, not `--destructive`: the family is switched off
                      and every record it holds is untouched, so the alarm colour would be
                      describing something that has not happened. Foreground on a tint of
                      itself, because that token has no `on-` partner by design. */}
                  {removed && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-withheld/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-withheld">
                      <PowerOff className="h-3 w-3" /> {t('fam.removed')}
                    </span>
                  )}
                  {family.status === 'rejected' && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Ban className="h-3 w-3" /> {t('fam.declined')}
                    </span>
                  )}
                  {family.isActive && approved && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-on-primary">
                      <Eye className="h-3 w-3" /> {t('fam.viewing')}
                    </span>
                  )}
                  {family.isDefault && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Star className="h-3 w-3" /> {t('fam.default')}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('fam.familyCode')} <span className="font-mono">{family.familyCode}</span>
                </p>
                {/* SAID HERE AS WELL AS ON THE NOTICE SCREEN, because this page is the one
                    a multi-family account reaches without ever selecting the removed
                    family — the badge alone would leave "removed" meaning whatever they
                    guessed. Nothing is deleted is the half people do not assume. */}
                {removed && (
                  <p className="mt-1 text-xs text-muted-foreground">{t('ui.switchedOffAdministratorNothing')}</p>
                )}
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
                  no actions at all.

                  AND NOT FOR A REMOVED FAMILY EITHER, for a reason 20260817000006 records
                  as a known gap rather than closing in SQL: `create_family_invitation()`
                  will still MINT an invitation into a removed family, while every door
                  that would redeem one is shut — so the button produces a dead link and a
                  relative told to expect an email that leads nowhere. That migration says
                  "the app layer is where a member is told the family is gone before they
                  get as far as inviting somebody to it"; this is that line. */}
              {approved && !removed && (
                <div className="flex shrink-0 items-center gap-2">
                  <InviteMemberDialog
                    label={t('fam.inviteMember')}
                    className="px-2.5 py-1 text-xs"
                    familyCode={family.familyCode}
                    familyName={family.familyName}
                  />
                </div>
              )}

              {/* "View this family" used to live here. Removed — the navbar
                  FamilySwitcher does the same job from every page, so this was a second
                  control for one action, and the only one that had to be found first.

                  `!removed` for the same reason the invite button is withheld: opening on
                  login into a family that can only render a notice screen is not a default
                  anybody would choose deliberately. */}
              <div className={cn('shrink-0 items-center gap-2', multi && approved && !removed ? 'flex' : 'hidden')}>
                <button
                  type="button"
                  disabled={isPending || family.isDefault}
                  onClick={() => run(family.familyCode, {
                    title: t('fam.changeDefault'),
                    // The label is just "Default", which does not say default *what* —
                    // so the confirmation is where that gets spelled out.
                    description: t('fam.openByDefault', { family: family.familyName }),
                    confirmLabel: t('fam.makeDefault'),
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
                  {busy ? t('action.saving') : t('fam.default')}
                </button>
              </div>
            </div>
          )
        })}

        <FormError message={error} />

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
