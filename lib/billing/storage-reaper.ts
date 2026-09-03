import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The bytes behind a purge, which SQL structurally cannot delete.
 *
 * ── WHY THIS IS NOT IN THE SWEEP ───────────────────────────────────────────────────
 * `delete_family_data_above_tier` removes rows and can never touch storage: SQL does not reach
 * the storage backend, `storage.protect_delete()` refuses a direct `DELETE FROM
 * storage.objects`, and a `pg_cron` job has no Storage API to call. So a family whose Plus data
 * was purged kept every image file, in a bucket that is `public: true`, fetchable by URL to
 * anybody who already had one.
 *
 * `20260901000006` is the schema half. This is the walk, and it runs on the notice-drain path
 * because that is the one place in this product where Node already runs on a clock with the
 * service key. The alternative was `pg_net` from the sweep — an outbound HTTP call inside a
 * transaction that also deletes a family tree — and it was declined for the reason `VERCEL.md`
 * gives about the mail.
 *
 * ══════════════════════════════════════════════════════════════════════════════════
 * ── THE ONE RULE. READ IT BEFORE CHANGING ANY LINE BELOW ──────────────────────────
 * ══════════════════════════════════════════════════════════════════════════════════
 * This function deletes an object that NO SURVIVING ROW POINTS AT. Every dangerous thing it
 * could do comes from the same mistake: believing a family has no surviving rows when in fact
 * the query for them failed.
 *
 * `const { data } = await supabase…` discards the error and answers `[]` (AGENTS.md §8). Here
 * that empty array does not render an empty screen — **it makes every photograph the family
 * owns look like an orphan, and deletes all of them, permanently, with no undo and no backup
 * this product controls.** It is the single most destructive line available in this codebase.
 *
 * So the shape below is not defensive by habit, and none of it may be simplified away:
 *
 *   * **Every read is error-checked and ABANDONS THE FAMILY**, not just the bucket. A partial
 *     survivor set is worse than none, because it looks like a successful sweep.
 *   * **A survivor read is PAGED to exhaustion.** A family with more than a page of
 *     photographs whose survivors were read one page deep would have the rest deleted. There
 *     is no cap that fails safe here — a truncated survivor list is a delete list.
 *   * **A row with a NULL or empty `file_path` ABANDONS the family** rather than being
 *     skipped. It means a row exists whose object cannot be identified, so the survivor set
 *     cannot be trusted to be complete.
 *   * **Only objects under `<FAMILY_CODE>/` are ever considered**, and every path is checked
 *     to start with that prefix before it is queued for removal. The buckets are laid out per
 *     family (`20260820000006`), so the prefix is the whole of one family's objects — and a
 *     stray `file_path` pointing outside it must never make this delete another family's file.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────────────
 * It does not touch `avatars`, which is laid out per USER rather than per family and is not
 * purged by any tier. It does not delete a bucket. And it never widens: a bucket appears here
 * only because `tier_data_tables.storage_bucket` names it, and that column is asserted against
 * the actual `file_path` columns in both directions by the migration.
 *
 * ── STORAGE REPORTS A REFUSED `remove()` AS 200 WITH AN EMPTY ARRAY ───────────────
 * AGENTS.md records it, and `staff/destroy.ts` says the same thing where it does this for a
 * whole family. So an error here is a transport failure and a silent refusal is invisible;
 * nothing better is available from that API. The counts recorded on the audit row are what a
 * person reconciles against.
 */

/** One page of `list()`. Supabase caps this at 1000 and returns fewer at the end. */
const PAGE = 1000

/**
 * How many purges to sweep per run. Bounded for `drainBillingNotices`' reason — the platform
 * has a wall-clock ceiling on a request — and small because each one is a full listing of a
 * family's buckets. A backlog drains over consecutive days, which is fine: the bytes have
 * already survived longer than that.
 */
const REAPS_PER_RUN = 5

export interface ReapResult {
  /** Purges claimed for a walk. */
  claimed: number
  /** Objects actually removed. */
  removed: number
  /** Purges abandoned without deleting anything, because a read failed. */
  abandoned: number
}

interface ClaimedReap {
  id: string
  family_code: string
  buckets: string[]
}

/** Thrown to abandon one family. Never escapes `reapPurgedStorage`. */
class AbandonFamily extends Error {}

/**
 * Every storage path still pointing into `bucket` for this family.
 *
 * Reads the map rather than a hard-coded list, so a table added to `tier_data_tables` with a
 * bucket named is included here with no edit — which is the property the migration's
 * completeness assertion is protecting.
 *
 * ── A ROW MAY POINT AT MORE THAN ONE OBJECT, SINCE 20260902000003 ─────────────────
 * `photos` gained `thumb_path`: a second, smaller object beside the original, in the same
 * folder. `storage_thumb_column` on the map is what names it, and reading the map rather than
 * hard-coding `thumb_path` is the same decision as reading `storage_bucket` — a table that
 * starts holding two objects per row is included here by adding a row value, not by editing
 * this function.
 *
 * IT IS NOT DERIVED FROM `file_path`. Computing `<stem>_thumb.jpg` here would be a second
 * copy of `photoThumbPath`'s naming scheme, and the day the two disagreed this function would
 * delete live thumbnails — invisibly, because a missing thumbnail renders as the original and
 * nothing on any screen goes wrong. The migration asserts the map against the real columns in
 * both directions instead.
 *
 * A NULL SECOND PATH IS ORDINARY AND IS NOT AN ABANDON. Every photograph uploaded before
 * 2026-09-02 has none, and so does anything the uploading browser could not decode. That is
 * the opposite of `file_path`, where a NULL means a row whose object cannot be identified and
 * the survivor set is therefore not provably complete.
 */
async function survivingPaths(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  bucket: string,
): Promise<Set<string>> {
  const { data: tableRows, error: tableError } = await admin
    .from('tier_data_tables')
    .select('table_name, storage_thumb_column')
    .eq('storage_bucket', bucket)

  if (tableError) {
    throw new AbandonFamily(`could not read the table map for ${bucket}: ${tableError.message}`)
  }
  const tables = (tableRows ?? []).map(r => ({
    name: r.table_name as string,
    thumbColumn: (r.storage_thumb_column as string | null) ?? null,
  }))
  if (tables.length === 0) {
    // A bucket the claim named must have at least one table behind it, or the claim derived it
    // from nothing. Abandon rather than treat every object as an orphan.
    throw new AbandonFamily(`no tables map to bucket ${bucket}`)
  }

  const paths = new Set<string>()
  for (const table of tables) {
    // THE PROJECTION IS BUILT FROM THE MAP, and the column name is validated first. It is
    // interpolated into a PostgREST `select`, so an arbitrary string here would be an
    // injection point — and the map is a table the service role writes, which is exactly the
    // sort of "trusted" input that stops being trusted the day something else can write it.
    // `20260902000003` asserts the value resolves to a real column; this asserts its SHAPE, so
    // the two failures are told apart rather than both arriving as a broken query.
    if (table.thumbColumn && !/^[a-z_][a-z0-9_]*$/.test(table.thumbColumn)) {
      throw new AbandonFamily(
        `${table.name} names an unusable storage_thumb_column: ${table.thumbColumn}`)
    }
    const projection = table.thumbColumn
      ? `file_path, ${table.thumbColumn}`
      : 'file_path'

    // PAGED TO EXHAUSTION. See the header: a truncated survivor list is a delete list.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from(table.name)
        .select(projection)
        .eq('family_code', familyCode)
        .range(from, from + PAGE - 1)

      if (error) {
        throw new AbandonFamily(`could not read surviving ${table.name} rows: ${error.message}`)
      }
      const rows = data ?? []
      for (const row of rows) {
        // `as unknown as` because a DYNAMIC projection widens supabase-js' row type to a union
        // that includes its `GenericStringError` — the compiler cannot know the string names
        // real columns. The shape is checked field by field below rather than asserted here.
        const record = row as unknown as Record<string, unknown>
        const path = record.file_path as string | null
        if (!path) {
          // A row exists whose object cannot be identified, so the survivor set is not
          // provably complete. Abandoning is the only safe answer.
          throw new AbandonFamily(`a surviving ${table.name} row has no file_path`)
        }
        paths.add(path)

        // THE SECOND OBJECT, WHERE THE ROW HAS ONE. NULL is ordinary here and is NOT an
        // abandon — see the header. A non-string that is not null is, because it means the
        // column is not what the map says it is.
        if (table.thumbColumn) {
          const second = record[table.thumbColumn]
          if (second != null) {
            if (typeof second !== 'string' || second.length === 0) {
              throw new AbandonFamily(
                `a surviving ${table.name} row has an unusable ${table.thumbColumn}`)
            }
            paths.add(second)
          }
        }
      }
      if (rows.length < PAGE) break
    }
  }
  return paths
}

/**
 * Every object under `<familyCode>/` in one bucket.
 *
 * `list()` is ONE LEVEL DEEP and reports a folder as an entry with no `id` rather than the
 * files inside it — the trap `tests/rls/raw/storage.mjs` records and `staff/destroy.ts` already
 * walks around. Two levels is what the layouts use.
 */
async function objectsUnder(
  admin: ReturnType<typeof createAdminClient>,
  familyCode: string,
  bucket: string,
): Promise<string[]> {
  const out: string[] = []

  async function page(prefix: string, depth: number): Promise<void> {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: PAGE, offset })
      if (error) {
        throw new AbandonFamily(`could not list ${bucket}/${prefix}: ${error.message}`)
      }
      const entries = data ?? []
      for (const entry of entries) {
        const path = `${prefix}/${entry.name}`
        if (entry.id) { out.push(path); continue }
        // A folder. Depth is bounded because an unbounded walk on a bucket somebody can
        // write into is a request that never returns.
        if (depth < 2) await page(path, depth + 1)
      }
      if (entries.length < PAGE) break
    }
  }

  await page(familyCode, 0)
  return out
}

/**
 * Sweep the bytes behind purges that have not been swept.
 *
 * Called from `/api/billing/notices` after the mail drain, so it shares that route's schedule,
 * its secret and its service key. It sends nothing and decides nothing about a family's
 * standing — every row it acts on names a purge that has already happened.
 */
export async function reapPurgedStorage(limit = REAPS_PER_RUN): Promise<ReapResult> {
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('claim_storage_reaps', { p_limit: limit })
  if (error) throw new Error(`could not claim storage sweeps: ${error.message}`)

  const claimed = (data ?? []) as ClaimedReap[]
  let removed = 0
  let abandoned = 0

  for (const reap of claimed) {
    const notes: string[] = []
    let removedHere = 0
    try {
      for (const bucket of reap.buckets) {
        const survivors = await survivingPaths(admin, reap.family_code, bucket)
        const objects = await objectsUnder(admin, reap.family_code, bucket)

        // THE PREFIX IS CHECKED AGAIN HERE, not merely relied on. `objectsUnder` builds every
        // path from the prefix it was given, so this cannot fail today — it is here so that a
        // future change to that walk cannot quietly make this delete outside one family.
        const orphans = objects.filter(
          path => path.startsWith(`${reap.family_code}/`) && !survivors.has(path),
        )
        if (orphans.length === 0) continue

        // Removed in batches: `remove()` takes an array and a family with thousands of
        // photographs is one request nobody should send.
        for (let i = 0; i < orphans.length; i += PAGE) {
          const batch = orphans.slice(i, i + PAGE)
          const { error: removeError } = await admin.storage.from(bucket).remove(batch)
          if (removeError) {
            // NOT FATAL, and not an abandon either: a failed REMOVE leaves orphans, which is
            // the state we were already in. A failed READ is the dangerous one and is what
            // `AbandonFamily` is for. Recorded so a person can reconcile.
            notes.push(`${bucket}: ${removeError.message}`)
            continue
          }
          removedHere += batch.length
        }
      }
      removed += removedHere
      await admin.rpc('finish_storage_reap', {
        p_id: reap.id,
        p_note: notes.length > 0 ? notes.join('; ') : null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[reaper] abandoned ${reap.family_code}: ${message}`)
      abandoned++
      // DELIBERATELY NOT FINISHED. The claim ages out after fifteen minutes and the sweep is
      // retried on the next run — a read that failed once is usually transient, and marking it
      // done would strand the bytes permanently on one bad response.
    }
  }

  return { claimed: claimed.length, removed, abandoned }
}
