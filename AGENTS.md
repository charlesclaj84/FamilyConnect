<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Authorization is not optional

Every page, sub-page, feature and server action checks the caller's permissions
itself. No exceptions, and no relying on something upstream having already checked.

The reason is structural, not stylistic: **a server action is a public HTTP endpoint.**
Next.js gives every `'use server'` function a URL, and anyone signed in can call it
with any arguments they like. The page that renders the form is not a gate — it is a
convenience. An action that trusts the page protecting it is unprotected.

## 1. Every page gates at load

Immediately after resolving the user, before any data is read:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
await requireView(user.id, '<resource-key>')   // 404s anyone without view
```

The resource key is the route without its leading slash, and the route must be
registered in `lib/features.ts` — `viewableResources()` walks that registry to build
the sidebar, so an unregistered page can never be hidden from anyone.

The only page exempt is `/coming-soon`, which must render precisely when the caller
*cannot* reach a feature.

## 2. Every server action gates itself

Read the user, then check, then act:

```ts
if (!(await canAny(user.id, 'family-finances', 'edit'))) {
  return { success: false, message: 'Not authorized' }
}
```

Pick the check deliberately — see `lib/auth/permissions.ts`:

| Helper | Use for |
|---|---|
| `can()` | Access at all. True for scope `'own'`, so only where RLS or the action then narrows the write to rows the caller owns. |
| `canOn()` | A specific row, honouring own-vs-any. Pass the people.id that owns it. |
| `canAny()` | Records with no coherent "own" version — family-wide configuration (funds, schedules, milestones, routing), and anything where the row a member would "own" is the abuse case. A disbursement paying **themselves** is the example that motivated this helper. |

Which resource key governs which table is recorded in `permission_table_map`
(migration `20260618000001`). Use the same key the RLS policy uses; the code and the
database must never disagree about who may do what.

`lib/auth/guard.ts` wraps the whole preamble — auth, permission, family code — in one
call, so it cannot be half-written:

```ts
const g = await requireEdit('elections')
if (!g.ok) return { success: false, message: g.message }
// g.familyCode, g.personId, g.userId
```

### Self-service actions check ownership, not a grant

Sending a chat message, submitting an RSVP, casting a vote, editing your own profile:
things every member may do by definition. `create` and `edit` default to scope `'none'`,
so demanding a grant for these would lock the whole family out of chat.

These use `requireMember()` — and they still owe a check, just a different one: that
the row being touched is genuinely the caller's, and that every id arriving from the
client belongs to their family. `submitRsvp` is the worked example: any member may
RSVP, but only to their own family's event, and only for people in it.

"No permission needed" never means "no check needed".

## 3. The service-role client bypasses RLS — so redo its work

`createAdminClient()` is the service role. No RLS, no family isolation, nothing.
Every query through it must re-apply by hand what RLS would have done:

```ts
.eq('family_code', familyCode)                 // on every read, write and delete
```

Any id arriving from a caller (`fundId`, `personId`, `scheduleId`) must be verified to
belong to this family *before* it is written onto a row. `.eq('id', id)` alone lets one
family reach another's records.

Prefer the user's client (`createClient()`) where RLS can do the work; reach for the
admin client only when the query genuinely needs to see past it, and say why.

## 4. Gate the fetch, not just the button

Hiding a control does not protect the data behind it. Props are serialized into the
RSC payload and reach the browser whether or not a component renders them, so a page
that fetches the member roster and then hides the form has still published the roster.

Decide what the caller may *see*, fetch only that, and let the UI follow.

## 5. New permissioned surfaces need a migration

A new page needs a row in `permission_resources` so administrators can restrict it in
Groups & Permissions. Without one it still works — an unregistered resource defaults
to viewable — but it can never be turned off, which is a silent default nobody can fix
from the UI. Add the row in a new migration *and* in the seed in `20260618000000`,
whose insert is `ON CONFLICT DO UPDATE` and would otherwise revert it on replay.
