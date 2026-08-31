/**
 * The permission model's vocabulary, in a module with NO IMPORTS.
 *
 * ── WHY IT IS ITS OWN FILE ─────────────────────────────────────────────────────────
 * These three declarations lived in `lib/auth/permissions.ts`, which imports
 * `@/lib/supabase/admin` — the module that reads `SUPABASE_SERVICE_ROLE_KEY`. So every
 * client component that reached `PERMISSION_ACTIONS` through
 * `components/admin/resource-groups.ts` pulled the admin client into the browser's module
 * graph:
 *
 *     components/admin/resource-groups.ts   (plain module, imported by client components)
 *       → @/lib/auth/permissions            (for the PERMISSION_ACTIONS value)
 *         → @/lib/supabase/admin            (which reads SUPABASE_SERVICE_ROLE_KEY)
 *
 * ── IT WAS NOT A LEAK, AND THAT IS THE UNCOMFORTABLE PART ──────────────────────────
 * The key has no `NEXT_PUBLIC_` prefix, so Next never inlined it and the reference
 * compiled to `undefined`. The protection was a build-time convention rather than a
 * boundary anybody drew — and the instinctive repair for a symptom of that shape is
 * exactly wrong: adding the prefix to "make it work" would ship the service-role key to
 * every browser. `lib/meta/no-client-secrets.test.ts` found the chain on its first run.
 *
 * ── THE TYPES WOULD HAVE BEEN FINE. THE VALUE IS WHAT MOVED ────────────────────────
 * `PermissionAction` and `PermissionScope` are type-only and erased at build time, so
 * importing them across that edge cost nothing. `PERMISSION_ACTIONS` is a runtime array,
 * and a runtime import is a real edge in the graph. They travel together anyway: a type
 * and the array that enumerates it are one fact, and splitting them is how the two come to
 * disagree about how many actions there are.
 *
 * ── THE SHAPE THIS CODEBASE ALREADY USES TWICE ─────────────────────────────────────
 * `lib/gathering-panes.ts` and `components/admin/account-sections.ts` both exist for the
 * mirror-image reason — a Server Component importing a runtime value from a `'use client'`
 * module gets a client reference rather than the value. Same boundary, opposite direction,
 * same answer: a pure module both sides import.
 *
 * NOTHING MAY BE ADDED HERE THAT IMPORTS ANYTHING. That is the whole property; a single
 * import of `@/lib/auth/permissions` from this file would restore the chain in the
 * direction nobody would think to check.
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

/**
 * Scope: `'none'` denied · `'own'` only rows the caller owns · `'any'` all rows in the
 * family. `'create'` treats own and any alike — you cannot own a record you are about to
 * make.
 */
export type PermissionScope = 'none' | 'own' | 'any'

/**
 * The four actions, in the order the grid draws them.
 *
 * ORDER IS PART OF IT: Members & Access renders one column per entry, and a family reading
 * the grid left to right reads them as increasing consequence — see, make, change, remove.
 */
export const PERMISSION_ACTIONS: readonly PermissionAction[] = ['view', 'create', 'edit', 'delete']
