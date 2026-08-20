/**
 * Empty and delete a RETIRED storage bucket, through the Storage API.
 *
 *     node scripts/drop-retired-bucket.mjs event-photos --local
 *     node scripts/drop-retired-bucket.mjs event-photos --url=https://x.supabase.co --key=<service-role>
 *
 * ── WHY THIS IS NOT A MIGRATION ─────────────────────────────────────────────────────
 * `storage.objects` refuses a direct DELETE: `storage.protect_delete()` is a BEFORE DELETE
 * trigger that raises 42501 ("Use the Storage API instead") unless the session GUC
 * `storage.allow_delete_query` is `'true'`. A migration CAN set that GUC — and
 * `20260820000008` does, because the bucket has to stop existing on a fresh `db reset` where
 * `20260609000000` keeps recreating it — but deleting the ROW is not the same as deleting the
 * OBJECT. The bytes live in the storage backend (a Docker volume locally, S3 on hosted), and a
 * row-only delete leaves them there: unreachable through the API, still stored, still billed.
 *
 * So the two halves are genuinely different jobs and both are needed:
 *
 *   this script      removes the BYTES, and must run against hosted BEFORE the migration
 *                    merges — afterwards the rows are gone and nothing can enumerate what to
 *                    delete.
 *   the migration    makes the bucket's ABSENCE structural, so local and hosted agree and a
 *                    `db reset` does not resurrect it.
 *
 * ── IT REFUSES ANY BUCKET THAT IS NOT RETIRED ───────────────────────────────────────
 * A general "delete a bucket" tool in a repo is a footgun aimed at `photos`. `RETIRED` below
 * is the whole allow-list, and it is short on purpose: a bucket belongs on it once nothing in
 * the tree reads or writes it and its feature is gone. Adding a name to that list is the
 * decision; running the script is not.
 *
 * ── IT IS NOT A verify.yml STEP AND MUST NOT BECOME ONE ─────────────────────────────
 * It deletes data, it needs a service-role key, and it is a one-time operation per bucket.
 * `art:check` is kept out of that workflow for a much weaker reason than this one.
 */
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Buckets whose feature no longer exists. Nothing else may be named.
 *
 * `event-photos` — created by `20260609000000`, orphaned by `20260819000006` when Events was
 * retired and every table that referenced it was dropped. Its write policies were dropped by
 * `20260820000006` (so it has taken no new object since), and `20260820000008` deletes the
 * bucket row. This is what reclaims the objects already in it.
 */
const RETIRED = new Set(['event-photos'])

const args = process.argv.slice(2)
const bucket = args.find(a => !a.startsWith('-'))
const flag = k => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')

if (!bucket) {
  console.error('usage: node scripts/drop-retired-bucket.mjs <bucket> [--local | --url=… --key=…]')
  process.exit(2)
}
if (!RETIRED.has(bucket)) {
  console.error(
    `Refusing to touch '${bucket}'. This script deletes RETIRED buckets only, and the list is\n`
    + `in its header: ${[...RETIRED].join(', ')}.\n\n`
    + 'If a bucket really is retired, add it there in the same commit as whatever retired it.',
  )
  process.exit(2)
}

// ── Where to point ──────────────────────────────────────────────────────────
// `--local` reads the running stack the way tests/rls/env.mjs does, so there is nothing to
// keep in sync by hand. Anything else has to be passed explicitly: no default, and no reading
// of NEXT_PUBLIC_SUPABASE_URL, because a script that deletes objects must never quietly
// inherit whichever project happens to be in the environment.
let url = flag('url')
let key = flag('key')

if (args.includes('--local')) {
  const raw = execFileSync('npx', ['supabase', 'status', '-o', 'env', '--workdir', ROOT],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })
  const status = {}
  for (const line of raw.split('\n')) {
    const m = /^([A-Z0-9_]+)="(.*)"\s*$/.exec(line.trim())
    if (m) status[m[1]] = m[2]
  }
  url = status.API_URL
  key = status.SERVICE_ROLE_KEY
  if (!/127\.0\.0\.1|localhost/.test(url ?? '')) {
    console.error(`--local resolved a non-local URL (${url}). Refusing.`)
    process.exit(1)
  }
}

if (!url || !key) {
  console.error('Need --local, or both --url= and --key= (service role).')
  process.exit(2)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// ── 1. Is it even there? ────────────────────────────────────────────────────
const { data: buckets, error: listError } = await db.storage.listBuckets()
if (listError) {
  console.error(`Could not list buckets: ${listError.message}`)
  process.exit(1)
}
if (!buckets.some(b => b.id === bucket)) {
  console.log(`'${bucket}' does not exist here. Nothing to do.`)
  process.exit(0)
}

// ── 2. Enumerate, recursively ───────────────────────────────────────────────
// `list()` is ONE LEVEL DEEP and returns folder entries alongside files, which is the thing
// that makes a naive version silently leave everything behind: `emptyBucket()` exists and is
// used below, but counting first is what lets this report what it removed rather than
// claiming success over an empty answer.
async function walk(prefix = '') {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) throw new Error(`list('${prefix}'): ${error.message}`)
  const out = []
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    // A folder has no `id`; a file does. That is the only distinction the API offers.
    if (entry.id === null) out.push(...await walk(path))
    else out.push(path)
  }
  return out
}

const objects = await walk()
console.log(`'${bucket}': ${objects.length} object(s)`)
for (const o of objects.slice(0, 20)) console.log(`  ${o}`)
if (objects.length > 20) console.log(`  … and ${objects.length - 20} more`)

// ── 3. Empty, then delete ───────────────────────────────────────────────────
// `emptyBucket()` rather than `remove(objects)`: it is the API's own recursive delete, so it
// cannot miss a path this script's walk did not think of. The walk above is for REPORTING,
// which matters because a silent "done" over a bucket that still holds files is exactly the
// failure mode that left the `photos` DELETE policy broken for months.
if (objects.length) {
  const { error } = await db.storage.emptyBucket(bucket)
  if (error) {
    console.error(`Could not empty '${bucket}': ${error.message}`)
    process.exit(1)
  }
  const left = await walk()
  if (left.length) {
    console.error(`'${bucket}' still holds ${left.length} object(s) after emptyBucket. Stopping.`)
    process.exit(1)
  }
  console.log(`emptied '${bucket}'`)
}

const { error: deleteError } = await db.storage.deleteBucket(bucket)
if (deleteError) {
  console.error(`Could not delete '${bucket}': ${deleteError.message}`)
  process.exit(1)
}

// ── 4. Say so, having asked again ───────────────────────────────────────────
const { data: after } = await db.storage.listBuckets()
if ((after ?? []).some(b => b.id === bucket)) {
  console.error(`'${bucket}' is still listed after deleteBucket reported success.`)
  process.exit(1)
}
console.log(`deleted bucket '${bucket}'`)
