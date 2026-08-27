import Link from 'next/link'
import { PowerOff } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { isActiveFamily, isApproved, type FamilyMembership } from '@/lib/auth/family'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * What a member sees when the family they are viewing has been removed.
 *
 * ── WHY THIS SCREEN EXISTS AT ALL ───────────────────────────────────────────────────
 * `20260817000006`'s header settles the question it answers: the removal test is
 * deliberately NOT in `auth_family_code()`, because that resolver is `LIMIT 1` over an
 * `ORDER BY` and a conjunct there would SKIP to the next family rather than hide this one
 * — silently moving a two-family member into a family they did not choose, and putting the
 * app and RLS into the one disagreement this schema cannot be reasoned about from either
 * side. `set_active_family()` is left alone for the same reason: refusing the switch would
 * report "not a member", which is false.
 *
 * So the enforcement is app-layer, and this is it. A member of a removed family can still
 * select it, and what they get is a sentence explaining what happened rather than a 404, an
 * empty dashboard, or a rail full of pages that answer nothing.
 *
 * ── IT SAYS THE THREE THINGS SOMEBODY IN THIS POSITION ACTUALLY NEEDS ───────────────
 * What has happened, what has NOT (nothing is deleted — and a member watching their
 * family's whole record disappear from view will assume the opposite unless told), and who
 * can undo it. The last one is honest rather than hopeful: restoration is a GENORRA support
 * action and there is no button anywhere in the product for it, because a family that can
 * un-remove itself has not been removed.
 *
 * ── IT IS NOT A DEAD END FOR A MULTI-FAMILY ACCOUNT ─────────────────────────────────
 * Somebody who belongs to two families and happened to be looking at the removed one has
 * lost nothing, and the screen must not read as though they have. Their other families are
 * named, with the switcher in the top bar and My Families both one step away.
 *
 * NOTHING ABOUT THE FAMILY IS FETCHED. Every value here comes from the caller's own
 * memberships, which `getMyFamilies` already resolved for the shell — so this renders no
 * family data at all, which is the right shape for a screen shown to somebody whose family
 * has been switched off.
 */
export function FamilyRemoved({ membership, families }: {
  membership: FamilyMembership
  families: FamilyMembership[]
}) {
  const t = useT()
  // APPROVED and ACTIVE, both tested positively. A pending membership in another family is
  // not somewhere to send them, and a second removed one is this screen again.
  const elsewhere = families.filter(
    f => f.familyCode !== membership.familyCode
      && isApproved(f.status)
      && isActiveFamily(f.familyStatus),
  )

  return (
    <PageShell width="reading" className="space-y-6">
      <div className="flex items-start gap-4">
        <span
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-withheld/10"
          aria-hidden="true"
        >
          <PowerOff className="h-5 w-5 text-brand-withheld" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {membership.familyName} has been removed
          </h1>
          <p className="mt-2 text-muted-foreground">
            An administrator of this family switched it off. Nobody can open it, join it or
            accept an invitation to it.
          </p>
        </div>
      </div>

      {/* THE REASSURANCE IS A SECTION OF ITS OWN, not a clause. It is the single most
          important thing on this screen and the thing somebody in this position least
          expects to be true. */}
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{t('rem.nothingDeleted')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment, fund, photograph, event, message, document and person is exactly
          where it was. Removing a family closes its doors; it destroys no records at all,
          and it did not touch your account or any other family you belong to.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Only GENORRA support can bring a family back — there is no button for it anywhere
          in the product, on purpose. If this was not meant, ask whoever administers the
          family to get in touch with support.
        </p>
      </section>

      {elsewhere.length > 0 && (
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">
            {elsewhere.length === 1 ? t('rem.otherFamily') : t('rem.otherFamilies')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch with the family menu at the top of the page, or from{' '}
            <Link href="/my-families">{t('fam.heading')}</Link>.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {elsewhere.map(f => (
              <li key={f.familyCode} className="font-medium">
                {f.familyName}{' '}
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {f.familyCode}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        <Link href="/my-families">{t('fam.heading')}</Link> is still open to you, and so is the{' '}
        <Link href="/help">manual</Link>.
      </p>
    </PageShell>
  )
}
