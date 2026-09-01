# `vercel.json`, and the one thing in it

Added 2026-09-01 with the billing ladder. It holds a single cron entry and nothing else, and
this file is why — AGENTS.md said *"no cron, no worker, no queue, no `vercel.json`"* as a
statement of fact until then, and a file appearing in the root of a repo with no explanation is
how a deployment gains behaviour nobody reviewed.

## What it does

```
40 * * * *   GET /api/billing/notices
```

Hourly at forty past, it asks the app to drain the billing notice queue — the dunning ladder's
five emails and the retention window's four reminders. That route sends mail and decides
nothing; `sweep_platform_billing()` in the database has already decided which notices are due.

## Why the work is split across two schedulers

`20260901000002` §E argues it at length and this is the short version. Neither half can do the
other's:

| | |
|---|---|
| `pg_cron`, twenty past | **State.** Enqueue due notices, drop a delinquent family to Free, delete a withheld tier's data. It has no network — `http` and `pg_net` are both available on this project and neither is installed, and putting an outbound HTTP call inside a transaction that also deletes a family tree is not something to do casually. |
| Vercel Cron, forty past | **Mail.** Claim pending notices and send them. It makes no decisions and can move no tier. |

Twenty minutes apart so the state is settled before the mail is composed; both hourly because
both are idempotent and a missed run then costs an hour rather than a day.

## What happens if this never runs

**Nothing is deleted.** Both deletion paths refuse to act unless the notices they owed are
recorded as `sent`, so an unset secret, a paused project or a mail outage delays a deletion
indefinitely and never causes one. That is the correct direction to fail and it is asserted in
the migration's verify block, not merely intended.

What a family loses meanwhile is the warning, not the data.

## `CRON_SECRET` (GO LIVE)

Vercel sets `Authorization: Bearer $CRON_SECRET` on its own cron requests when the variable
exists, so the scheduled caller needs no configuration beyond that. **The route refuses with
503 when it is unset** rather than running open — a deployment that has not been configured
must not have a mail-sending endpoint reachable by anybody.

Set it in Vercel → Project → Settings → Environment Variables, on Production. Any long random
string; it is compared in constant time and never logged.

To drive it by hand:

```bash
curl -i -X POST https://genorra.com/api/billing/notices \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Two things this file is NOT

* **Not a deploy hook.** AGENTS.md's "How migrations reach the hosted project" explains why
  those cannot work here: deploy hooks are part of Vercel's git integration, so turning git
  deployments off stops them firing too. Migrations are gated by a Deployment Check, and
  nothing about that arrangement changes.
* **Not a place to add configuration.** Everything else this project needs from Vercel —
  build settings, the migration check, deployment protection — is set in the dashboard where
  it already is. A `vercel.json` that starts collecting redirects and headers is a second
  place for routing to be decided, and `proxy.ts` is the first.
