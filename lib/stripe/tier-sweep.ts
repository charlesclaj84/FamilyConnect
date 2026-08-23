import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Calling `apply_due_platform_tier_changes()` — the one writer of `families.tier` from billing.
 *
 * A one-line wrapper, and it exists so there is ONE call site shape rather than a `.rpc()`
 * written out wherever somebody remembers it. What that buys is a grep: every place the
 * product decides a term has ended is a call to this function, and today there is exactly one
 * (the platform webhook, at the end of every delivery).
 *
 * ── IT NEVER THROWS, AND THAT IS THE POINT OF THE WRAPPER ───────────────────────────
 * The caller is a webhook handler whose response code tells Stripe whether to redeliver. A
 * sweep failure is not a reason to redeliver a payment that has already been recorded — the
 * schedule is still in the table, and the next delivery will try again — so this logs and
 * returns rather than propagating. Letting it throw would turn a transient database blip into
 * Stripe re-applying a settled payment.
 *
 * ── WHAT IT IS WAITING FOR ──────────────────────────────────────────────────────────
 * `pg_cron`. TODO.md records that the extension is available on this project and not
 * installed, and the SQL function was written for it: no arguments, no caller, idempotent, and
 * safe to run hourly forever. When that lands, this wrapper stays — the webhook call is still
 * the exact one for a renewal — and the cron job becomes the answer for a prepaid term that
 * ends on a quiet week.
 */
export async function applyDuePlatformTierChanges(): Promise<number> {
  try {
    const { data, error } = await createAdminClient().rpc('apply_due_platform_tier_changes')
    if (error) {
      console.error(`[billing] the tier sweep failed: ${error.message}`)
      return 0
    }
    const moved = typeof data === 'number' ? data : 0
    if (moved > 0) console.log(`[billing] the tier sweep moved ${moved} famil${moved === 1 ? 'y' : 'ies'}`)
    return moved
  } catch (e) {
    console.error(`[billing] the tier sweep threw: ${e instanceof Error ? e.message : String(e)}`)
    return 0
  }
}
