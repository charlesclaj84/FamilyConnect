import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Unit tests for the PURE modules under `lib/`, and nothing else.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS DELIBERATELY SMALL ───────────────────────────────
 * `npm run test:rls` was the only test runner in this repo, and it is the right shape for
 * what it covers: it calls server actions for real, against a local Postgres with the
 * real policies applied, because family isolation is enforced by SQL that no file in this
 * repo contains verbatim (AGENTS.md §7). It cannot cover arithmetic. Its fixtures seed
 * dues schedules with no `start_date` at all, so an assertion about installment maths
 * there would exercise one null branch and pass while testing nothing — exactly the
 * "green suite is not evidence" failure that section warns about.
 *
 * `lib/dues-utils.ts` is where that arithmetic lives, and `duesPlanMath` takes `today` as
 * a parameter precisely so it can be checked: month-end overflow, a member who overpaid, a
 * schedule that has not started, a waiver, a reversal. Those are cases you verify by
 * running them, not by reading them.
 *
 * ── THE `include` IS A BOUNDARY, NOT A DEFAULT ──────────────────────────────────────
 * `lib/**` only. This runner has no jsdom, no React and no Supabase: it must never become
 * a second, weaker place to "test" a server action, because an action tested without RLS
 * is an action tested without the thing that protects it. If a test wants a database, it
 * belongs in `tests/rls`.
 *
 * `tests/rls` is excluded explicitly as well as by the include, since those files are
 * `.mjs` driven by their own loader and would be picked up by a widened glob later.
 */
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    exclude: ['node_modules/**', 'tests/rls/**'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
