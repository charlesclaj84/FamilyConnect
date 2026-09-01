/**
 * The local Supabase stack's own credentials, read from the CLI rather than typed.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────
 * Every hand-run probe in this repo — `i18n:onscreen`, `realtime:check`, `auth-email:check` —
 * needs the local stack's anon and service keys, and the documented way to supply them was a
 * shell line prefixing three `VAR=value` assignments. That is bash syntax. **PowerShell rejects
 * it**, which is where this file came from:
 *
 *     NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run dev
 *     The term 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321' is not recognized …
 *
 * and the instructions in the two script headers wrote the keys as `<local anon>`, which reads
 * as a placeholder to a person and is one to a shell.
 *
 * ── AND THE FAILURE IT PREVENTS IS WORSE THAN A SYNTAX ERROR ───────────────────────
 * A syntax error is loud. What is NOT loud is the case TODO.md already records: a dev server
 * started with no local override still runs, still answers 200, and authenticates none of the
 * probe's requests — because `.env.local` points at HOSTED and the forged session cookie is
 * named for a different project. All 46 protected routes then render the signed-out shell and
 * the probe reports a tidy little list of page titles. That is the positive-control lesson
 * arriving in a tool: an answer that looks clean because the question was never asked.
 *
 * Discovering the keys removes the step somebody can get wrong.
 *
 * ── LOCAL ONLY, AND IT CANNOT BE ANYTHING ELSE ─────────────────────────────────────
 * `supabase status` describes the stack running on this machine. It has no route to a hosted
 * project, so nothing here can accidentally point a probe — or a dev server — at production.
 * The keys it prints are the CLI's fixed local demo keys, published in Supabase's own docs;
 * they are not secrets and are already in this repo's transcripts and issue threads.
 */

import { execFileSync } from 'node:child_process'

/** Parse `KEY="value"` lines. Anything else on the stream (warnings, notices) is ignored. */
function parseEnv(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const m = /^([A-Z0-9_]+)="(.*)"\s*$/.exec(line.trim())
    if (m) out[m[1]] = m[2]
  }
  return out
}

/**
 * The local stack's URL and keys, or `null` when it is not running.
 *
 * Returns `null` rather than throwing so a caller can print its own instruction — "run
 * `npx supabase start`" is a better message than a stack trace from `execFileSync`.
 */
export function localStack() {
  let raw
  try {
    raw = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Windows resolves `npx` through the shell; without this the spawn fails with ENOENT.
      shell: process.platform === 'win32',
    })
  } catch {
    return null
  }
  const env = parseEnv(raw)
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) return null
  return {
    apiUrl: env.API_URL,
    anonKey: env.ANON_KEY,
    serviceKey: env.SERVICE_ROLE_KEY,
    dbUrl: env.DB_URL ?? null,
    mailpitUrl: env.MAILPIT_URL ?? null,
  }
}

/**
 * The environment a Next process needs to talk to the LOCAL stack.
 *
 * ── IT OVERRIDES `.env.local`, AND THAT IS THE POINT ──────────────────────────────
 * Next loads `.env.local` and then the real environment wins, so passing these to a spawned
 * `next dev` points it at the local stack whatever the file says. `npm run dev` on its own
 * still uses `.env.local`, which is correct — that is how somebody works against hosted data.
 */
export function localStackEnv(stack) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey,
  }
}

/** One sentence, for a script that cannot continue. Kept here so all of them say the same one. */
export const NOT_RUNNING =
  'The local Supabase stack is not running — start it with `npx supabase start` and try again.'
