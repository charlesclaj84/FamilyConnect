/**
 * A no-op stand-in for `server-only`.
 *
 * That import is a BUNDLER marker, not a package: Next resolves it to a module that throws if
 * it ever lands in a client bundle, and there is nothing on disk for Node to load. Vitest is
 * neither, so a module carrying it cannot be imported without this alias.
 *
 * It is aliased in `vitest.integration.config.mts` ONLY. Do not add it to `vitest.config.mts`:
 * that runner's include is `lib/**` and its whole argument is that it has no Supabase, so a
 * `server-only` module has no business being loaded there — and an alias that makes one
 * loadable is exactly how that boundary would erode.
 */
export {}
