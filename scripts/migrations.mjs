#!/usr/bin/env node
/**
 * Is the migration chain in this repo the chain a database actually ran?
 *
 *   node scripts/migrations.mjs check            # repo checks only, no database
 *   node scripts/migrations.mjs check --local    # ...and against the local stack
 *   node scripts/migrations.mjs check --linked   # ...and against the hosted project
 *
 *   --expect-applied   nothing may be pending. For use AFTER `db push`.
 *   --quiet            findings only, no per-check lines
 *
 * `--linked` needs SUPABASE_ACCESS_TOKEN (a Management API token, sbp_…). Exits 1 on a
 * finding, so it reads as a test.
 *
 * WHY THIS EXISTS
 *   Two production incidents, one shape. Migrations reached hosted from a laptop —
 *   sometimes `supabase db push`, sometimes `psql -f` — so nothing recorded what had
 *   been applied and nothing sequenced it against the code deploy:
 *
 *     * Phase 3's app code shipped while its migrations were pending. `getMyFamilies`
 *       selected a column hosted did not have, PostgREST answered 42703 and killed the
 *       whole query, and every page in the app answered 404.
 *     * `20260602000000_families.sql` was replayed by hand after `20260618000001` had
 *       renamed its policy. Its bare `CREATE POLICY` recreated the original alongside
 *       the secure one, and because permissive policies are OR-ed, the spoofable one
 *       decided every read.
 *
 *   The fix is structural and lives in .github/workflows: `db push` runs from CI on
 *   merge to master, before the code deploy is triggered, and nowhere else. This script
 *   is the part that can be run at any time to ask whether that held — the same job
 *   `npm run email:check` does for the auth templates.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *   Whether an applied migration's FILE still matches what the database ran. It
 *   usually does not, and that is correct: `20260618000000_permissions_foundation.sql`
 *   carries the `permission_resources` seed, AGENTS.md §6 tells you to keep it current,
 *   and it has been edited in ten commits since it was applied. `db push` keys off the
 *   version, so those edits reach fresh databases only — never hosted. That is the
 *   intended design, which is why the version ledger is the only honest comparison
 *   here, and why a new resource needs a NEW migration as well as the seed edit.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS = resolve(REPO, 'supabase/migrations')

/** The CLI's own rule: `<14-digit timestamp>_name.sql`. Anything else it skips. */
const VERSIONED = /^(\d{14})_.+\.sql$/

// ---------------------------------------------------------------- the repo

function readRepo() {
  const entries = readdirSync(MIGRATIONS).filter((f) => f.toLowerCase().endsWith('.sql')).sort()
  const versioned = []
  const unversioned = []

  for (const file of entries) {
    const m = VERSIONED.exec(file)
    if (!m) {
      unversioned.push(file)
      continue
    }
    versioned.push({ version: m[1], file, body: readFileSync(resolve(MIGRATIONS, file), 'utf8') })
  }
  return { versioned, unversioned }
}

// ---------------------------------------------------------------- the ledger

/**
 * `supabase` if it is on PATH, `npx supabase` otherwise.
 *
 * CI installs a PINNED CLI via supabase/setup-cli, which puts it on PATH; a laptop
 * usually has none and wants npx. Resolving it here rather than hard-coding `npx` means
 * the workflow's pinned binary is the one that answers — `npx` is documented to prefer a
 * PATH command over downloading, but "documented to" is not a thing to stake the
 * production migration ledger on when one probe settles it.
 */
let cachedCli = null
function cli() {
  if (cachedCli) return cachedCli
  try {
    execSync('supabase --version', { stdio: 'ignore' })
    cachedCli = 'supabase'
  } catch {
    cachedCli = 'npx supabase'
  }
  return cachedCli
}

/**
 * The set of versions a database has recorded in `supabase_migrations.schema_migrations`.
 *
 * Shelling out to the CLI rather than querying the table directly is deliberate: this is
 * the same code path `db push` consults, so the answer cannot disagree with what a push
 * would decide, and `--linked` needs no credential that `db push` does not already need.
 */
function readLedger(target) {
  let raw
  try {
    // One pre-quoted command string, not execFileSync with an args array.
    //
    // On Windows the CLI is a `.cmd` shim, and Node refuses to exec one directly — both
    // `npx` and `npx.cmd` fail with EINVAL (measured), so a shell is unavoidable. The
    // usual `execFileSync(cmd, args, {shell:true})` then concatenates argv *unescaped*,
    // which breaks --workdir for any checkout under a path with a space and raises
    // DEP0190 on every run — noise in a log that exists to be read. Passing one string
    // I have quoted myself avoids both. tests/rls/env.mjs still uses the args form; it
    // predates this and takes no path argument.
    raw = execSync(
      `${cli()} migration list ${target} --output-format json --workdir "${REPO}"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join('\n').trim()
    throw new Error(
      `\`supabase migration list ${target}\` failed.\n\n${detail}\n\n` +
        (target === '--linked'
          ? '  For --linked this usually means no SUPABASE_ACCESS_TOKEN, or the project is not linked.\n' +
            '  The token is a Management API token (sbp_…) — not the service role key, and not the\n' +
            '  database password. `supabase login` keeps its own copy in the OS keyring, which is\n' +
            '  not readable from here.'
          : '  For --local this usually means the stack is not running. `npx supabase start`.'),
    )
  }

  // The CLI prints "Connecting to …" and one "Skipping migration …" line per unversioned
  // file before the JSON. Find the object rather than assuming a line number.
  const parsed = parseJsonSomewhereIn(raw)
  if (!parsed?.migrations) {
    throw new Error(`Could not find a migrations array in the CLI output:\n${raw.slice(0, 500)}`)
  }

  // Only `remote` is read. The CLI's `local` column is its own view of the directory, and
  // the checks below deliberately derive that from readRepo() instead, so the pairing
  // logic is in this file and visible rather than inherited.
  return { applied: new Set(parsed.migrations.map((m) => m.remote).filter(Boolean)) }
}

function parseJsonSomewhereIn(raw) {
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      return JSON.parse(t)
    } catch {
      /* keep looking */
    }
  }
  // Pretty-printed fallback: first { to last }.
  const open = raw.indexOf('{')
  const close = raw.lastIndexOf('}')
  if (open === -1 || close <= open) return null
  try {
    return JSON.parse(raw.slice(open, close + 1))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- checks

const findings = []
const notes = []

function fail(check, message, detail) {
  findings.push({ check, message, detail })
}

/**
 * A file that looks like a migration and is not one. `supabase db push` skips these with
 * a single "file name must match pattern" line that scrolls past in a CI log, so they
 * apply to nothing while sitting in the one directory that implies they apply to
 * everything. `chat_teardown.sql` was the live example — it DROPs `get_my_family_code()`
 * and `auth_uid_is_room_participant()`, which AGENTS.md §2b records as load-bearing for
 * every authenticated query and for chat's realtime subscription.
 */
function checkUnversioned({ unversioned }) {
  if (!unversioned.length) return true
  fail(
    'unversioned files',
    `${unversioned.length} .sql file(s) in supabase/migrations/ that the CLI silently skips`,
    unversioned.map((f) => `${f} — rename to <14-digit timestamp>_name.sql, or move it to supabase/scripts/`),
  )
  return false
}

function checkDuplicateVersions({ versioned }) {
  const byVersion = new Map()
  for (const m of versioned) {
    if (!byVersion.has(m.version)) byVersion.set(m.version, [])
    byVersion.get(m.version).push(m.file)
  }
  const dupes = [...byVersion.entries()].filter(([, files]) => files.length > 1)
  if (!dupes.length) return true
  fail(
    'duplicate versions',
    `${dupes.length} version(s) claimed by more than one file`,
    dupes.map(([v, files]) => `${v} — ${files.join(', ')}`),
  )
  return false
}

/**
 * Every migration header used to read `USAGE: psql "$DATABASE_URL" -f <file>`, which is
 * how a file gets replayed out of order in the first place: `psql -f` records nothing in
 * `schema_migrations`, so afterwards nothing can tell you what a database has. Those
 * headers were swept on 2026-08-12; this keeps them from coming back, including in files
 * nobody has written yet.
 *
 * The test is `psql` plus a CONNECTION TARGET on the same line, not the word `psql` — a
 * migration is free to say "never apply this with psql by hand", and the first version of
 * this check flagged the very sentence the sweep had just written into all 18 files.
 */
const HAND_RUN = /\bpsql\b[^\r\n]*(?:\$DATABASE_URL|postgres(?:ql)?:\/\/|\s-d\s|\s-h\s|--dbname|--host)/
function checkNoHandRunInvitation({ versioned }) {
  const offenders = versioned.filter((m) => HAND_RUN.test(m.body)).map((m) => m.file)
  if (!offenders.length) return true
  fail(
    'hand-run invitation',
    `${offenders.length} migration(s) document themselves as a \`psql -f\` command`,
    [
      ...offenders,
      '',
      'Applying a migration this way records nothing, so it can be replayed and can run out',
      'of order. Migrations reach a database through `supabase db push` — CI does it on merge.',
    ],
  )
  return false
}

/**
 * A version the database has and the repo does not. Either somebody applied a file that
 * was never committed, or `migration repair` stamped a version by hand, or a committed
 * migration was later deleted. All three mean the database is running schema this repo
 * cannot reproduce — so `db reset` locally and hosted have diverged, permanently and
 * invisibly.
 */
function checkAppliedButAbsent({ versioned }, ledger, target) {
  const inRepo = new Set(versioned.map((m) => m.version))
  const orphans = [...ledger.applied].filter((v) => !inRepo.has(v)).sort()
  if (!orphans.length) return true
  fail(
    'applied but absent',
    `${orphans.length} version(s) recorded on ${target.replace('--', '')} with no file in this repo`,
    [
      ...orphans,
      '',
      'This repo can no longer reproduce that database. Recover the file from git and commit it,',
      'or — only if the version was stamped in error — `supabase migration repair --status reverted`.',
    ],
  )
  return false
}

/**
 * A pending migration that sorts BEFORE something already applied. `db push` refuses these
 * unless it is given `--include-all`, and that refusal is a feature: the files applied after
 * it were written against a schema that did not include it. The workflows never pass
 * `--include-all` for exactly this reason — when this fires, the repair is a new migration
 * with a current timestamp, not an override.
 */
function checkOutOfOrder({ versioned }, ledger, target) {
  if (!ledger.applied.size) return true
  const newestApplied = [...ledger.applied].sort().at(-1)
  const behind = versioned
    .filter((m) => !ledger.applied.has(m.version) && m.version < newestApplied)
    .map((m) => m.file)
  if (!behind.length) return true
  fail(
    'out of order',
    `${behind.length} pending migration(s) sort before ${newestApplied}, the newest applied on ${target.replace('--', '')}`,
    [
      ...behind,
      '',
      '`db push` will refuse this without --include-all, which the workflows never pass.',
      'Re-create the change as a new migration with a current timestamp instead.',
    ],
  )
  return false
}

function reportPending({ versioned }, ledger, target, expectApplied) {
  const pending = versioned.filter((m) => !ledger.applied.has(m.version)).map((m) => m.file)
  if (!pending.length) {
    notes.push(`${target.replace('--', '')} is level with the repo — ${ledger.applied.size} migration(s) applied`)
    return true
  }
  if (expectApplied) {
    fail(
      'still pending',
      `${pending.length} migration(s) not applied to ${target.replace('--', '')} after a push`,
      pending,
    )
    return false
  }
  notes.push(
    `${pending.length} migration(s) pending on ${target.replace('--', '')} (normal before a deploy):\n` +
      pending.map((f) => `             ${f}`).join('\n'),
  )
  return true
}

// ---------------------------------------------------------------- output

function main() {
  const argv = process.argv.slice(2)
  const command = argv.find((a) => !a.startsWith('-')) ?? 'check'
  const has = (f) => argv.includes(`--${f}`)

  if (command !== 'check') {
    throw new Error(`Unknown command "${command}". Only \`check\` is supported.`)
  }
  if (has('local') && has('linked')) {
    throw new Error('Pass --local or --linked, not both.')
  }

  const target = has('linked') ? '--linked' : has('local') ? '--local' : null
  const quiet = has('quiet')
  const expectApplied = has('expect-applied')

  if (expectApplied && !target) {
    throw new Error('--expect-applied needs a target: --local or --linked.')
  }

  const repo = readRepo()
  const line = (ok, label) => {
    if (!quiet) console.log(`  ${ok ? 'ok      ' : 'FAIL    '} ${label}`)
  }

  console.log(`\n  chain    ${repo.versioned.length} versioned migration(s) in supabase/migrations/`)
  console.log(`  target   ${target ? target.replace('--', '') : 'repo only (pass --local or --linked to compare a database)'}\n`)

  line(checkUnversioned(repo), 'no unversioned .sql files the CLI would skip')
  line(checkDuplicateVersions(repo), 'no version claimed by two files')
  line(checkNoHandRunInvitation(repo), 'no migration documents itself as a hand-run psql command')

  if (target) {
    const ledger = readLedger(target)
    line(checkAppliedButAbsent(repo, ledger, target), 'every applied version has a file in this repo')
    line(checkOutOfOrder(repo, ledger, target), 'no pending migration sorts before an applied one')
    line(reportPending(repo, ledger, target, expectApplied), expectApplied ? 'nothing pending' : 'pending set reported')
  }

  for (const note of notes) console.log(`\n  note     ${note}`)

  if (!findings.length) {
    console.log(`\n  Clean.\n`)
    return 0
  }

  console.log(`\n  ${findings.length} finding(s):\n`)
  for (const f of findings) {
    console.log(`  ── ${f.check}: ${f.message}`)
    for (const d of f.detail ?? []) console.log(d ? `       ${d}` : '')
    console.log('')
  }
  return 1
}

/**
 * `process.exitCode`, never `process.exit()` — same reason as scripts/auth-templates.mjs:
 * exiting while a child process's pipes are still draining loses output on Windows, and a
 * checker whose findings do not reach the log is worse than no checker.
 */
try {
  process.exitCode = main()
} catch (error) {
  console.error(`\n  ${error.message}\n`)
  process.exitCode = 2
}
