import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilyCode } from '@/lib/auth/family'
import { DEFAULT_CURRENCY } from '@/lib/currency-utils'

/**
 * What currency the family being viewed keeps its books in.
 *
 * The server counterpart to `lib/currency-utils.ts`, and the deliberate twin of
 * `lib/auth/tier.ts` — same shape, same client, same caching, same argument for each. Read
 * that file's header first; what follows is only what differs.
 *
 * ── A CURRENCY IS NOT A PERMISSION AND NOT A TIER ───────────────────────────────────
 * It withholds nothing and grants nothing. No RLS policy consults `families.currency` and
 * `20260901000000` §6 asserts none does — the same assertion `20260817000006` makes about
 * `families.status`, and for the same reason: a family's access must not depend on a fact
 * about their money. What this decides is which SYMBOL a figure carries, which is a display
 * fact with one exception, and the exception is the whole reason it lives on the server:
 * `app/actions/pay-dues.ts` puts it on a real Stripe charge.
 *
 * ── WHY THE ADMIN CLIENT ────────────────────────────────────────────────────────────
 * `getMyFamilyTier`'s reason, verbatim: a PENDING member resolves to no person, so every
 * policy behind `families` matches nothing for them and the user client would answer USD for
 * a Mexican family. That answer would then reach the awaiting-approval screen. Family scoping
 * is hand-applied per AGENTS.md §3, from the caller's OWN membership and never from an
 * argument, so §4 has no id to check.
 *
 * ── THE FALLBACK IS USD, AND UNLIKE THE TIER'S IT IS NOT "SAFE" ─────────────────────
 * `DEFAULT_TIER` falls back to Free, which withholds only what somebody has paid for. There
 * is no equivalent direction here: a wrong currency is a wrong LABEL on a right number, and
 * for one caller it is a wrong CHARGE. So the fallback is USD because that is what every
 * family created before `20260901000000` genuinely is — not because it is harmless — and the
 * `console.error` below is the whole of what stops a schema drift being silent. A Mexican
 * family reading dollar signs looks exactly like an American one.
 *
 * ── AND `pay-dues` MUST NOT USE THE FALLBACK PATH SILENTLY ──────────────────────────
 * `familyCurrencyOrFail` is the second export for exactly that: a charge composed against a
 * guessed currency is money moving in the wrong denomination, which no log recovers. A read
 * that could not answer refuses there rather than presenting a hosted page.
 */
export const getMyFamilyCurrency = cache(async (userId: string): Promise<string> => {
  if (!userId) return DEFAULT_CURRENCY.toLowerCase()

  const familyCode = await getMyFamilyCode(userId)
  if (!familyCode) return DEFAULT_CURRENCY.toLowerCase()

  return getFamilyCurrency(familyCode)
})

/**
 * The currency of one family by code, and the country its account settles in.
 *
 * Separate from the caller-scoped version for `getFamilyTier`'s reason: `/my-families` lists
 * several at once. Callers owe what they always owe a code that did not come from
 * `getMyFamilies()` — proof that it is the caller's. This function is handed a string and
 * cannot check.
 *
 * `null` means the read FAILED, distinctly from a family that does not exist, which is what
 * lets `familyCurrencyOrFail` refuse rather than guess. AGENTS.md §8: `const { data }` alone
 * would make a refused query indistinguishable from a family in dollars.
 */
export const getFamilyMoney = cache(async (
  familyCode: string,
): Promise<{ currency: string; country: string } | null> => {
  if (!familyCode) return null

  const { data, error } = await createAdminClient()
    .from('families')
    .select('currency, connect_country')
    .eq('family_code', familyCode)
    .maybeSingle()

  // THE ERROR IS READ RATHER THAN DISCARDED (AGENTS.md §8), and the two outcomes mean
  // different things. No row is a family that does not exist. A refused query is most likely
  // a database that has not had 20260901000000 applied — PostgREST answers 42703 for a column
  // that is not there and kills the WHOLE query, which is the failure that took every page in
  // the app to 404 during Phase 3.
  if (error) {
    console.error(
      `[currency] could not read families.currency for ${familyCode}: ${error.message}. ` +
      'Every figure will be labelled USD until this is fixed, and Pay Online will refuse. ' +
      'If this is "column ... does not exist", the app is running against a database that is ' +
      'behind supabase/migrations — check `npx supabase migration list --linked`.',
    )
    return null
  }

  const row = data as { currency?: string; connect_country?: string } | null
  if (!row) return null

  return {
    currency: (row.currency ?? DEFAULT_CURRENCY).toLowerCase(),
    country: row.connect_country ?? 'us',
  }
})

/** The currency alone, falling back to dollars. For a FIGURE ON A SCREEN. */
export const getFamilyCurrency = cache(async (familyCode: string): Promise<string> => {
  return (await getFamilyMoney(familyCode))?.currency ?? DEFAULT_CURRENCY.toLowerCase()
})

/**
 * The currency, or `null` if it genuinely could not be established.
 *
 * FOR A CALLER THAT IS ABOUT TO MOVE MONEY, and the only difference from the above is that it
 * does not guess. `app/actions/pay-dues.ts` and `startProcessorOnboarding` use this; a screen
 * printing a figure does not, because refusing to render a whole page over a transient
 * PostgREST failure is worse than a figure whose symbol is wrong for one load.
 */
export async function familyCurrencyOrFail(familyCode: string): Promise<string | null> {
  return (await getFamilyMoney(familyCode))?.currency ?? null
}
