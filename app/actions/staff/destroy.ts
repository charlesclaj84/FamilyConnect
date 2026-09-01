'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffOwner } from '@/lib/auth/staff'
import { callerI18n } from '@/lib/i18n/server'
import { sendEmail, emailOrigin } from '@/lib/email/send'
import { staffDeleteCodeEmail } from '@/lib/email/templates'
import { resolveLocale } from '@/lib/auth/locale'
import { hashChallengeCode, mintStaffDeleteChallenge } from '@/lib/action-challenge'
import { cancelEveryFamilySubscription } from '@/lib/stripe/cancel-family'

/**
 * The two things the staff console can permanently destroy.
 *
 * ── EVERY EXPORT HERE IS OWNER-ONLY, AND THAT IS THE FILE'S WHOLE PREMISE ───────────
 * `requireStaffOwner()` on all four, and the SQL functions underneath re-ask through
 * `is_genorra_staff_owner()`. AGENTS.md §2's argument for doing it twice is at its strongest
 * for an act with no undo: a `'use server'` export is a public HTTP endpoint, and the page
 * that renders the button is a convenience. `20260831000001` §4's header carries the
 * database side of the same reasoning.
 *
 * ── WHY IT IS ITS OWN MODULE AND NOT PART OF `staff/families.ts` ───────────────────
 * That module reads the platform and flips one column. This one destroys. Keeping them apart
 * is the same instinct `lib/email/` follows about senders: the shape of a mistake in here is
 * different in kind, so the file is small enough to read in full before touching it, and a
 * `grep` for what can destroy a family has one answer.
 *
 * ── THREE HALVES, AND THE ORDER OF ALL THREE IS LOAD-BEARING ───────────────────────
 * One statement of SQL can only do the last of them, so the deletion is:
 *
 *   1. **STRIPE.** Every recurring charge that exists for this family, stopped —
 *      `lib/stripe/cancel-family.ts`, and see below on why a failure here REFUSES.
 *   2. **THE BYTES.** `storage.protect_delete()` refuses a direct
 *      `DELETE FROM storage.objects` and the objects live in a backend no migration touches.
 *   3. **THE ROWS**, in one statement.
 *
 * One sentence puts 1 and 2 in front of 3, and it is the same sentence both times: **once the
 * rows are gone, nothing can enumerate what belonged to that family.** After `photos` and
 * `documents` are deleted the objects are orphans only a manual sweep of the backend would
 * find; after `dues_autopay` and `platform_billing_accounts` are deleted the only record of
 * which Stripe subscriptions were this family's is at Stripe, and finding them means a person
 * reading a dashboard by hand. `scripts/drop-retired-bucket.mjs` and `20260820000008` had to
 * make exactly this split for the storage half, and that pair's header states the order for
 * the same reason.
 *
 * ── AND STRIPE IS THE ONE OF THE THREE THAT CAN REFUSE THE DELETION ────────────────
 * The storage half reports its failures and presses on: an orphaned object is recoverable by
 * hand, and a storage outage is not a reason to refuse a deletion request. A live subscription
 * is the opposite on both counts — it takes money from somebody every month, and **a charge
 * cannot be un-charged where a deletion can be retried.** So a family whose subscriptions
 * cannot be stopped is not deleted, and the owner is told so.
 */

export type StaffDestroyResult =
  | { success: true; message: string; detail?: string }
  | { success: false; message: string }

/** Which buckets a family's own objects live in, and how they are laid out. */
const FAMILY_BUCKETS = ['photos', 'documents'] as const

/**
 * Ask for the emailed six-digit code that authorises a permanent family deletion.
 *
 * ── THE SAME CODE, A DIFFERENT TABLE, AND THAT IS NOT AN INCONSISTENCY ─────────────
 * Six digits, fifteen minutes, five attempts, single use, hash compared and never addressed —
 * every property a reader of the family-removal code already knows, and all four shared in
 * code through `mintStaffDeleteChallenge`. What cannot be shared is the ROW: the family table
 * resolves a challenge on a `people.id`, and a GENORRA staff member has none in the family
 * they are acting on. `20260831000001` §1 argues why that is a second table rather than a
 * nullable column on the shared one, and what the first draft got wrong.
 *
 * ── AND IT IS EMAILED TO THE OWNER, NOT TO THE FAMILY ──────────────────────────────
 * The family-removal challenge goes to the administrator who asked for it, because it is
 * their family. This one goes to the GENORRA owner acting, because the family is not
 * consenting to this — a support engineer is. Nothing is sent to the family at all, which is
 * a decision rather than an omission: a "your data is about to be destroyed" email from a
 * console whose whole job is to answer a deletion REQUEST would be telling somebody something
 * they already asked for, on the one occasion they cannot act on it.
 */
export async function requestFamilyDeleteCode(familyCode: string): Promise<StaffDestroyResult> {
  const staff = await requireStaffOwner()
  const { t } = await callerI18n(staff.userId)

  const code = (familyCode ?? '').trim().toUpperCase()
  if (!code) return { success: false, message: t('act.enterFamilyCode2') }

  const admin = createAdminClient()
  const { data: family, error: readError } = await admin
    .from('families').select('family_name').eq('family_code', code).maybeSingle()
  // §8: `const { data }` discards the error, and here an unreported failure would tell an
  // owner the family does not exist when the read merely broke.
  if (readError) {
    console.error(`[staff/destroy] could not read ${code}: ${readError.message}`)
    return { success: false, message: t('act.couldNotReadThatFamily') }
  }
  if (!family) return { success: false, message: t('act.noFamilyWithThatCode') }

  // ── THE ACTOR'S OWN ADDRESS, READ FROM `auth.users` ────────────────────────────
  // NOT from a `people` row: a GENORRA staff member has no `people` row in the family they
  // are acting on — that is the whole premise of `genorra_staff` — so there is no
  // family-scoped address to read, and `requestFamilyRemovalCode`'s shape does not transfer.
  const { data: actor, error: actorError } = await admin.auth.admin.getUserById(staff.userId)
  const to = actor?.user?.email
  if (actorError || !to) {
    console.error(`[staff/destroy] no address for owner ${staff.userId}: ${actorError?.message ?? 'no email'}`)
    return { success: false, message: t('act.couldNotEmailYouCode') }
  }

  // ── ITS OWN TABLE, KEYED ON THE ACCOUNT ────────────────────────────────────────
  // `family_action_challenges` resolves on a `people.id` and a staff member has none in the
  // family they are acting on; `20260831000001` §1 argues why that is a second table rather
  // than a nullable column on the shared one. The digits, the hash and the fifteen minutes
  // are shared, which is the part that must not differ between two codes a reader cannot
  // tell apart.
  const minted = await mintStaffDeleteChallenge(admin, {
    userId: staff.userId,
    familyCode: code,
    logTag: '[staff/destroy]',
  })
  if (!minted.ok) return { success: false, message: t('act.couldNotEmailYouCode') }

  const sent = await sendEmail({
    to,
    ...staffDeleteCodeEmail({
      code: minted.code,
      familyCode: code,
      familyName: (family.family_name as string | null) ?? code,
      origin: emailOrigin(),
      locale: await resolveLocale(staff.userId),
    }),
  })
  // `sendEmail` fails soft (AGENTS.md), and a caller must not render success over an email
  // that did not go — the code is useless to somebody who never received it, and the act it
  // guards cannot be completed.
  if (!sent.sent) return { success: false, message: t('act.couldNotEmailYouCode') }

  return { success: true, message: t('act.codeEmailedToYou') }
}

/**
 * Delete a family and everything in it. There is no undo.
 *
 * ── THREE THINGS STAND IN FRONT OF IT, AND EACH ANSWERS A DIFFERENT MISTAKE ────────
 *   `requireStaffOwner()`      a `support` staffer working a ticket cannot do this at all
 *   the family code, typed     the wrong row on a list of a hundred families
 *   the emailed code           somebody at an unlocked screen, and a session that is not
 *                              the owner's
 *
 * The typed code is checked here rather than only in the browser for §2's reason, and the
 * emailed one is checked in SQL by `staff_consume_challenge`, which is one statement under
 * `FOR UPDATE` because a five-branch read-modify-write races itself.
 */
export async function deleteFamilyPermanently(input: {
  familyCode: string
  /** Typed back by the owner. Must match, so a mis-click on a list cannot destroy a family. */
  confirmCode: string
  /** The six digits emailed by `requestFamilyDeleteCode`. */
  emailedCode: string
  /** Why. Required — it is the audit row's whole content besides the counts. */
  note: string
}): Promise<StaffDestroyResult> {
  const staff = await requireStaffOwner()
  const { t } = await callerI18n(staff.userId)

  const code = (input?.familyCode ?? '').trim().toUpperCase()
  const typed = (input?.confirmCode ?? '').trim().toUpperCase()
  const note = (input?.note ?? '').trim()

  if (!code) return { success: false, message: t('act.enterFamilyCode2') }
  if (typed !== code) return { success: false, message: t('act.typeFamilyCodeToConfirm') }
  if (!note) return { success: false, message: t('act.sayWhyFamilyDeleted') }

  const admin = createAdminClient()

  // ── THE EMAILED CODE, SPENT BEFORE ANYTHING IS DESTROYED ───────────────────────
  // Single use, five attempts, fifteen minutes, and the hash is only ever COMPARED — never
  // used to find the row — so a guessed code cannot spend another challenge.
  const { data: consumed, error: consumeError } = await admin
    .rpc('staff_consume_challenge', {
      p_user_id: staff.userId,
      p_family_code: code,
      p_code_hash: hashChallengeCode((input?.emailedCode ?? '').trim()),
    })
  if (consumeError) {
    console.error(`[staff/destroy] challenge check failed for ${code}: ${consumeError.message}`)
    return { success: false, message: t('act.couldNotCheckThatCode') }
  }
  const challenge = (Array.isArray(consumed) ? consumed[0] : consumed) as
    { ok: boolean; message: string | null } | undefined
  if (!challenge?.ok) {
    return { success: false, message: challenge?.message ?? t('act.codeNotRight') }
  }

  // ── HALF ONE: STRIPE. BOTH DIRECTIONS OF MONEY, AND IT CAN REFUSE ─────────────
  // The relatives' standing dues arrangements on the family's own connected account, and the
  // family's own GENORRA subscription on ours. Neither is a row this database can delete, and
  // `staff_delete_family` deletes the rows that NAME them — so this must happen first or the
  // subscriptions become unfindable while still charging cards (module header).
  //
  // UNLIKE THE STORAGE HALF BELOW, A FAILURE HERE IS FATAL. An orphaned object costs a manual
  // sweep; a live subscription takes somebody's money every month and cannot be refunded (rule
  // 2 of "FOUR RULES ABOUT PLANS"). The deletion can be retried — with a new code, since the
  // one just spent is single use, which is the contract `disconnectProcessor` already keeps.
  // `plan: 'now'` — there is no family left to lose the rest of a paid month, and a period-end
  // cancellation would leave the subscription live and emitting events for a family with no
  // rows behind it. `cancel-family.ts` argues both branches; removal takes the other one.
  const stripe = await cancelEveryFamilySubscription(admin, code, { plan: 'now' })
  if (!stripe.ok) {
    console.error(`[staff/destroy] ${code} was NOT deleted: ${stripe.failure}`)
    return { success: false, message: t('act.couldNotStopSubscriptions') }
  }

  // ── HALF TWO: THE BYTES. See the module header on why this is not first ────────
  // A failure here is REPORTED AND NOT FATAL. The alternative is a family that cannot be
  // deleted because one object will not go, and a storage outage is not a reason to refuse a
  // deletion request — so the row sweep proceeds and the detail says what was left. The
  // honest cost is an orphaned object, which is recoverable by hand; refusing would leave a
  // family the platform has been asked to erase.
  const leftover: string[] = []
  for (const bucket of FAMILY_BUCKETS) {
    // Laid out per FAMILY — `<CODE>/…` — which is what `20260820000006` narrowed the write
    // policies to, and is why one prefix is the whole of a family's objects in each bucket.
    const { data: listed, error: listError } = await admin.storage.from(bucket).list(code, {
      limit: 1000,
    })
    if (listError) {
      leftover.push(`${bucket} (${listError.message})`)
      continue
    }
    // `list()` is ONE LEVEL DEEP and reports a folder rather than the files inside it —
    // the trap `tests/rls/raw/storage.mjs` records. So each entry with no `id` is a
    // directory and is walked.
    const paths: string[] = []
    for (const entry of listed ?? []) {
      if (entry.id) { paths.push(`${code}/${entry.name}`); continue }
      const { data: inner } = await admin.storage.from(bucket).list(`${code}/${entry.name}`, {
        limit: 1000,
      })
      for (const file of inner ?? []) paths.push(`${code}/${entry.name}/${file.name}`)
    }
    if (paths.length === 0) continue
    const { error: removeError } = await admin.storage.from(bucket).remove(paths)
    // STORAGE REPORTS A REFUSED `remove()` AS 200 WITH AN EMPTY ARRAY (AGENTS.md), so an
    // error here is a transport failure and a silent refusal is invisible. Nothing better is
    // available from this API; the audit row's counts are what a person reconciles against.
    if (removeError) leftover.push(`${bucket} (${removeError.message})`)
  }

  // ── HALF THREE: THE ROWS, IN ONE STATEMENT ────────────────────────────────────
  const { data, error } = await admin.rpc('staff_delete_family', {
    p_family_code: code,
    p_note: note,
    p_user_id: staff.userId,
  })
  if (error) {
    console.error(`[staff/destroy] delete of ${code} was refused: ${error.message}`)
    return { success: false, message: t('act.couldNotDeleteThatFamily') }
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    { ok: boolean; message: string | null; deleted: Record<string, number> | null } | undefined
  if (!row) return { success: false, message: t('act.deleteReturnedNoResult') }
  if (!row.ok) return { success: false, message: row.message ?? t('act.couldNotDeleteThatFamily') }

  revalidatePath('/staff/families')
  revalidatePath('/staff')

  const rows = Object.values(row.deleted ?? {}).reduce((n, v) => n + Number(v), 0)

  // ── THE DETAIL LINE IS WHAT A PERSON HAS TO ACT ON, OR RECONCILE AGAINST ───────
  // Two kinds of sentence and they are different in kind, which is why they are composed
  // rather than merged into one key. What Stripe stopped is a RECEIPT — an owner asked for a
  // family to be erased and needs to be able to say, afterwards, that the charges stopped and
  // how many. The leftover objects are WORK: they are the one part of this nobody else will
  // notice. A deletion that stopped no subscriptions says nothing at all, because there was
  // nothing to say.
  const detail = [
    stripe.duesCancelled > 0
      ? t(stripe.duesCancelled === 1 ? 'act.stoppedDuesOne' : 'act.stoppedDuesMany',
          { n: String(stripe.duesCancelled) })
      : null,
    stripe.platformCancelled ? t('act.stoppedGenorraPlan') : null,
    leftover.length > 0 ? t('act.someObjectsRemain', { detail: leftover.join(', ') }) : null,
  ].filter(Boolean).join(' ')

  return {
    success: true,
    message: t('act.familyDeletedPermanently', { code, rows: String(rows) }),
    detail: detail === '' ? undefined : detail,
  }
}

/**
 * Delete one account, freeing its email address.
 *
 * ── THE `people` ROWS SURVIVE, AND THAT IS THE POINT ──────────────────────────────
 * `people.user_id` is ON DELETE SET NULL, so every family this person belonged to keeps them
 * on the tree, in the directory and in its ledgers — as a record with no account, which is a
 * shape this product has in quantity (AGENTS.md §4b). Deleting the person as well would take
 * a relative out of a family that did not ask for it, and their dues history with them.
 *
 * ── NO EMAILED CODE, AND THAT IS A JUDGEMENT RATHER THAN AN OVERSIGHT ─────────────
 * A family deletion destroys a hundred and forty people's records and cannot be undone by any
 * means. This destroys one login, and the person can register again with the same address —
 * which is usually the REASON somebody asks for it. The typed-address confirmation is
 * proportionate; a second factor on top would be ceremony that teaches an owner to click
 * through ceremony.
 */
export async function deleteStaffAccount(input: {
  email: string
  /** Typed back, so the wrong row on a list of accounts cannot be deleted. */
  confirmEmail: string
  note: string
}): Promise<StaffDestroyResult> {
  const staff = await requireStaffOwner()
  const { t } = await callerI18n(staff.userId)

  const email = (input?.email ?? '').trim().toLowerCase()
  const typed = (input?.confirmEmail ?? '').trim().toLowerCase()
  const note = (input?.note ?? '').trim()

  if (!email) return { success: false, message: t('act.enterEmailAddress') }
  if (typed !== email) return { success: false, message: t('act.typeAddressToConfirm') }
  if (!note) return { success: false, message: t('act.sayWhyAccountDeleted') }

  const { data, error } = await createAdminClient().rpc('staff_delete_account', {
    p_email: email,
    p_note: note,
    p_user_id: staff.userId,
  })
  if (error) {
    console.error(`[staff/destroy] account delete was refused: ${error.message}`)
    return { success: false, message: t('act.couldNotDeleteThatAccount') }
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    { ok: boolean; message: string | null } | undefined
  if (!row) return { success: false, message: t('act.deleteReturnedNoResult') }
  if (!row.ok) {
    // The function's own message, verbatim. It distinguishes "no account with that address"
    // from "that is the last owner" from "you cannot delete your own account", and an owner
    // needs to know which — they have already been proven staff, so there is no oracle here.
    return { success: false, message: row.message ?? t('act.couldNotDeleteThatAccount') }
  }

  revalidatePath('/staff/accounts')
  revalidatePath('/staff')
  return { success: true, message: t('act.accountDeleted', { email }) }
}
