# `vercel.json`, and the two things in it

Added 2026-09-01 with the billing ladder. It holds two cron entries and nothing else, and this
file is why — AGENTS.md said *"no cron, no worker, no queue, no `vercel.json`"* as a statement
of fact until then, and a file appearing in the root of a repo with no explanation is how a
deployment gains behaviour nobody reviewed.

**TWO IS THE HOBBY LIMIT**, which is worth knowing before a third is wanted: Vercel's Hobby
plan allows two cron jobs and daily granularity only, rejecting a finer expression at deploy
time. A third scheduled thing therefore joins an existing route rather than getting its own —
and the section below on the second entry argues which way that choice should go.

## What it does

```
40 0 * * *   GET /api/billing/notices
 0 3 * * *   GET /api/geo/zip-counties
```

Once a day at 00:40 UTC, it asks the app to do the four things this product cannot do without a
clock. All four ride one route because **it is the only place in GENORRA where Node runs on a
schedule with the service key** — not because they belong together:

| | |
|---|---|
| **Platform billing mail** | The dunning ladder's five emails and the retention window's four reminders. `sweep_platform_billing()` in the database has already decided which are due; this route only sends. |
| **Family dues reminders** | `lib/dues/reminders.ts`. Queues an installment falling in the next fortnight and mails it once. |
| **The storage reaper** | `lib/billing/storage-reaper.ts`. Deletes the bytes behind a purge, which SQL structurally cannot reach. |
| **The subscription reaper** | `lib/billing/subscription-reaper.ts`, added 2026-09-01. Cancels the Stripe subscriptions behind a purge, which `pg_cron` cannot reach either. **The most urgent of the four:** every row left in that queue is a relative's card still being charged. |

**THE FIRST TWO ARE OPPOSITE DIRECTIONS OF MONEY AND MUST NEVER BE CONFLATED.** AGENTS.md's
*"MONEY HAS TWO DIRECTIONS"* is the rule: the platform mail is about what a FAMILY owes GENORRA
and has a lockout and a deletion behind it; a dues reminder is about what a RELATIVE owes their
own family and has no consequence at all — no late fee, no lockout, no ladder. They share a
schedule and nothing else. A reminder that acquired the word "overdue" would be a change of
product, not of copy.

**EACH RUNS IN ITS OWN `try`, IN THAT ORDER.** A failure in the reminders must not cost a dunning
notice that has already been composed, and a failure in either reaper must not cost either. The
response body reports all four separately so a partial run is legible rather than looking like
a success.

**AND THE TWO REAPERS ARE NOT THE SAME SHAPE, WHICH IS THE ONE THING TO KNOW BEFORE EDITING
EITHER.** The storage one works out what to delete AFTER the purge, by listing the bucket and
subtracting the rows that survived — so its whole hazard is a failed read making every object
look like an orphan. The subscription one CANNOT do that: once `dues_autopay` is deleted, nothing
in the database names those subscriptions and no question put to Stripe would recover which
family they belonged to. So `20260901000008` has the purge capture the ids **before** it deletes
them, into `platform_subscription_cancellations`, and this route drains that queue. A row that
never drains is a charge that never stops, which is why a failed attempt is returned to `pending`
for five days and then marked `failed` rather than being filed as done.

## The second entry: the ZIP-to-county crosswalk

Added 2026-09-03. `/api/geo/zip-counties` refreshes `zip_counties` from the HUD USPS file —
public government data, ~54,000 (zip, county) pairs, and the thing TODO.md named as the blocker
on county-level weather-alert matching.

**IT IS ITS OWN ROUTE RATHER THAN A FIFTH JOB ON THE FIRST ONE**, which is a departure from the
paragraph above and is deliberate. Those four ride together *"because it is the only place in
GENORRA where Node runs on a schedule with the service key"* — necessity, not kinship — and
that necessity is gone the moment a second entry is allowed. Two reasons decided it:

* **They share nothing.** Four jobs about a family's money, on a strict ordering behind two
  `pg_cron` sweeps; one job about postal codes, on no schedule anybody depends on.
* **A slow HUD fetch would delay a dues reminder.** The first route's own rule is that a failure
  in one job must not cost another; a multi-megabyte fetch from a government API in the same
  handler is the same coupling arriving as latency instead of an exception.

**THREE CADENCES, AND EACH IS FORCED BY SOMETHING DIFFERENT.** HUD publishes QUARTERLY. The
refresh is WEEKLY, so a new quarter is picked up within seven days rather than an identical
document being fetched ninety times a quarter. The cron is DAILY, because that is the only
granularity Hobby offers and because a cron expression cannot say *"the last success was seven
days ago"*.

**SO THE INTERVAL LIVES IN `zip_county_refreshes`, NOT IN THE SCHEDULE**, and that is the better
place for it: a missed day does not skip a week, and the throttle survives the schedule being
changed. Most runs answer `not-due` and cost one indexed query. It is the same shape as
`cycle_on` on a dunning notice — idempotency in a row rather than in a clock.

**IT NEEDS `HUD_USPS_API_TOKEN`**, a free credential from a huduser.gov registration, and
without it every run answers `skipped` rather than failing. A missing credential is a deployment
state; and this job must not be the reason a red row appears in the platform's cron log every
day. TODO.md carries the token as a GO LIVE item.

**THE DANGEROUS OPERATION IS A DELETE, AND IT IS SQL'S JOB.** `replace_zip_counties(jsonb)`
replaces the rows for exactly the ZIPs in each batch and leaves every other ZIP alone, in one
statement — so a fetch that returns half a file refreshes half the ZIPs and destroys nothing.
There is no sequence of failures that empties the table, and nothing in the Node module deletes
anything. `20260903000002`'s header weighs that against truncate-and-insert and against
upsert-only.

## Why the work is split across two schedulers

`20260901000002` §E argues it at length and this is the short version. Neither half can do the
other's:

| | |
|---|---|
| `pg_cron`, 00:20 UTC | **State.** Enqueue due notices, drop a delinquent family to Free, delete a withheld tier's data. It has no network — `http` and `pg_net` are both available on this project and neither is installed, and putting an outbound HTTP call inside a transaction that also deletes a family tree is not something to do casually. |
| Vercel Cron, 00:40 UTC | **Everything that needs the network or a storage client.** Claim pending notices and send them; queue and send dues reminders; delete the bytes behind a purge; cancel the subscriptions behind a purge. It makes no decisions about a family's standing and can move no tier. |

Twenty minutes apart so the state is settled before the mail is composed.

**AND TWO THINGS ARE HERE BECAUSE SQL CANNOT REACH THEM AT ALL**, which is a stronger reason than
"it needs the network":

* **Storage.** `storage.protect_delete()` refuses a direct `DELETE FROM storage.objects` and a
  `pg_cron` job has no Storage API. So a purged family kept every image file, in a bucket that is
  `public: true`, until `20260901000006`.
* **`duesPlanMath`.** A dues reminder needs the cadence ladder, the month-end clamp, arrears
  against settled cents, waivers, the age rule, the bloodline and the scope — all of it tested
  TypeScript. A plpgsql copy would be a second implementation of a rule that already has one.

## Why once a day, and why just after midnight

Three schedules run in order, and `20260901000005` argues the whole decision:

```
00:05 UTC   platform-tier-sweep        a term that ended moves the tier
00:20 UTC   platform-billing-ladder    measures after that, enqueues notices, deletes
00:40 UTC   POST /api/billing/notices  sends what was enqueued        ← this file
```

**Every one of them decides from a UTC DATE** — a term that ended, a delinquency that reached
day 5, 15, 30, 45 or 60. A date changes once a day at midnight, so the hourly schedules these
replaced spent twenty-three runs in twenty-four re-asking a question whose answer could not
have changed.

**Nobody waits a day for a purchase.** `app/api/stripe/platform/route.ts` applies tier changes
at the end of every signature-verified delivery, so an upgrade lands in seconds. The daily jobs
are the backstop for the one case that produces no Stripe event at all: a term simply lapsing.

**And this file had a second reason to move.** Vercel's Hobby plan permits cron at a daily
granularity only, and rejects an hourly expression at deploy time. Daily deploys on either
plan, which removes a class of "it works on mine".

## What happens if this never runs

**Nothing is deleted, and nothing is deleted wrongly.** Three separate arguments, and they fail
in the same direction:

* **The platform deletion paths refuse to act unless the notices they owed are recorded as
  `sent`.** So an unset secret, a paused project or a mail outage delays a deletion indefinitely
  and never causes one. That is asserted in `20260901000002`'s verify block, not merely intended
  — removing the two conjuncts turns the assertion red.
* **The storage reaper abandons a family on any failed read.** It deletes an object no surviving
  row points at, so a refused survivor query would make every photograph look like an orphan.
  `npm run reaper:check` breaks that read for real and asserts nothing is removed.
* **A dues reminder that never sends is a reminder nobody got.** No consequence follows from an
  unpaid family due, so this one costs a courtesy rather than anything a family can lose.

What a family loses meanwhile is the warning, not the data.

## `CRON_SECRET`

**Set on Production and confirmed 2026-09-01.** Vercel sets
`Authorization: Bearer $CRON_SECRET` on its own cron requests when the variable exists, so the
scheduled caller needs no configuration beyond that. It is compared in constant time and never
logged.

**The route refuses with 503 when it is unset** rather than running open — a deployment that
has not been configured must not have a mail-sending endpoint reachable by anybody. That is
also the whole diagnostic, so the three answers are worth knowing:

```bash
curl -i -X POST https://genorra.com/api/billing/notices \
  -H "Authorization: Bearer $CRON_SECRET"
```

| | |
|---|---|
| **200** `{"claimed":0,"sent":0,"failed":0}` | the secret matched and the drain ran. Zero counts on a healthy estate mean an empty queue, not a failure — this endpoint does nothing on most days. |
| **503** | the variable is not visible to the running deployment. Check it is on Production, and that there has been a build since it was set — environment variables only reach a new one. |
| **401** | it is set, and the secret sent does not match. |

## Two things this file is NOT

* **Not a deploy hook.** AGENTS.md's "How migrations reach the hosted project" explains why
  those cannot work here: deploy hooks are part of Vercel's git integration, so turning git
  deployments off stops them firing too. Migrations are gated by a Deployment Check, and
  nothing about that arrangement changes.
* **Not a place to add configuration.** Everything else this project needs from Vercel —
  build settings, the migration check, deployment protection — is set in the dashboard where
  it already is. A `vercel.json` that starts collecting redirects and headers is a second
  place for routing to be decided, and `proxy.ts` is the first.
