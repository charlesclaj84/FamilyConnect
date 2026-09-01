import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Integration checks that need the LOCAL SUPABASE STACK, and nothing else.
 *
 * ── WHY A SECOND CONFIG RATHER THAN A WIDER `include` ───────────────────────────────
 * `vitest.config.mts`'s `include` is a stated BOUNDARY, not a default: `lib/**` only, no
 * jsdom, no React and no Supabase, so that it can never become a second, weaker place to
 * test a server action. Widening it to reach this file would delete that argument.
 *
 * So this is a separate runner with a separate command (`npm run reaper:check`), and it is
 * deliberately NOT part of `npm test` or `verify.yml` — it needs `npx supabase start`, which
 * puts it on the same footing as `realtime:check` and `auth-email:check`.
 *
 * ── WHAT BELONGS HERE, WHICH IS ALMOST NOTHING ──────────────────────────────────────
 * One thing today: the storage reaper, which permanently deletes files and whose whole
 * safety argument is about what a REAL failed read does. That cannot be checked without a
 * real database and a real bucket, and `tests/rls` cannot host it either — that suite calls
 * server actions through PostgREST, and the reaper is not one.
 *
 * A test that does not need the stack belongs in `lib/**` under the other config. If this
 * directory grows past a handful of files, that is a sign something is being tested here
 * because it was convenient rather than because it needs a database.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
    // A real stack, real uploads and real deletes. The default 5s is not enough.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // ONE FILE AT A TIME. These share one database and one bucket, so parallel files would
    // race each other's fixtures — the lesson `tests/rls` already records about a case whose
    // control mutates a row a later case depends on.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // `server-only` is a bundler marker rather than a package — see the stub's own header.
      'server-only': fileURLToPath(new URL('./tests/integration/server-only-stub.ts', import.meta.url)),
    },
  },
})
