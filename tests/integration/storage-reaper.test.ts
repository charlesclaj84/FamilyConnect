import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The storage reaper, against a real database and a real bucket.
 *
 * ── WHY IT IS HERE AND NOT UNDER `npm test` OR `tests/rls` ─────────────────────────
 * `vitest.config.mts`'s include is a boundary — `lib/**`, no Supabase — and `tests/rls`
 * calls server actions through PostgREST, which the reaper is not. What this module does is
 * list a real bucket and permanently remove real objects, and the only thing that can check
 * that is a real bucket. `npm run reaper:check`, after `npx supabase start`.
 *
 * ── THE THIRD TEST IS THE REASON THE FILE EXISTS ───────────────────────────────────
 * The reaper deletes an object no surviving row points at. If the query for surviving rows
 * FAILS, every object in the family looks like an orphan — so the dangerous case is not a bug
 * in the matching, it is `const { data }` discarding an error and answering `[]`
 * (AGENTS.md §8), with permanent deletion on the other side of it.
 *
 * That case is exercised FOR REAL: the column the reaper selects is renamed out from under
 * it, so PostgREST answers 42703 and `data` is null — the exact shape. Asserting that nothing
 * is deleted is the whole point, and it is the assertion to run first after any edit.
 */

const FAMILY = 'REAPTEST'
const BUCKET = 'photos'
const COLLECTION = '11111111-1111-4111-8111-111111111111'

let container: string
let stackUrl: string
let serviceKey: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any

/**
 * `shell` IS NOT A DEFAULT HERE, AND THAT COST A RUN. Windows resolves `npx` through the
 * shell, so that one call needs it — but with `shell: true` the arguments are re-parsed, and a
 * SQL string containing spaces is split into a dozen fragments: psql received `DELETE` alone
 * and answered `syntax error at end of input`. `docker` is a real executable and must be
 * spawned directly.
 */
function sh(cmd: string, args: string[], viaShell = false): string {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: viaShell && process.platform === 'win32',
  }).trim()
}

function psql(sql: string): string {
  return sh('docker', [
    'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql,
  ])
}

async function names(): Promise<string[]> {
  const { data, error } = await db.storage.from(BUCKET).list(FAMILY, { limit: 1000 })
  if (error) throw new Error(`list: ${error.message}`)
  return (data ?? []).map((e: { name: string }) => e.name).sort()
}

async function reap() {
  const { reapPurgedStorage } = await import('@/lib/billing/storage-reaper')
  return reapPurgedStorage()
}

async function wipe() {
  const { data } = await db.storage.from(BUCKET).list(FAMILY, { limit: 1000 })
  const paths = (data ?? []).map((e: { name: string }) => `${FAMILY}/${e.name}`)
  if (paths.length) await db.storage.from(BUCKET).remove(paths)
  psql(
    `DELETE FROM public.platform_data_deletions WHERE family_code = '${FAMILY}';`
    + `DELETE FROM public.photos WHERE family_code = '${FAMILY}';`
    + `DELETE FROM public.photo_collections WHERE family_code = '${FAMILY}';`
    + `DELETE FROM public.families WHERE family_code = '${FAMILY}';`,
  )
}

beforeAll(async () => {
  const env = sh('npx', ['supabase', 'status', '-o', 'env'], true)
  const read = (key: string) =>
    env.split('\n').find(l => l.startsWith(`${key}=`))?.split('=').slice(1).join('=')
      .replace(/^"|"$/g, '') ?? ''
  stackUrl = read('API_URL')
  serviceKey = read('SERVICE_ROLE_KEY')
  expect(stackUrl, 'the local stack is not running — npx supabase start').toBeTruthy()

  // A REFUSAL, NOT A CHECK. This test permanently deletes storage objects. `supabase status`
  // describes this machine and has no route to a hosted project, so this can only fail closed
  // — but the assertion is here so that a future edit pointing it at an env var cannot.
  expect(stackUrl).toMatch(/127\.0\.0\.1|localhost/)

  container = sh('docker', ['ps', '--format', '{{.Names}}'])
    .split('\n').find(n => n.startsWith('supabase_db_')) ?? ''
  expect(container, 'no supabase_db_* container').toBeTruthy()

  process.env.NEXT_PUBLIC_SUPABASE_URL = stackUrl
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey
  const { createClient } = await import('@supabase/supabase-js')
  db = createClient(stackUrl, serviceKey, { auth: { persistSession: false } })

  await wipe()
})

afterAll(async () => { if (db) await wipe() })

async function seed() {
  psql(
    `INSERT INTO public.families (family_code, family_name, tier) `
    + `VALUES ('${FAMILY}', 'Reaper probe', 'free') ON CONFLICT DO NOTHING;`
    + `INSERT INTO public.photo_collections (id, family_code, name) `
    + `VALUES ('${COLLECTION}', '${FAMILY}', 'Probe') ON CONFLICT DO NOTHING;`,
  )
  // THREE OBJECTS, NOT TWO, SINCE 20260902000003. `survivor_thumb.jpg` is a real second
  // object belonging to the surviving row through `photos.thumb_path` — the case the reaper
  // could not see before that migration, and the one where getting it wrong is silent: a
  // deleted thumbnail renders as the original and nothing on any screen goes wrong.
  for (const name of ['survivor.jpg', 'survivor_thumb.jpg', 'orphan.jpg']) {
    const { error } = await db.storage.from(BUCKET).upload(
      `${FAMILY}/${name}`, Buffer.from('not really a jpeg'),
      { contentType: 'image/jpeg', upsert: true },
    )
    if (error) throw new Error(`upload ${name}: ${error.message}`)
  }
  // Only the survivor keeps a row. The orphan's row is what the purge stands in for — and
  // that one row points at TWO objects, which is what makes the assertions below evidence for
  // `storage_thumb_column` rather than only for `file_path`.
  psql(
    `INSERT INTO public.photos (collection_id, family_code, file_path, thumb_path) `
    + `VALUES ('${COLLECTION}', '${FAMILY}', '${FAMILY}/survivor.jpg', `
    + `'${FAMILY}/survivor_thumb.jpg');`
    + `INSERT INTO public.platform_data_deletions (family_code, reason, tier_kept, deleted) `
    + `VALUES ('${FAMILY}', 'retention', 'free', '{"photos": 1}'::jsonb);`,
  )
}

describe('the storage reaper', () => {
  it('DELETES NOTHING when it cannot read the surviving rows', async () => {
    await seed()
    // The failure this module is written around, produced for real rather than mocked:
    // PostgREST answers 42703 and `data` is null, which unhandled makes every object an orphan.
    psql('ALTER TABLE public.photos RENAME COLUMN file_path TO file_path_probe;')
    let result
    try {
      result = await reap()
    } finally {
      psql('ALTER TABLE public.photos RENAME COLUMN file_path_probe TO file_path;')
    }

    expect(result.removed).toBe(0)
    expect(result.abandoned).toBe(1)
    expect(await names()).toEqual(['orphan.jpg', 'survivor.jpg', 'survivor_thumb.jpg'])
    // AND THE PURGE IS STILL OWED, so a transient failure retries rather than stranding the
    // bytes permanently on one bad response.
    expect(psql(
      `SELECT count(*) FROM public.platform_data_deletions `
      + `WHERE family_code = '${FAMILY}' AND storage_reaped_at IS NULL;`,
    )).toBe('1')
  })

  it('removes the orphan and keeps the survivor', async () => {
    // The claim from the abandoned run is fresh; age it out rather than waiting 15 minutes.
    psql(
      `UPDATE public.platform_data_deletions `
      + `SET storage_reap_claimed = NOW() - INTERVAL '20 minutes' `
      + `WHERE family_code = '${FAMILY}';`,
    )
    const result = await reap()
    expect(result.removed).toBe(1)
    expect(result.abandoned).toBe(0)
    // THE THUMBNAIL SURVIVES, and this is the assertion the whole `storage_thumb_column`
    // mechanism exists for. Mutation-checked: with the map row nulled
    // (`UPDATE tier_data_tables SET storage_thumb_column = NULL WHERE table_name='photos'`)
    // this reports `removed: 2` and the surviving photograph's thumbnail is gone.
    expect(await names()).toEqual(['survivor.jpg', 'survivor_thumb.jpg'])
  })

  it('does not re-walk a purge it has finished', async () => {
    const result = await reap()
    expect(result.claimed).toBe(0)
    expect(await names()).toEqual(['survivor.jpg', 'survivor_thumb.jpg'])
  })

  it('leaves a family alone when its purge deleted no files', async () => {
    // `{"photos": 0}` means the purge looked and found none. Walking a bucket for that is work
    // with no possible result, and the claim function stamps it rather than queueing it.
    await wipe()
    await seed()
    psql(
      `UPDATE public.platform_data_deletions SET deleted = '{"chat_messages": 9}'::jsonb `
      + `WHERE family_code = '${FAMILY}';`,
    )
    const result = await reap()
    expect(result.claimed).toBe(0)
    // BOTH objects survive — including the one with no row. A purge that took no files is not
    // a licence to tidy up bytes nobody asked about.
    expect(await names()).toEqual(['orphan.jpg', 'survivor.jpg', 'survivor_thumb.jpg'])
  })
})
