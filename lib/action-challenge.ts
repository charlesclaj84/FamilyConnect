import { createHash, randomInt } from 'node:crypto'

import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * The emailed six-digit code that stands in front of an irreversible act.
 *
 * ── ONE MECHANISM, BECAUSE THERE IS NOW MORE THAN ONE ACT ──────────────────────────
 * Removing a family has been behind a code since 20260817000006. Disconnecting a family's
 * Stripe account joined it on 2026-08-25, and the second use is what turned a flow inside
 * `app/actions/admin/family.ts` into this module — the same move `lib/chapter-propagation.ts`
 * made when a second screen needed the propagation: a MODULE, not a correct implementation
 * beside a drifting copy of it.
 *
 * What is shared is everything that has a rule in it — the hash, the digits, the lifetime,
 * and the supersede-then-insert that keeps exactly one code live per (family, person,
 * purpose). What is NOT shared is the grant check, the email and whatever else the act needs
 * to say, because those are the parts that genuinely differ.
 *
 * ── WHAT IT IS AND IS NOT ──────────────────────────────────────────────────────────
 * It proves the person holding this session also holds the mailbox. It does NOT authorise
 * anything: the grant is what does that, and every caller resolves one before reaching here.
 * A code without a grant opens nothing.
 *
 * ── THE VERIFICATION IS IN SQL AND MUST STAY THERE ─────────────────────────────────
 * `consume_family_action_challenge()` does the read-modify-write under `FOR UPDATE` in one
 * statement. Verifying in TypeScript would race itself — two tabs, or one double click, and
 * the same challenge is spent twice or a wrong guess and a right one interleave so only one
 * of two failures is counted. That function also owns the attempt cap, the expiry and the
 * single use, so no rewrite of a calling action can forget one of them. This module mints;
 * it deliberately does not verify.
 */

/** Which irreversible act a code is for. Mirrors the CHECK on `purpose`. */
export type ChallengePurpose = 'family_removal' | 'processor_disconnect'

/**
 * How long a code lasts, in minutes.
 *
 * ONE CONSTANT, read by the insert AND interpolated into the email and the screen, so the
 * lifetime somebody is told cannot disagree with the one the row carries. Fifteen is long
 * enough to find the message on a phone and short enough that a code left in an inbox is not
 * a standing key to the act.
 */
export const CHALLENGE_CODE_MINUTES = 15

/** SHA-256 hex, matching `encode(digest(code,'sha256'),'hex')` in the database. */
export function hashChallengeCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/**
 * Six digits, from a CSPRNG.
 *
 * `randomInt` rather than `Math.random()`, which is not one — and the range is stated as
 * [100000, 1000000) so every code is six digits rather than occasionally five with a leading
 * zero the reader would drop.
 */
function sixDigits(): string {
  return String(randomInt(100_000, 1_000_000))
}

export type MintedChallenge =
  | { ok: true; code: string; minutes: number }
  | { ok: false }

/**
 * Supersede anything still open for this (family, person, purpose), then mint a fresh code.
 *
 * ── THE SUPERSEDE IS NOT TIDYING ───────────────────────────────────────────────────
 * Without it, asking twice leaves two live codes and the older one keeps working. The
 * verification takes the NEWEST unspent challenge, so the stale row is unreachable rather
 * than dangerous — but a code somebody has in their inbox and cannot use is worse than one
 * that has visibly expired.
 *
 * ── AND THE PURPOSE CONJUNCT IS LOAD-BEARING ON BOTH STATEMENTS ────────────────────
 * On the supersede, because asking for a removal code must not silently cancel a live
 * disconnect code the same administrator is midway through using. On the insert, because
 * `purpose` has no DEFAULT in the database — deliberately, so a caller that forgot could not
 * mint a removal code by accident.
 *
 * ── IT RETURNS THE CODE, AND THE CALLER MUST NOT RETURN IT ONWARDS ─────────────────
 * The digits exist in this process only so it can compose an email. A caller that handed them
 * back to the browser would give one person both factors and make the whole gate a formality
 * — which is exactly where this parts company with `inviteMember`, whose token is for
 * somebody ELSE and has to be recoverable when the send fails.
 *
 * `{ ok: false }` with NO MESSAGE: every failure here is ours (a refused write), the caller
 * has already logged the detail, and the sentence a member reads belongs to the caller.
 */
export async function mintChallenge(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    familyCode: string
    /** The caller's `people.id`. The challenge is resolved on it, so it cannot be null. */
    personId: string
    purpose: ChallengePurpose
    /** Prefix for the two log lines, e.g. `[processing]`. */
    logTag: string
  },
): Promise<MintedChallenge> {
  const { familyCode, personId, purpose, logTag } = input

  const { error: supersedeError } = await admin
    .from('family_action_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('family_code', familyCode)
    .eq('requested_by', personId)
    .eq('purpose', purpose)
    .is('consumed_at', null)
  if (supersedeError) {
    console.error(`${logTag} could not close open ${purpose} challenges for ${familyCode}: ${supersedeError.message}`)
    return { ok: false }
  }

  const code = sixDigits()
  const { error: insertError } = await admin
    .from('family_action_challenges')
    .insert({
      family_code: familyCode,
      requested_by: personId,
      purpose,
      code_hash: hashChallengeCode(code),
      expires_at: new Date(Date.now() + CHALLENGE_CODE_MINUTES * 60_000).toISOString(),
    })
  if (insertError) {
    console.error(`${logTag} could not mint a ${purpose} challenge for ${familyCode}: ${insertError.message}`)
    return { ok: false }
  }

  return { ok: true, code, minutes: CHALLENGE_CODE_MINUTES }
}

/**
 * Mint a staff family-deletion code.
 *
 * ── A SECOND MINT, NOT A SECOND MECHANISM ──────────────────────────────────────────
 * It shares `sixDigits()`, `hashChallengeCode()` and `CHALLENGE_CODE_MINUTES` with
 * `mintChallenge` above — the three decisions that must not differ between two codes a
 * reader cannot tell apart. What differs is the ACTOR and therefore the table:
 * `family_action_challenges` resolves on a `people.id`, and a GENORRA staff member has none
 * in the family they are acting on. `20260831000001` §1 argues why that is a different table
 * rather than a nullable column on the shared one.
 *
 * ── THE SUPERSEDE IS NOT TIDYING, FOR `mintChallenge`'s REASON ─────────────────────
 * Without it, asking twice leaves two live codes and the older one keeps working — so a code
 * an owner abandoned because they were not sure they had the right family stays spendable.
 */
export async function mintStaffDeleteChallenge(
  admin: ReturnType<typeof createAdminClient>,
  input: { userId: string; familyCode: string; logTag: string },
): Promise<MintedChallenge> {
  const { userId, familyCode, logTag } = input

  const { error: supersedeError } = await admin
    .from('genorra_staff_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('family_code', familyCode)
    .is('consumed_at', null)
  if (supersedeError) {
    console.error(`${logTag} could not close open staff challenges for ${familyCode}: ${supersedeError.message}`)
    return { ok: false }
  }

  const code = sixDigits()
  const { error: insertError } = await admin
    .from('genorra_staff_challenges')
    .insert({
      user_id: userId,
      family_code: familyCode,
      code_hash: hashChallengeCode(code),
      expires_at: new Date(Date.now() + CHALLENGE_CODE_MINUTES * 60_000).toISOString(),
    })
  if (insertError) {
    console.error(`${logTag} could not mint a staff challenge for ${familyCode}: ${insertError.message}`)
    return { ok: false }
  }

  return { ok: true, code, minutes: CHALLENGE_CODE_MINUTES }
}
