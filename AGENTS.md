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

## 4. RLS checks the row — not the ids the row references

The one hole Row Level Security structurally cannot close, and it applies on the
**user** client too, not just the admin one.

A policy is a predicate over the row being written. When an action takes an id from
the client and writes it onto a row of the caller's *own* family, the row is
genuinely theirs — its `family_code` satisfies every policy — while the id it
carries points into somebody else's family. Nothing in the database objects,
because nothing in the database was asked:

```ts
// caller is in BRAVO; personId is a people.id in ALPHA
await supabase.from('person_relationships').insert({
  person_id: myPeopleId,
  related_person_id: personId,     // ← never checked
  family_code: familyCode,         // ← BRAVO, so RLS is satisfied
})
```

So verify the reference before writing it:

```ts
if (!(await belongsToFamily('people', personId, familyCode))) {
  return { success: false, message: 'Person not found' }
}
```

`belongsToFamily(table, id, familyCode)` is in `lib/auth/family.ts`. It uses the
service-role client on purpose: the answer must not depend on whether the caller
holds view permission on the referenced table, or a family that restricts its
Member Directory would break its own family tree.

This is the rule `upsertSpouse`, `upsertAncestor`, `acceptSpouseChild` and
`setMyDuesPlan` were each missing — all four let one family's member link or enrol
against another family's records, and all four passed a reading of the policies,
because the policies were right. Any parameter named `existing_person_id`,
`personId`, `scheduleId`, `fundId`, `eventId` deserves the same look.

## 5. Gate the fetch, not just the button

Hiding a control does not protect the data behind it. Props are serialized into the
RSC payload and reach the browser whether or not a component renders them, so a page
that fetches the member roster and then hides the form has still published the roster.

Decide what the caller may *see*, fetch only that, and let the UI follow.

## 6. New permissioned surfaces need a migration

A new page needs a row in `permission_resources` so administrators can restrict it in
Groups & Permissions. Without one it still works — an unregistered resource defaults
to viewable — but it can never be turned off, which is a silent default nobody can fix
from the UI. Add the row in a new migration *and* in the seed in `20260618000000`,
whose insert is `ON CONFLICT DO UPDATE` and would otherwise revert it on replay.

## 7. Every RLS-path action owes a test

An action that reaches the database through `createClient()` has delegated its family
isolation to Row Level Security. Reading the policy is not the same as running it, and
the policies here are not hand-written — `20260618000001` *composes* them out of
`pg_policies` at migration time, so what actually protects a table is a string that
existed in no file anyone reviewed.

```bash
npx supabase start      # once; local only, never the hosted project
npm run test:rls
```

`tests/rls` calls each action for real — the exported function Next.js publishes as an
HTTP endpoint — against a local Postgres with the real policies applied. Only the
cookie-to-JWT plumbing and two `next/*` modules are substituted; the guards,
`lib/auth/permissions.ts`, the admin client and the policies are all genuine.

**Adding an action means adding a case** to `tests/rls/cases.mjs`. The shape is fixed
and the two halves are both load-bearing:

* **The attack** is BRAVO's *administrator* — scope `'any'` on every resource — passing
  ALPHA's real ids. Giving the attacker every grant their own family can confer takes
  the permission layer out of the result: whatever they still reach, they reached
  because family isolation failed, not because nobody had checked a grant. An attacker
  with no permissions proves nothing.

* **The positive control** is the same call, same arguments, run by someone in ALPHA
  who is entitled to it. Without it the suite rots into decoration: an action that
  returns `[]` for everybody — renamed table, unseeded fixture, unattached JWT, a
  query PostgREST refused — passes an isolation assertion trivially. Three of the
  bugs found while writing this suite were found by the control, not the attack.

Where a control genuinely cannot apply, say so in the case (`positive:
'not-applicable'` plus a `why`) rather than deleting it. The runner reports those
separately, so a gap stays visible instead of blending into the green.

Two failure modes to watch for in the fixture itself, both of which silently turn a
real finding into a pass: a case whose positive control **mutates a row a later case
depends on** (give it its own row — that is what `deletableChild` is for), and a probe
whose projection **omits the column the control changes**, so a successful write looks
like a no-op.

## 8. An empty result is not the same as no rows

`const { data } = await supabase.from(…)` discards the error. When PostgREST refuses a
query the action does not fail — it returns `[]`, and the page renders "nothing here"
over data that exists.

The recurring cause is an ambiguous embed. Where two foreign keys join the same pair
of tables, `people(first_name)` is refused with **PGRST201** and the whole query dies:

```ts
.select('*, people!fund_disbursements_person_id_fkey(first_name, last_name)')
```

`fund_disbursements`, `fund_contributions`, `dues_payments`, `election_votes`,
`election_nominations`, `photo_tags`, `event_rsvp_attendees` and
`person_relationships` all have two paths to `people`; `photo_collections` has two to
`photos` (its rows, and its cover). Name the constraint. And check the relationship
exists at all before embedding it — `event_rsvp` has no foreign key to `people`, so
`event_rsvp(people(...))` is PGRST200, equally silent.

To find every pair that needs disambiguating:

```sql
SELECT conrelid::regclass, confrelid::regclass, count(*)
FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
GROUP BY 1,2 HAVING count(*) > 1;
```

## Running the database locally

`supabase/seed.sql` restores the table grants the hosted project has and a current
CLI does not create; without it every query fails `permission denied` and — the part
that matters — the RLS suite goes green while testing nothing. Read the file before
changing it.

Migrations must apply to an empty database. `20260618000002` is deliberately an empty
file: it is superseded by `20260618000003`, and running its `DROP COLUMN` at that point
in the chain fails against the ~64 policies still referencing `people.is_admin`. Verify
with `npx supabase db reset`, not by reading.
