import Link from 'next/link'
import { CreditCard, Lock } from 'lucide-react'

import { PageShell } from '@/components/layout/PageShell'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type T } from '@/lib/i18n/t'
import type { BillingLockout } from '@/lib/auth/billing-lockout'
import type { FamilyMembership } from '@/lib/auth/family'

/**
 * What somebody sees when their family is behind on its bill.
 *
 * ── TWO READERS, AND THEY MUST NOT BE TOLD THE SAME THING ──────────────────────────
 * Decided 2026-08-23 and stated as a requirement in its own right: **a member must not be
 * told it is a money problem in detail.** *"Contact your family administrator to resolve an
 * accounting issue"* is the whole message — what the family owes GENORRA is not every
 * relative's business, and a card decline is a fact about one person's bank.
 *
 * Whoever can actually pay gets the opposite: the figure, the deadline, and a button. There is
 * no version of this screen that helps them by being vague.
 *
 * ── AND THE DELETION WARNING IS NOT SOFTENED ──────────────────────────────────────
 * From day 30 the administrator's copy says the records will be deleted and that it cannot be
 * reversed, in those words — the brief states that requirement twice, which is how it survives
 * a summary. The member's copy never mentions it: they can do nothing about it, and telling a
 * relative their family tree is about to be destroyed by somebody else's card is alarm without
 * a remedy.
 *
 * ── IT IS NOT A DEAD END FOR A MULTI-FAMILY ACCOUNT ───────────────────────────────
 * `FamilyRemoved`'s rule, and the same reason: somebody who belongs to two families has lost
 * nothing and the screen must not read as though they have. `my-families` is on
 * `BILLING_LOCKOUT_RESOURCES` precisely so this link works.
 *
 * NOTHING ABOUT THE FAMILY IS FETCHED HERE. The stage, the days and the caller's own grant all
 * come from `billingLockout`, which the guard already resolved for this request.
 */
export function BillingLocked({ membership, lock, families, t }: {
  membership: FamilyMembership
  lock: BillingLockout
  families: readonly FamilyMembership[]
  t: T
}) {
  const others = families.filter(f => f.familyCode !== membership.familyCode)
  // FROM DAY 30 THE STAKES ARE NAMED, and not before. On day 10 the honest message is that
  // access is limited; leading with deletion five weeks early is alarm rather than information.
  const warns = lock.stage === 'admins-locked' || lock.stage === 'due-for-drop'

  return (
    <PageShell className="space-y-6">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Lock className="mx-auto h-8 w-8 text-brand-withheld" aria-hidden="true" />

        {lock.canPay ? (
          <>
            <h1 className="text-2xl text-brand-ink">{t('lock.admin.heading')}</h1>
            <p className="text-sm text-muted-foreground">
              {t(lock.stage === 'members-locked' ? 'lock.admin.p1Members' : 'lock.admin.p1All',
                { family: membership.familyName })}
            </p>
            {/* NOTHING HAS BEEN DELETED YET, said before the warning. A person reading this is
                deciding whether it is already too late, and the answer until day 60 is no. */}
            <p className="text-sm text-muted-foreground">{t('lock.admin.nothingLost')}</p>
            {warns && lock.daysLeft != null && (
              <p className="text-sm font-medium text-brand-withheld">
                {t(lock.daysLeft === 1 ? 'lock.admin.warnOne' : 'lock.admin.warnMany',
                  { days: String(lock.daysLeft) })}
              </p>
            )}
            <Link href="/admin/settings" className={cn(buttonVariants(), 'gap-2')}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {t('lock.admin.button')}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-brand-ink">{t('lock.member.heading')}</h1>
            {/* THE WHOLE MESSAGE. No figure, no deadline, no mention of deletion — see the
                header. It names an "accounting issue" rather than a failed payment, because
                the second is a fact about somebody else's bank. */}
            <p className="text-sm text-muted-foreground">
              {t('lock.member.p1', { family: membership.familyName })}
            </p>
            <p className="text-sm text-muted-foreground">{t('lock.member.p2')}</p>
          </>
        )}

        {others.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('lock.otherFamilies')}{' '}
            <Link href="/my-families" className="underline">{t('lock.myFamilies')}</Link>
          </p>
        )}
      </div>
    </PageShell>
  )
}
