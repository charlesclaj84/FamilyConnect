/**
 * Point the app's Supabase clients at the LOCAL stack.
 *
 * Never the hosted project: this suite creates users, families and rows, and
 * proves isolation by attacking them. It must run somewhere disposable.
 *
 * Keys come from `supabase status` so there is nothing to keep in sync by hand.
 * Pre-set environment variables win, so CI can inject its own.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let status
try {
  // shell:true because on Windows the CLI is a .cmd shim, which Node refuses to
  // exec directly (EINVAL).
  const raw = execFileSync(
    'npx',
    ['supabase', 'status', '-o', 'env', '--workdir', ROOT],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true },
  )
  // `-o env` emits KEY="value" lines, prefixed by a "Stopped services:" notice
  // when some optional container is down. Parse the lines that look like keys
  // and ignore the rest.
  status = {}
  for (const line of raw.split('\n')) {
    const m = /^([A-Z0-9_]+)="(.*)"\s*$/.exec(line.trim())
    if (m) status[m[1]] = m[2]
  }
} catch (err) {
  throw new Error(
    'Could not read local Supabase status. Start it first:\n\n' +
    '    npx supabase start\n\n' +
    `(underlying error: ${err.message})`,
  )
}

if (!status?.API_URL || !status?.SERVICE_ROLE_KEY) {
  throw new Error('supabase status returned no API_URL / SERVICE_ROLE_KEY — is the stack running?')
}

const guard = (url) => {
  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error(`Refusing to run against a non-local Supabase: ${url}`)
  }
  return url
}

export const API_URL = guard(status.API_URL)
export const ANON_KEY = status.ANON_KEY
export const SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY

// The app's own modules read these.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= API_URL
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY ??= SERVICE_ROLE_KEY
