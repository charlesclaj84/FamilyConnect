import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireView, canAny } from '@/lib/auth/permissions'
import {
  getBoardPositions, getBoardPositionHolders, getAssignableMembers,
  getBoardPositionScopeOptions,
} from '@/app/actions/admin/chapters'
import { AdminBoardPositionsClient } from '@/components/admin/AdminBoardPositionsClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Board Positions — Admin' }

/**
 * The positions a family's board has, and who holds each one.
 *
 * ── §1 ──────────────────────────────────────────────────────────────────────────────
 * `requireView` and not a union of `can()` calls, so the removed-family and tier gates come
 * with it — that is the whole reason it is one call, and `/admin/users` is the page AGENTS.md
 * names for having taken it apart and dropped half.
 *
 * ── §5: THE WRITE RIGHTS ARE RESOLVED HERE, AND TWO OF THE FETCHES DEPEND ON THEM ───
 * The old version handed the client nothing but the list, so a view-only caller got an Edit
 * button, an Add form and a delete icon on every row — controls that could only ever fail.
 * `AdminRegionsChaptersClient` next door takes `mayCreate`/`mayEdit`/`mayDelete` and this
 * follows it.
 *
 * It is not only about hiding buttons. The roster and the region/chapter lists exist ONLY to
 * fill the assignment dialog, so a caller who cannot assign is not sent them: props are
 * serialised into the RSC payload whether or not a component renders them, and a family's
 * roster is PII. `Promise.resolve([])` in place of the query is the shape `/gatherings` uses.
 */
export default async function AdminBoardPositionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'admin/boardpositions')
  // AND `canAny` ON TOP OF IT, which is not belt-and-braces. `requireView` is `can()`, so
  // scope 'own' opens this page, while every read behind it is `requireScope` — `canAny` —
  // and answers `[]` for that caller. This line is what stops that being a page that opens
  // over an empty list nobody can diagnose: an 'own' holder gets the same 404 as somebody
  // with no grant at all, which is the truth about a key whose tables have no owner.
  //
  // AN 'own' GRANT ON THIS KEY IS REACHABLE, and the comment here claimed otherwise for an
  // afternoon. `NO_OWNER_KEYS` only decides which switches Members & Access DRAWS;
  // `setTemplatePermission` takes a scope from the client and validates it against nothing,
  // so a POST can store 'own' for any key. TODO.md carries that as its own entry, because
  // it is every key's problem and not this page's.
  if (!(await canAny(user.id, 'admin/boardpositions', 'view'))) notFound()

  // `canAny`, matching every write action behind this screen. A board position is family-wide
  // configuration and nobody owns one, so scope 'own' is not a legitimate way to hold any of
  // these — see the section header in app/actions/admin/chapters.ts, and `NO_OWNER_KEYS`.
  //
  // The alternative to the `canAny` line above was loosening the READS to `requireRead`, and
  // that is what §2 forbids: `family_roles`' composed policy tests `auth_permission(…) = 'any'`
  // and its `own_expr` is the literal 'false', so a read that accepted 'own' would have the
  // code and the database disagreeing about who may do what.
  const [mayCreate, mayEdit, mayDelete] = await Promise.all([
    canAny(user.id, 'admin/boardpositions', 'create'),
    canAny(user.id, 'admin/boardpositions', 'edit'),
    canAny(user.id, 'admin/boardpositions', 'delete'),
  ])

  const [positions, holders, members, scopeOptions] = await Promise.all([
    getBoardPositions(),
    getBoardPositionHolders(),
    mayEdit ? getAssignableMembers()        : Promise.resolve([]),
    mayEdit ? getBoardPositionScopeOptions() : Promise.resolve({ regions: [], chapters: [] }),
  ])

  return (
    <PageShell>
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold">Board Positions</h1>
        <p className="text-muted-foreground">
          The offices your family keeps, and who holds each one.
        </p>
      </div>
      <AdminBoardPositionsClient
        initialPositions={positions}
        initialHolders={holders}
        members={members}
        regions={scopeOptions.regions}
        chapters={scopeOptions.chapters}
        mayCreate={mayCreate}
        mayEdit={mayEdit}
        mayDelete={mayDelete}
      />
    </PageShell>
  )
}
