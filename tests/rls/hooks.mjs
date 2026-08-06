/**
 * Module resolution hooks so the real server actions can be imported and called
 * outside a Next.js request.
 *
 * Three jobs, and deliberately no more than three — every extra substitution is
 * a place where the code under test stops being the code that ships:
 *
 *   1. `@/x`            → the project's own file (Next's tsconfig path alias).
 *   2. `next/cache`     → a stub. `revalidatePath` throws outside a request scope.
 *   3. `next/navigation`→ a stub. `notFound()` throws a Next-internal signal.
 *   4. `@/lib/supabase/server` → a client authenticated as the current test
 *      actor, instead of one built from `cookies()`.
 *
 * Everything else is real: the guards, `lib/auth/permissions.ts`, the admin
 * client, and — the entire point of the exercise — the RLS policies in the
 * database. Node 24 strips the TypeScript types natively, so there is no build
 * step and no test-framework dependency.
 */
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

const STUBS = {
  'next/cache': join(HERE, 'stubs', 'next-cache.mjs'),
  'next/navigation': join(HERE, 'stubs', 'next-navigation.mjs'),
  '@/lib/supabase/server': join(HERE, 'stubs', 'supabase-server.mjs'),
}

const EXTENSIONS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']

function resolveFile(base) {
  for (const ext of EXTENSIONS) {
    const candidate = base + ext
    // Only a real file counts — a bare directory would resolve to nothing.
    if (existsSync(candidate) && !statSync(candidate).isDirectory()) return candidate
  }
  return null
}

export async function resolve(specifier, context, next) {
  const stub = STUBS[specifier]
  if (stub) return next(pathToFileURL(stub).href, context)

  if (specifier.startsWith('@/')) {
    const base = join(ROOT, specifier.slice(2))
    const file = resolveFile(base)
    if (file) return next(pathToFileURL(file).href, context)
  }

  return next(specifier, context)
}
