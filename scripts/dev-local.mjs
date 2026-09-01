#!/usr/bin/env node
/**
 * `next dev` pointed at the LOCAL Supabase stack, on the port the probes expect.
 *
 * ── WHY THIS IS A SCRIPT AND NOT A LINE IN THE README ─────────────────────────────
 * The line in the README was:
 *
 *     NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon> \
 *     SUPABASE_SERVICE_ROLE_KEY=<local service> npm run dev
 *
 * which is bash, and this project is developed on Windows. PowerShell reads
 * `NEXT_PUBLIC_SUPABASE_URL=…` as a command name and says so three times. The two angle
 * brackets are worse: they read as placeholders to a person and as redirections to a shell.
 *
 * An npm script cannot fix it either — npm runs scripts through `cmd.exe` on Windows and `sh`
 * elsewhere, so `FOO=bar next dev` in `package.json` is broken on exactly the platform this is
 * developed on. A Node script is the one form that behaves the same everywhere.
 *
 * ── AND THE FAILURE IT PREVENTS IS SILENT ────────────────────────────────────────
 * `scripts/local-stack.mjs` carries it in full: a dev server left on `.env.local` points at
 * HOSTED, so `i18n:onscreen`'s forged session cookie — named for the local project — matches
 * nothing, all 46 protected routes render the signed-out shell, and the probe reports a short,
 * tidy, meaningless list. Nothing about that looks like a failure.
 *
 * ── PORT 3100, WHICH IS NOT A PREFERENCE ─────────────────────────────────────────
 * `i18n:onscreen` and `realtime:check` both default to `http://localhost:3100`. Overridable
 * with `PORT`, and if you override it, override `APP_URL` for the probe as well.
 */

import { spawn } from 'node:child_process'
import { localStack, localStackEnv, NOT_RUNNING } from './local-stack.mjs'

const stack = localStack()
if (!stack) {
  console.error('')
  console.error(`  ${NOT_RUNNING}`)
  console.error('')
  process.exit(1)
}

const port = process.env.PORT ?? '3100'

console.log('')
console.log('  next dev against the LOCAL stack')
console.log(`    Supabase  ${stack.apiUrl}`)
console.log(`    app       http://localhost:${port}`)
console.log('')
console.log('  These override .env.local for this process only. `npm run dev` is unchanged and')
console.log('  still uses whatever that file points at.')
console.log('')

const child = spawn('npx', ['next', 'dev', '-p', port], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...localStackEnv(stack) },
})

// Pass the child's fate through, so Ctrl-C and a crash both behave the way they would if
// `next dev` had been run directly.
child.on('exit', code => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig))
}
