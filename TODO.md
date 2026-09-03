# TODO

Running list of things worth revisiting. Add an entry when you find something real
but out of scope for the change you are making, so it does not get lost in a commit
message.

Everything here is open. Completed work is deleted rather than archived — the write-ups
are in git history, and the lessons worth keeping have been promoted to AGENTS.md.
GO LIVE is a checklist rather than a backlog.

## GO LIVE

Things that must be true of the **hosted project** before real families use it. These
are not code changes and none of them is done by `db push` — every one is a setting or
a credential on the deployed environment, which is exactly why they are easy to reach
launch day without.

### [~] Two `[auth]` values are set in `config.toml` and not on hosted — ONE APPLIED 2026-08-29, THE OTHER NEEDS A PLAN

**Action:** nothing, until somebody decides whether this project goes to Pro. The first half
is done and verified; the second is refused by the API and cannot be done at any price short
of an upgrade.

| Setting | `config.toml` | hosted | State |
|---|---|---|---|
| `secure_password_change` | `true` | ~~false~~ → **`true`** | **DONE 2026-08-29.** PATCHed and confirmed by re-reading |
| `sessions_inactivity_timeout` | `168h` (7 days) | **unset, and must stay so for now** | **BLOCKED: HTTP 402.** *"User sessions can only be configured on Pro Plans and up."* This project is on Free |

**THE BLOCKER WAS NEVER THE TOKEN**, which is what this entry said for two weeks. A
project-scoped Management API token with **`Auth: Read + Write` and nothing else** is
sufficient for both PATCHes — the whole account-wide token the entry implied is not needed,
and the narrower one is what should be minted next time. The second setting is gated on the
PROJECT'S PLAN, which no token can widen.

**Do the two as SEPARATE PATCHes, which is how the split above was learned.** The 402 refuses
the whole request, so the combined `-d` below would have taken the password flag down with the
session timeout and reported one failure for two settings. It is left as written because it is
what the original sweep ran; send one field at a time.

**What changed for members the moment the first one landed.** GoTrue now demands the emailed
reauthentication code for a password change on any session older than 24 hours — before, the
flag was off, so there was no code at ANY session age, which is the gap AGENTS.md's "A fresh
session can change the password without the emailed code" was written against. The mail is
`supabase/templates/reauthentication.html` (the Send Email hook is still off on hosted, so
GoTrue renders it), and that template is pushed by `migrate.yml`. **Nobody has yet seen one
arrive** — see the validation note below.

**One environment fact worth carrying to the other items on this list.** On a machine behind a
TLS-inspecting proxy, Python's verifier rejects the injected CA (`Basic Constraints of CA cert
not marked critical`) while `curl` succeeds, because the Windows build links Schannel and reads
the Windows trust store. Reach for `curl` for anything hitting `api.supabase.com` from here;
the answer is never `verify=False` or `curl -k`, on a channel carrying a bearer token.

**Do not do any of this with `npx supabase config push`.** It sends the whole `[auth]`
block, `site_url` included — so pushing one setting from a checkout whose config points
anywhere but production reconfigures production's redirect handling as a side effect, and
with `site_url = "http://127.0.0.1:3000"` in play it starts mailing people links to their own
laptop. This is the warning `scripts/auth-templates.mjs`,
[supabase/templates/README.md](supabase/templates/README.md) and `config.toml` all point back
here for; it is why the auth email templates were pasted by hand for two months, and it is why
`email:push` sends ten named fields and refuses everything else.

A PATCH is safer than the dashboard is fiddly, and much safer than `config push` — it sends
only the fields named, so it can touch neither `site_url` nor the SMTP credentials that live
on hosted and in no file here:

```bash
# read first (read-only, and the only way to see any of this)
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/jdvzabunhchjetjddgdw/config/auth

# then set both. sessions_inactivity_timeout is an INTEGER OF SECONDS here, not a
# Go duration string like config.toml's — 7 days is 604800.
curl -s -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  https://api.supabase.com/v1/projects/jdvzabunhchjetjddgdw/config/auth \
  -d '{"security_update_password_require_reauthentication":true,"sessions_inactivity_timeout":604800}'
```

Re-read the GET afterwards. Neither value is visible from the app, from
`/auth/v1/settings`, or from any test — **the GET is the verification, and there is no other.**
In particular a password change on genorra.com proves nothing about the flag: GoTrue reads it
as "reauthenticate *or* have logged in recently", where recent is `session.created_at + 24h`,
so a session you have just created sails through with no code whether the flag is on or off.
**The one functional check that means anything needs a session more than 24 hours old**, and it
is still owed — nobody has watched a reauthentication email arrive on hosted.

The 2026-08-29 run also confirmed `sessions_timebox` is unset, which matters more than it looks:
a timebox at or under 24h caps `session.created_at` so no session ever reaches the age at which
the flag is enforced, silently turning the setting just applied back into decoration. Check it
in the same GET if anybody ever sets one — [config.toml:476](supabase/config.toml#L476) argues
it at length.

**Why each matters.** `secure_password_change` is what AGENTS.md's "A fresh session can
change the password without the emailed code" is written on — and on hosted the flag was
*off* until 2026-08-29, so there was no reauthentication code at **any** session age, not
merely inside GoTrue's 24-hour window. `sessions_inactivity_timeout` bounds how long an abandoned cookie
stays renewable; 7 days was chosen because the floor is about an hour (auth-js refreshes a
live tab roughly every 58 minutes at `jwt_expiry = 3600`, and by measurement the only clock
that setting watches is the refresh, so anything lower signs out people who are working).
The reasoning and the measured table live in `config.toml` beside the block.

**Watch the unit — the two places disagree.** `config.toml` takes a Go duration and Go has
no `d`, so seven days is `"168h"`; the Management API takes seconds, so the same value is
`604800`. `"7d"` is a parse error and `7` is seven nanoseconds.

Found 2026-08-12 by a read-only sweep comparing every `[auth]` key `config.toml` declares
against that endpoint. Eighteen keys, three divergences; `otp_length` is now 8 in both —
re-confirmed on hosted 2026-08-29, `mailer_otp_length = 8` — and `max_frequency`'s 1s/60s
split is deliberate and says so in `config.toml`. **One of the two remaining is now closed and
the other cannot be**, and they are the same failure the template sync was built to stop, one
field over:
written in `config.toml`, verified locally, never applied to the project that serves real
families.

**`scripts/auth-templates.mjs` will not grow into a checker for this**, deliberately. It
reads and writes nothing but the ten mailer fields; the moment it can write `site_url` it
inherits every hazard `config push` has. A separate read-only auditor over the whole
`[auth]` block is the right shape and is not built.

### [ ] The `production` environment carries all three credentials and a `master` branch rule

**Action:** one look at Settings → Environments → production, and nothing to run.

`migrate.yml` reads `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as environment
**secrets** and `SUPABASE_PROJECT_ID` as an environment **variable**. All three live there
rather than on the repository, for the reason the comment beside `environment: production`
gives: repository secrets are readable by every workflow, `verify.yml` included, and that one
runs `on: pull_request` from any branch a collaborator can push. Nothing in this repo can see
whether they are set, which is what puts this on this list — the job's preflight names them
and points at that screen, and it is the only thing that will ever tell you.

**Set the environment's deployment branch rule to `master` as well.** With
`workflow_dispatch` gone (2026-08-17) nothing but a push to `master` triggers that workflow,
so the rule is no longer closing an open path — it is what makes the restriction a property
of the *environment* rather than of this file happening to have exactly one trigger. A
workflow added later on a branch, whatever it declares, then gets no credentials at all.

Worth confirming at the same time that runs show up in the Environments tab, since that tab
is the "recorded" half of the whole mechanism — the history of what reached production and
when.

### [ ] Confirm the hosted `claude_probe` role has lapsed

**Action on or after 2026-10-01:** thirty seconds of verification.

The `claude_probe` Postgres role is `VALID UNTIL 2026-10-01`. It holds `LOGIN` and no
grants — enough to read `pg_policies` and `pg_catalog`, not enough to read a single row of
family data. Nothing needs doing when it lapses; verifying it lapsed is the item.

The local half of this is already gone: `supabase/.env.probe` is not present in this checkout,
and `.claude/settings.local.json` holds nothing but a Bash permission allowlist — no
credentials of any kind. *(This said "there is no `.claude/` directory at all", confirmed
2026-08-12. There is one now; re-read 2026-08-29 and it carries six `Bash(…)` allow patterns
and nothing else. The substance is unchanged — what mattered was that no probe credential
lives in the checkout, and none does.)* And the durable replacement is live, so granting an agent
`db push` on production has no remaining justification: migrations reach hosted from CI on
merge and gate the Vercel release, reviewed and recorded, with nobody holding write
credentials. See AGENTS.md, "How migrations reach the hosted project".

### [ ] Stripe: the CATALOGUE is dashboard data, and `npm run stripe:check` is what asks about it

**Action:** run `npm run stripe:check` against whichever account is being set up, and
`npm run stripe:fix` if the only findings are names. Added 2026-09-02.

`lib/stripe/config.ts` said from the day it was written that the amounts *"live in Stripe"*
and that nothing in this repo could check them. `scripts/stripe-catalogue.mjs` is that check:
it retrieves each of the six configured prices and compares the amount against
`TIER_PRICE[tier].monthlyCents`, the interval against the slot it is in, the currency, whether
the price is still active, and the PRODUCT NAME a family reads on the hosted page.

**IT WAS THE NAME THAT PROMPTED IT.** A real Standard checkout rendered its line as
`STRIPE_PRICE_STANDARD_RECURRING` — the Product had been named after the environment variable
that holds its Price id. That is the one class of misconfiguration nothing in the product
could see: `priceShapeError` refuses a wrong SHAPE because it charges the wrong money, and a
wrong NAME charges the right money while telling the family they are buying a configuration
key.

`--fix` renames and nothing else, deliberately — a wrong amount could be Stripe that is right,
and rewriting a live price from a script would change what every subscriber is billed at their
next renewal. Not a `verify.yml` step: it needs a live secret key and asks a third party.

**TWO THINGS THE SAME REPORT ASKED FOR THAT STRIPE DOES NOT ALLOW**, recorded here so they are
not re-attempted:

* **"Pay" as the button on a monthly checkout.** `submit_type` is a closed enum and Stripe
  refuses `'pay'` in `subscription` mode outright — *"You can not pass `submit_type: 'pay'` in
  `subscription` mode"*, measured 2026-08-29, and it 400'd every monthly checkout for a day. A
  subscription session's button says **Subscribe** and there is no free-text label at any
  price. `app/actions/billing.ts` carries the whole finding at its `submit_type`.
* **Removing the "N days free" badge.** Every family bills on the 1st, which Stripe models as
  a trial (`trial_end`) — that is not a marketing claim, it is the only way to say "do not
  charge until this date" on a session that also carries a one-time price. Checkout renders
  its own badge for a trial and there is no parameter that suppresses it. What IS in our
  control is the sentence beside the button, and it already says the true thing:
  `custom_text.submit.message` reads *"$X today covers you to the end of {month}. {Plan} then
  renews at $Y a month, on the 1st."*

### [ ] Drop `dues_schedules.bloodline_only`, which is derived and read by nothing

**Action:** one migration, `ALTER TABLE public.dues_schedules DROP COLUMN bloodline_only`.

`20260903000001` replaced it with the three-valued `bloodline_scope` and put it back as a
GENERATED column — `GENERATED ALWAYS AS (bloodline_scope = 'bloodline') STORED` — for exactly
one deploy. That is not a second fact (Postgres derives it, nothing can write it, and it
cannot come to disagree), and it exists so that code deployed BEFORE that migration keeps
reading: `app/actions/dues.ts` named the column in two selects and PostgREST answers 42703 for
a missing one by killing the whole query.

AGENTS.md's deployment argument holds only for an ADDITIVE migration — *"the old code serves
while migrations are applied, which is the safe direction, because a migration this repo ships
is additive and the running code does not use it yet"* — and a DROP COLUMN inverts it.
`20260902000000` took that trade twelve days earlier on the ground that no family was using
the product; **four families with real people in them are, so it was not available.**

**Once this deploy is out, nothing in the tree names it** and the drop is additive in the safe
direction. Check with `git grep bloodline_only -- '*.ts' '*.tsx'` first; the only hits should be
comments and the actions' `delete (columns as …).bloodline_only`, which goes in the same
commit. `dues_schedules_freeze_used_terms` compared it and is ALREADY recomposed onto
`bloodline_scope` by `20260903000001`, which had to be: a generated column is not computed
when a BEFORE-row trigger runs, so `NEW.bloodline_only` was NULL there and the comparison was
TRUE on every UPDATE — the trigger refused EVERY edit to a used schedule, including its label.
Measured, and only by the negative control; asking whether it still refused a bloodline change
answered yes and proved nothing. That migration asserts in both directions that no reference
to the old name survives in the function.

### [ ] Back-fill thumbnails for photographs uploaded before 2026-09-02

**Action:** a script that lists the `photos` bucket, downloads each object whose row has a
NULL `thumb_path`, resizes it, uploads the thumbnail beside it and writes the column.

`20260902000003` added `photos.thumb_path` and the uploading browser now writes one for every
new photograph — so a grid draws a ~40 KB JPEG instead of a 3–5 MB original. **Nothing was
backfilled**, because the bytes are in a storage bucket rather than in the database and
resizing them means downloading and re-uploading every object in the product. Until this runs,
an old album is exactly as fast as it was before and no slower; the column is nullable
permanently and every reader falls back to `file_path`, so there is no broken state to fix —
only an optimisation not yet applied.

Two things it has to get right, both of which the reaper's own header argues at length: the
thumbnail's path is `photoThumbPath(file_path)` and nothing else (a second definition of that
naming scheme is how live thumbnails get reaped), and a row whose object cannot be read is
SKIPPED rather than written with a guess.

### [ ] Stripe: watch a real payment land, once per mode

**Action:** run the eleven checks below against the account being brought up. Everything else
in this item was configuration or a decision and **all of it is settled** (2026-09-03) — the
keys, the two endpoints, the six Prices, Managed Payments, the tax position and the product
flags. Deleted rather than annotated, per this file's header.

What a settled setting leaves behind is the one thing no gate in this repo can answer: whether
it works. `npm run stripe:check` asks Stripe about the CATALOGUE (its own item above); nothing
asks whether a payment reaches the database, because that needs a card.

**"The endpoint returned 200" is not validation.** These are:

| Check | What wrong looks like |
|---|---|
| Buy a month, then reload `/admin/settings` | **Paid through** moves and the tier is granted. Still Free means the webhook is not arriving — check the signing secret, not the code |
| Replay the same event from the Stripe dashboard | Nothing changes. `platform_payments.stripe_ref` is unique; a second row means the ref is not the charge |
| `SELECT * FROM stripe_webhook_events WHERE processed_at IS NULL` | Empty. A row here with a `last_error` is an event that failed and is being redelivered |
| Buy 12 months, then change it to 3 on Stripe's page | `paid_through` is three months out, not twelve — the quantity is read off the session, and it is the MONTHS line that is read, not the part-month line beside it |
| Sign up on the 20th of a 31-day month | The charge is the rest of the month prorated and rounded UP, and `paid_through` is the last day of that month. Every later invoice is on the 1st |
| Sign up on the 29th on Standard | The remainder alone is under $5, so only the combined "this month and next" option is offered — and the screen says why |
| Upgrade a family with a live prepaid term | Often **nothing to pay**: the unused term is valued at the old rate and spent first. Anything left is a NEGATIVE customer balance transaction at Stripe |
| Move down a tier | The tier does NOT change today, and **Billing** names the date it will |
| Connect a family account and pay a due | A `dues_payments` row with `source='stripe'`, `recorded_by` NULL, and `fund_contributions` rows against it |
| Pay a due by card, then reload `/reporting/pl-summary` | **Processing fees** is non-zero. $0.00 means the Connect endpoint is not subscribed to `charge.succeeded` — `settleChargeFee` is the only writer of `stripe_charge_fees` and nothing errors when the event never arrives |
| Compare a charge against `platform_payments.amount_cents` | Cents, not dollars. A $5.00 charge stored as `5` is the failure |

**ONE HAZARD SURVIVES THE CONFIGURATION BEING DONE, and it is the expensive one.** A live key
on a preview deployment is refused (`liveKeyOnNonProduction` in `lib/stripe/config.ts`). The
OPPOSITE cannot be detected from inside the process: a TEST key on production means every
checkout succeeds, every webhook fires, every tier is granted and no money is ever collected,
with the product working perfectly. The two variables differ by four characters and are set in
the same UI. **Check the key's prefix on production by eye**, and the first check in the table
is what catches it in practice — the tier is granted either way, so it is the Stripe dashboard
that has to show the charge.

Recorded 2026-08-23; narrowed to the validations 2026-09-03.

### [ ] Meta advertising: two credentials, four dashboard settings, one decision

**Action:** set five environment variables and untick one box. Nothing in this repo can
detect any of it — same shape as the two `[auth]` values above, and the same reason it is
on this list rather than in a commit.

The integration itself is built and tested (`lib/meta/`, and its README is the reference).
What is missing is everything that lives in somebody's Meta account.

**1. Environment variables**, on Vercel. Production and Preview differ deliberately:

| Variable | Production | Preview / QA | Notes |
|---|---|---|---|
| `META_PIXEL_ID` | set | set | The dataset id. Public — it is in the page source of every site that runs a Pixel |
| `META_CONVERSIONS_API_ACCESS_TOKEN` | set | set | **Server only.** Never `NEXT_PUBLIC_`, never logged, never in a URL |
| `META_TEST_EVENT_CODE` | **leave unset** | set | Preview is `off` until this exists — that is the deliberate QA opt-in |
| `META_CONSENT_DEFAULT` | a decision — see 3 | same | `denied` unless set |
| `META_GRAPH_API_VERSION` | leave unset | leave unset | Pinned to `v26.0` in code; this is the override for testing a bump |

With no `META_PIXEL_ID` the whole integration is inert — the Pixel is not rendered, no
server event is sent, and the consent banner does not appear. That is what makes it safe to
merge before any of this is done.

**2. Events Manager**, and the third item is the one that matters for this product:

1. Create or identify the **Dataset / Pixel**; copy its id.
2. Settings → Conversions API → **Generate access token**.
3. **TURN OFF AUTOMATIC ADVANCED MATCHING.** Settings → *Automatic advanced matching*. Left
   on, the Pixel reads form fields and sends what it finds — on a product whose forms hold
   relatives' names, birthdays and relationships. The base code already disables
   `autoConfig` (which stops button-text and page-metadata collection, and is enforced in
   `lib/meta/pixel.ts` rather than left to a toggle), but AAM is a **separate**
   dataset-level setting that no code can reach. Both are needed and only one is in the
   repo.
4. Brand Safety → **Domains** → verify `genorra.com`. Aggregated Event Measurement cannot be
   configured without it.
5. **Aggregated Event Measurement priorities**, once there is volume: Purchase, Subscribe,
   CreateFamily, CompleteRegistration, ViewContent, in that order. This is the ranking iOS
   attribution collapses to, so the most valuable event has to be first.

**3. The consent default is a business and legal decision, not a code one.**
`META_CONSENT_DEFAULT` is `denied` — opt-in — unless set, which is the only defensible
default for a decision that turns on jurisdiction. `granted` produces the opt-out model
common for US-only advertisers, and the banner then reads as a notice with a decline
control. Both are implemented; which is lawful where is a question for a person.

**Validation, and it is not "the API returned 200".** With `META_TEST_EVENT_CODE` set on a
preview deployment, open Events Manager → Test Events, then load the preview with
`?fbclid=TEST123&utm_source=facebook&utm_campaign=qa` and walk Home → Pricing → Register
(create a family) → `/my-families` → create a second family. **Accept on the banner first;
nothing fires before that, which is itself the first thing to confirm.**

| Check | What wrong looks like |
|---|---|
| Sequence is `PageView`, `ViewContent`(Home), `PageView`, `ViewContent`(Pricing), `PageView`, `CompleteRegistration`, `CreateFamily` | A missing step means a page lost its `<MetaViewContent>` |
| PageView appears **once** per page | Twice means the base snippet's own call came back, or a second effect was added |
| `CompleteRegistration` is **one** event marked Browser **and** Server | Two rows means the event ids diverged — the whole deduplication contract |
| `event_source_url` is the canonical origin with **no query string** | A query string here is a leak: invitation tokens and search terms live there |
| `action_source` is `website` | — |
| Matching parameters include `em`, `fn`, `ln`, `external_id`, `client_ip_address`, `client_user_agent`, `fbp`, `fbc` | A missing `fbc` after an `fbclid` landing means attribution is not surviving registration |
| `content_name` reads `Family Workspace` / `GENORRA Account` | **A family's name here is the failure the whole allow-list exists to prevent** |
| Diagnostics is empty of: duplicate events, missing `event_id`, missing currency/value, invalid `fbp`/`fbc` | — |

Then **Event Match Quality** on the dataset. It is a number to improve only through the
nine permitted account-holder fields; it must never be improved by widening
`MetaAccountHolder`. That interface exists to make "send more" a reviewed decision, and the
pressure on it is one-directional.

**Do not set any of this with `supabase config push`** — unrelated to the auth block above,
but worth saying in the same breath: none of these values lives in `config.toml` at all.
They are Vercel environment variables and Meta dashboard settings.

Recorded 2026-08-23.

### [ ] SMS: an account, a registered campaign, and four environment variables

**Action:** open a Twilio account, register a brand and campaign, set four Vercel variables.
Nothing in this repo can detect any of it, and **the registration is not a credential — it is an
onboarding process with a real-world identity behind it.**

`/community/safety-check-ins` is `tier: 'premium'` because the ask is meant to arrive as a text
message. The consent half is built (`20260823000002`, `lib/sms/consent.ts`,
`app/actions/sms-consent.ts`, My Profile → **Notifications**); the sending half is not, and this
is what it is waiting on rather than on code.

**1. A2P 10DLC REGISTRATION IS THE BINDING CONSTRAINT, and it is worth understanding before
anybody estimates the rest.** US carriers will not deliver application-to-person SMS to a mobile
number at all until a brand and a campaign are registered with The Campaign Registry. It is not a
rate limit or a deliverability tax — unregistered traffic is blocked. Turnaround is days, not
minutes, and the campaign has to declare what the messages are for and carry sample copy.

Declare the use case honestly as transactional/notification with the two message shapes this
product actually sends: a verification code, and a safety check-in ask. **A campaign registered
as marketing would be the wrong one**, and re-registering is not free.

**2. TCPA is the reason the consent half was built first**, and the registration does not replace
it. Statutory damages are $500–$1,500 **per message**; the product's answer is an explicit
per-person opt-in defaulting to off, a number verified by code before anything is sent, and STOP
as a state the product cannot undo. All three are in place. What is still owed to that model is
the inbound webhook that HONOURS a STOP — until it exists, a relative who replies STOP is
recorded nowhere, which is the one gap in the consent story that matters.

**3. Environment variables**, on Vercel. `smsConfigured()` in `lib/sms/send.ts` reads all four
and the whole feature is inert until every one is present — which is what makes it safe to have
merged:

| Variable | Notes |
|---|---|
| `SMS_PROVIDER` | `twilio`. The seam exists for one other; nothing else is implemented |
| `SMS_ACCOUNT_SID` | Public-ish, but keep it out of `NEXT_PUBLIC_` — nothing client-side needs it |
| `SMS_AUTH_TOKEN` | **Server only.** It is also what verifies the inbound webhook signature |
| `SMS_FROM_NUMBER` | The registered long code or toll-free number, E.164 |

With any of them missing, `sendSms` answers `{ sent: false, error: 'no SMS provider configured' }`
and the panel says *"Text messages are not switched on yet"* (`notify.smsNotOn`) rather than
offering a code that cannot arrive. **Check that sentence is gone from the screen** as the first
sign it worked — and check it in all three languages, since that string is a catalogue key like
every other.

**4. Validation, and "the API returned 201" is not it.** Send yourself a verification code from My
Profile → **Notifications** on a real handset, confirm it, then reply **STOP** to it and check the
consent status moves to *stopped* on that screen and that `grantSmsConsent` then refuses. That last
step is the whole of the legal model and is the one nobody tests.

**The panel was called "Text Messages" until `20260826000000`**, which replaced it with a
grid — a row per notification, a column per channel — over `notification_preferences`. Nothing
in the consent model moved with it: `person_sms`, `sms_consent_events` and
`phone_verifications` are untouched, and `sms_consent_events` is still the legal record. What
changed is only where a member expresses the choice, so every rule in this item survives the
rename. `components/personal-info/Notifications.tsx` is the screen.

**5. THE SMS COLUMN READS "Coming Soon" UNTIL THIS ITEM IS DONE, as of 2026-08-29,** and that
is one more thing to check when it is. It was a live switch beside a note saying texts were not
switched on yet — a control that collects a consent record for a message nobody can deliver,
which is the dead affordance this codebase refuses everywhere else. `cellState` in that
component is what decides it, from `smsAvailable`, so **setting the four variables above brings
the switches back with no code change**; nothing about it is a second flag to remember.

Two things about it that a change here must not undo. A member whose consent is already
`granted` KEEPS a working switch whatever `smsAvailable` says — rule 2 of that screen, *turning
it off is never harder than turning it on*, and hiding the control would make withdrawing
impossible. And the CATALOGUE is untouched: `sms: 'opt-in'` in `lib/notification-prefs.ts` is
still the right default for the day a provider lands, and marking it `'unavailable'` there
would make `setMyNotificationPref` refuse that withdrawal too.

Recorded 2026-08-23.

## The render diff is a RATCHET now, and it found four classes nothing else could

**Action:** run `npm run i18n:onscreen` after any pass over copy, and keep the ceiling at 0.
It is not in `verify.yml` and the reason is below — that is a decision rather than a gap.

Worked down 2026-09-01, from **37 distinct runs across 46 routes to 0**. About half were
genuine false positives that now sit in `EXPECTED_SAME` with a stated reason each; the rest
were real, and every one of them was invisible to `i18n:check` and `i18n:literals` with both
clean and both ceilings at zero.

### Running it

```
npx supabase start
npm run test:rls          # seeds the two-family fixture
npm run dev:local         # NOT `npm run dev` — see below
npm run i18n:onscreen
npm run i18n:onscreen -- --force-rtl
```

**`dev:local` IS NEW AND IT IS NOT A CONVENIENCE.** The documented invocation was three
`VAR=value` prefixes, which is bash — PowerShell reads the first as a command name and says so
— and the keys were written `<local anon>`, which a shell treats as a redirection. The syntax
error was the harmless half: `npm run dev` on its own uses `.env.local`, which points at
HOSTED, so the probe's forged session cookie matches nothing, every protected route renders
the signed-out shell, and the run reports a short tidy meaningless list. `scripts/dev-local.mjs`
discovers the local keys from `supabase status` so that cannot happen.

### The four classes it found, and why the static gates cannot

| | |
|---|---|
| **A formatter missing its locale** | `PremierGatheringHero` called `formatDateRange` with one argument, so the largest text on the Dashboard read "October 1 – 3, 2026" to every reader. There is no string to key — the defect is an argument nobody passed — and `i18n:check`'s PINNED-FORMATTER count reads 0 because every OTHER call site has a second argument. |
| **A registry holding English** | `GATHERING_STATUS_LABEL` and `GATHERING_TASK_STATUS_LABEL`, on six screens. `i18n:literals` rejects a lone capitalised word deliberately — otherwise every id and enum member in the tree is a finding — so a `Record<K, string>` of them is exactly its blind spot. Both are `function(t)` now. |
| **A sentence returned from `lib/`** | `stripeUnavailableReason()` returned English to ten actions. `lib/` is outside the literals sweep on purpose: the catalogues live there and their English IS the source. It returns a KEY now, and was RENAMED to `stripeUnavailableKey` so `typecheck` had to find all ten — changing the return value alone would have left them rendering `act.onlinePaymentsNotSetUp2` on screen, which is worse than the bug. |
| **Text stored in the database** | Every bell entry. See below — it needed a migration. |

Plus the two shapes the header already warned about: a bare `" in "` concatenated onto a
translated label inside an `sr-only` span, and `people === 1 ? 'Member' : 'Members'` on the
Dashboard, which no catalogue can hold because the plural rule is in the JSX.

### A NOTIFICATION IS THE ONE STRING THAT NEEDED A COLUMN

`20260901000004`. Every other string is chosen at RENDER time, when the reader is known. A
notification's text is chosen at EVENT time and read later by somebody else — so even a
perfectly translated writer composes it in the language of whoever triggered it. The row now
carries `title_key`, `body_key` and `params`, and the English stays as the fallback.

**Two things worth carrying forward from it:**

* **A CHECK constraint's function needs its `EXECUTE` grant, exactly as a policy's does.** The
  first draft revoked it and every authenticated write to `notifications` began failing. AGENTS.md
  §2b rule 2 names policies and not CHECKs; it is the same rule. Found — again — by the RLS
  suite's POSITIVE CONTROL, with every attack half green, because a function that errors refuses
  everybody equally.
* **There were TWO renderers of a notification.** Fixing `NotificationBell` left the Dashboard's
  Recent Updates card still reporting all three seeded titles, because `toUpdateItem` read
  `n.title` directly. Half a fix looks exactly like a whole one.

### Why it is a ceiling and NOT a `verify.yml` step

The ceiling, because without one this is a worklist somebody reads and forgets — every other
i18n gate here is a ratchet for that reason. Above 0 it exits 1.

Not in CI, and **not** for the usual "it needs the local stack" reason: that workflow already
runs `supabase start`, `db reset` and `test:rls`. Two harder facts:

* It needs a RUNNING APP — a build plus 92 route renders on every pull request.
* **It is fixture-dependent, which is the disqualifying one.** Half of what it reports is a row
  `tests/rls/seed.mjs` wrote, and `EXPECTED_SAME` excuses those BY CONTENT. Renaming a probe
  family or seeding a second dues schedule turns it red on a pull request that never touched a
  string, and a gate that cries wolf on unrelated changes is one people learn to ignore.

### What it still cannot see, and what that leaves owed

Its own header lists the limits; the two that matter are that **nothing behind a control is in
the markup** — every dialog's field labels, every confirm — and **nothing an empty fixture does
not render**. A clean run means the default state of 46 routes is clean, and no more than that.

**And one class it will never reach:** the seeded English in the DATABASE.
`Administrators`, `General`, the built-in `Donations` fund and its description are written in
English by `20260618000000` and `20260807000003`, so a Spanish family sees English names for
things they never chose. They are excused in `EXPECTED_SAME` because a per-family row cannot be
keyed — the honest fixes are seeding in the family's language at creation, or letting a family
rename them, and both are product decisions nobody has taken.

## WHERE THIS GOES NEXT: fifteen languages and fifteen countries, in priority order

**Action:** none yet. This is the target list the next two localization passes are measured
against, so that "add a language" stops being a decision made per pull request. Recorded
2026-08-31 at the same time as the Connect country picker, because the two lists constrain
each other and neither is useful alone.

**Read this with `npm run i18n:onscreen` beside it.** Three languages are shipped and the
product is not finished being read in the two that are not English — a fourth language added
before that number reaches zero multiplies the backlog rather than the reach.

### THE FIFTEEN LANGUAGES

Ordered by the audience this product actually has: a diaspora family whose relatives are
spread across countries. That is a different ranking from raw speaker counts — Mandarin has
more speakers than Portuguese and fewer extended families organizing a reunion across three
countries in it.

| # | Language | Why it is at this position |
|---|---|---|
| 1 | **Spanish** — shipped | The US's second language and Mexico's first. Already the strongest case in the product |
| 2 | **French** — shipped | Canada, Haiti, West Africa. Three diasporas, one language, and Canada is in the Connect set |
| 3 | **Portuguese (Brazil)** | Large families, strong reunion culture, and Brazil is in Stripe's cross-border set |
| 4 | **Haitian Creole** | The single strongest fit for this product's actual early users, and almost never offered. Not French: a Kreyòl speaker handed French is being told their language does not count |
| 5 | **Tagalog / Filipino** | Enormous US and Gulf diaspora, and family associations with dues are already a norm |
| 6 | **Vietnamese** | Same shape, same reason |
| 7 | **Arabic** | First **right-to-left** language, so it is where `dir="rtl"` stops being hypothetical — see the cost note below |
| 8 | **Korean** | Strong US diaspora and organized family associations |
| 9 | **Simplified Chinese** | Largest single addition by speakers; clan associations are the closest existing analogue to this product anywhere |
| 10 | **Traditional Chinese** | Taiwan and Hong Kong. A separate catalogue, not a conversion — the two are not interchangeable copy |
| 11 | **Hindi** | India is in the Connect set; English is widely read in the same audience, which is why it is not higher |
| 12 | **Yoruba** | Nigeria. Extended-family associations with dues are the norm and the language is under-served by software |
| 13 | **Igbo** | Same, and the two together cover most of the Nigerian diaspora's preference |
| 14 | **Swahili** | East Africa, and one language across several countries |
| 15 | **German** | Not diaspora — it is the strongest European market for a paid family product |

**THE FIRST RTL LANGUAGE IS NOT A CATALOGUE, IT IS A LAYOUT PASS — AND THE PASS IS DONE, as
of 2026-09-01.** Every item this paragraph listed is built: `dir` on `<html>` beside `lang`
(plus a boot script, because a flip after hydration is not the invisible attribute change
`lang` is), 430 physical utilities across 119 files converted to logical properties,
`MainRail`'s marker and `header-panel.ts`'s anchoring both mirroring, and the calendar's
Sunday-first week answered — **which turned up a live defect in a language already shipped:
France starts on Monday and the grid was Sunday-first for everybody.**

`npm run i18n:rtl` is a `verify.yml` step at a ceiling of zero and
`npm run i18n:onscreen -- --force-rtl` covers the runtime-built classes it cannot see. AGENTS.md
carries the rules, including the three things `dir` does NOT do.

**SO ADDING ARABIC IS NOW FOUR CATALOGUE FILES AND ONE `LOCALES` ROW**, and the row is
deliberately absent until those files exist: a locale in that array is a locale the switcher
OFFERS, and offering Arabic over 5,682 English keys would tell a reader their language counts
and then not speak it — the same failure the Haitian Creole entry above is about. What is still
owed with the catalogue, and is NOT layout: `firstWeekdayFor` already answers Saturday for
`ar`, and nothing has yet been READ by somebody who reads Arabic.

### THE FIFTEEN COUNTRIES

Ordered by whether a family there can actually be SERVED — a country is only worth adding
when its families can collect dues, and that is Stripe's list rather than ours. Every one
below is in Stripe's cross-border set, so each is a one-flag change in
`lib/stripe/connect-countries.ts` plus the currency work above.

| # | Country | Currency | Language it needs |
|---|---|---|---|
| 1 | **United States** — live | USD | English, Spanish |
| 2 | **Canada** — live | CAD | English, French |
| 3 | **Mexico** — live | MXN | Spanish |
| 4 | **United Kingdom** | GBP | English |
| 5 | **Nigeria** | NGN | English, Yoruba, Igbo |
| 6 | **Brazil** | BRL | Portuguese |
| 7 | **Philippines** | PHP | English, Tagalog |
| 8 | **India** | INR | English, Hindi |
| 9 | **Australia** | AUD | English |
| 10 | **Germany** | EUR | German |
| 11 | **France** | EUR | French |
| 12 | **Spain** | EUR | Spanish |
| 13 | **South Africa** | ZAR | English |
| 14 | **Kenya** | KES | English, Swahili |
| 15 | **United Arab Emirates** | AED | Arabic, English |

**FOUR THINGS THE TABLE HIDES, AND EACH IS A REAL BLOCKER RATHER THAN A TASK:**

* **NIGERIA AND KENYA ARE NOT SIMPLY "in the set".** Stripe's availability there is narrower
  than in the EU and changes; confirm per country against Stripe rather than against this
  table, which will go stale. They are high on the list because the AUDIENCE is strong, not
  because the plumbing is easy.
* **`lib/regions.ts` ADMITS THREE COUNTRIES.** A member's address picker is US, Canada and
  Mexico, so adding a country to Connect without adding it there gives a family a merchant
  account and nowhere to put an address. The two lists have to move together.
* **PHONE NUMBERS ASSUME +1.** `lib/phone-format.ts`'s `DEFAULT_COUNTRY_CODE` and `toE164`
  are written around North America, and `toE164` REFUSES what it cannot parse — which is the
  right behaviour and means a Nigerian mobile is silently unreachable for SMS rather than
  wrongly reachable.
* **A SECOND CURRENCY IS BUILT AS OF 2026-09-01, AND THE COST MOVED RATHER THAN VANISHED.**
  `families.currency` is derived from `families.connect_country` and threaded through every
  figure, so a family in Lagos would no longer set a due in dollars. What enabling a country
  now costs is **a migration as well as a flag**: `families_currency_check` and
  `families_connect_country_check` list the three enabled currencies by hand, deliberately, so
  a value nothing can format, price or charge a minimum against cannot be written. The CHECK
  and `CONNECT_COUNTRIES` have to move together.

* **AND STRIPE PUBLISHES NO MINIMUM CHARGE FOR NGN OR KES**, which is a blocker on rows 5 and
  14 rather than a detail. `stripeMinimumCents` in `lib/currency-utils.ts` is transcribed from
  docs.stripe.com/currencies and answers `null` for both — there is no safely-high fallback in
  a currency you do not know, and the failure of guessing low is a member choosing a small
  payment and meeting a hosted page that fails at the till. Establish the figure with Stripe
  before enabling either, and note that the minimum is measured in the SETTLEMENT currency
  after conversion, not the presentment one.

Recorded 2026-08-31.

## The billing ladder is built. One thing it deliberately did NOT do

**Action:** none, until somebody wants an end-to-end mail test. This is a note, not a task.

**THE BYTES ARE NO LONGER ONE OF THEM (2026-09-01).** `delete_family_data_above_tier` removes
rows and structurally cannot touch storage, so a purged family kept every image file in a
bucket that is `public: true`. `20260901000006` and `lib/billing/storage-reaper.ts` are the
fix, on the notice-drain path — the first of the two options this entry named, and `pg_net`
from the sweep is still declined for the reason `VERCEL.md` gives about the mail.

Three things about it worth knowing before touching it:

* **The entry said "photos" and it is THREE TABLES ACROSS TWO BUCKETS.** Measured rather than
  assumed: every `public` table with a `file_path` column is `photos`, `bylaws` and
  `documents`, and all three purge at `plus`. `tier_data_tables.storage_bucket` names them and
  the migration asserts that column against the actual `file_path` columns **in both
  directions**, so a table that gains files next year cannot be silently un-reaped.
* **THE DANGEROUS LINE IS A READ, NOT A DELETE.** The reaper removes an object no surviving row
  points at, so a refused survivor read makes every photograph look like an orphan. `const
  { data }` discarding an error (§8) would delete a family's whole gallery. It abandons the
  family on any read failure, pages the survivor query to exhaustion, and refuses to proceed
  past a row with a null `file_path`.
* **`npm run reaper:check` is what proves it**, and the first of its four cases breaks the
  survivor read FOR REAL — by renaming the column out from under it — and asserts that nothing
  at all is removed. Mutation-checked: discarding that error deletes both objects. It runs
  under `vitest.integration.config.mts` rather than `npm test`, because that runner's `lib/**`
  include is a stated boundary.

### THE ONE THAT REMAINS: nothing tests the ladder end to end

What IS tested: `20260901000002` §8 exercises the sweep for real against a throwaway family —
five rungs enqueued, the day-60 drop refused without its warnings and granted with them, the
person surviving, no second drop. `lib/platform-billing.test.ts` pins every boundary of the
derived stage. `tests/rls` covers the three retention actions.

What is NOT: **the mail.** `drainBillingNotices` resolves recipients from the permission grid
and composes nine messages, and no gate renders one. `npm run auth-email:check` is the shape to
copy — a hand-run script against the local stack that drives the queue and reads Mailpit — and
`realtime:check`'s header is the argument for why it stays hand-run.

**AND THE SAME IS NOW TRUE OF THE DUES REMINDER**, which rides the same route: its queue, its
key and its claim are all asserted in `20260901000007`'s verify block, and nothing renders
`duesReminderEmail`. One script would cover both.

## THE SUBSCRIPTION REAPER IS BUILT. WHAT IS LEFT IS PROVING IT SENDS NOTHING TO STRIPE

**Action:** none, until somebody wants an end-to-end Stripe test. This is a note, not a task.

`20260901000008` and `lib/billing/subscription-reaper.ts` closed *"a purge leaving live
subscriptions at Stripe"* on the day it was opened, along with the family-ending paths that had
the same hole. All four now stop both directions of money:

| | |
|---|---|
| staff hard delete | `cancelEveryFamilySubscription(..., { plan: 'now' })`, in Node, BEFORE the rows go — and **a failure refuses the deletion**, because a charge cannot be un-charged where a deletion can be retried. |
| removal | the same call with `{ plan: 'period-end' }`, and the copy now says every member's automatic dues payment is cancelled and cannot be restarted. |
| day 60, and the retention sweep | the purge ENQUEUES, the daily route drains. `pg_cron` has no network, and there is no after-the-fact subtraction available the way there is for the bytes. |
| `startFresh` | cancels first, in the request, so the member's card stops immediately; the enqueue then finds nothing because it takes only `cancelled_at IS NULL` rows. |

**What IS tested:** `20260901000008` §5 exercises the enqueue for real against a throwaway family
— a live arrangement queued, an already-cancelled one left alone, a dry run queuing nothing, the
claim taken once, five attempts spent and `gone` filed apart from `failed`. Mutation-checked twice:
dropping the dry-run guard and dropping the `cancelled_at IS NULL` conjunct each turn a different
assertion red. `tests/rls` is green on a fresh reset.

### THE ONE THAT REMAINS: nothing has ever watched this call Stripe

Exactly the gap the billing ladder's own entry has about mail, and for the same reason.
`reapPurgedSubscriptions` composes a `subscriptions.cancel` with `Stripe-Account` set, and **no
gate has ever issued one** — the RLS harness has no `STRIPE_SECRET_KEY`, which is what the
`STRIPE-INERT` verdict in `cases.mjs` is about, and `npm test` has no network.

`npm run reaper:check` is the shape to copy: `vitest.integration.config.mts`, hand-run against the
local stack, and its most valuable case would be the one that asserts **nothing is claimed when
there is no Stripe key** — because the claim increments `attempts`, so a deployment that cannot
cancel anything would burn all five and mark live subscriptions `failed`. That branch is written
and unproven.

Two things it should assert beyond the happy path, both of which are decisions rather than
plumbing: that a `resource_missing` from Stripe files as `gone` rather than `failed`, and that a
dues cancellation is addressed on the FAMILY's account and never on ours. Getting the second one
wrong would look like a working integration.

**AND A ROW LEFT `failed` HAS NO SURFACE.** Nothing in the staff console shows the queue, so five
spent attempts on a live subscription are visible only in a log line. That is the honest gap, and
it is smaller than the one it replaced: before this, the same charge was invisible AND had no row.

## `http` is not installed, and the one feature that wants it is blocked on DATA

**Action:** get a ZIP-to-county crosswalk, or decide the weather poller waits behind a delivery
channel. Nothing else wants the extension.

`pg_cron` went in with `20260823000006`, which schedules `apply_due_platform_tier_changes()`;
`20260901000002` added `platform-billing-ladder`. Both run ONCE A DAY since `20260901000005` —
00:05 and 00:20 UTC, in that order because the ladder measures state the sweep has just moved —
and both are created in a migration and asserted there, never in the dashboard. `pg_net`
(0.20.3), `http` (1.6) and `postgis` (3.3.7) are all AVAILABLE on this project and **none is
installed**.

**THE LADDER DECLINED `pg_net`, WHICH IS THE PRECEDENT WORTH READING BEFORE INSTALLING EITHER.**
It needed to send email on a schedule and could have done it from SQL. It does not: `pg_cron`
owns the STATE and a Vercel cron drains a queue for the MAIL, because an outbound HTTP call
inside a transaction that also deletes a family tree is not a thing to add casually, and because
a queue in a table is recoverable in a way a fire-and-forget POST is not. `VERCEL.md` argues it.

That is not an argument against the extension in general — it is an argument that "the job needs
the network" is not on its own sufficient, and the alternative is usually a table.

### 1. AUTOMATIC DUES REMINDERS — BUILT 2026-09-01

`20260901000007` and `lib/dues/reminders.ts`. The last unbuilt Premium bullet, and the one
decision FutureFeature §1 said it still needed is now a unique index:
`dues_reminders_one_per_installment` on `(person_id, schedule_id, due_on)`.

**THE "PERIOD" IS THE INSTALLMENT, NOT THE ANNUAL PERIOD**, which is where that entry's wording
would have led somebody wrong: a member paying monthly has twelve installments inside one
period, so keying on the year sends one reminder in January and nothing again for twelve months.
`due_on` is the discriminator, exactly as `cycle_on` is for a dunning notice.

**AND THE ENQUEUE IS IN NODE RATHER THAN `pg_cron`, WHICH IS THE DECISION TO PRESERVE.** The
ladder's sweep asks a question SQL can answer — has this date passed. A reminder needs
`duesPlanMath`: the cadence ladder, the month-end clamp `setUTCMonth` overflows on, arrears
against settled cents, waivers, the age rule, the bloodline, the scope. Writing that in plpgsql
would be a second implementation beside a tested one, and §7c is a list of four things the
first implementation got wrong. So the queue is a table and the arithmetic stays where
`npm test` can reach it.

Three behaviours worth knowing: it re-checks at SEND time whether the installment was settled
after it was queued and `cancelled`s it if so (a reminder is not a dunning notice, and chasing
somebody for money they have already sent is the worst thing it could do); a generated
placeholder address is `unreachable` rather than `failed`, because `placeholderEmail()` builds
those on a real domain and mailing one is a hard bounce against our own reputation; and an
opted-out or inactive plan is never reminded.

### 2. ALERT-DRIVEN CHECK-IN SUGGESTIONS — BLOCKED, AND NOT ON THE SCHEDULER

The scheduler was the stated blocker and it is gone: `pg_cron` is installed, and `http` is one
`CREATE EXTENSION` in a migration away. **What blocks this now is DATA, and it is worth stating
precisely so nobody re-reads the old entry and starts on the wrong half.**

FutureFeature.md §5 item 3 is the whole of it. `people` holds `city`, `state` and `zip_code` —
no latitude, no longitude, no geocoding, and PostGIS is not installed. NWS alerts carry county
FIPS and UGC zones. So there are two ways to match a relative to an alert and neither is
available:

* **County-level** needs a ZIP-to-county crosswalk. That is a data dependency — the HUD USPS
  file or the Census ZCTA relationship file, about 41,000 rows — and bundling one is a real
  decision about a ~1MB government dataset in the repo, its licence, and who re-derives it when
  ZIPs change. It is not hard; it is simply not something to do in passing.
* **State-level** needs no new data except that `state` is not normalised — `pickProfileColumns`
  normalises name case and phone country code only, so `TX`, `Texas` and `texas` are three kinds
  of record and any state match silently misses two of them. **And state-level is too coarse to
  be worth building anyway:** a tornado warning covers three counties out of Texas's 254, so
  asking every Texan relative each time is how the feature gets ignored.

**THE SEQUENCING ARGUMENT IS STILL THE DECISIVE ONE**, and it has not changed: *automation
improves the TRIGGER, not the REACH — and reach is the feature.* The bell needs an open tab,
`IdleTimeout` signs a member out after 60 idle minutes, and `sendEmail` fails soft. Detecting a
hurricane faster than the family's own group text is worth nothing if the message cannot land,
so push or SMS comes first. SMS is in no plan at all.

**`http` (synchronous) probably still beats `pg_net` for the poller when it happens.** `pg_net`
is fire-and-forget — the response lands in a `net` table for a limited window, so a job that
needs the body is two passes and a reaper. A poll that fetches, matches and writes in one
statement wants the synchronous extension, with an explicit timeout so a hanging endpoint cannot
wedge the job.

**Two things to carry into whatever is scheduled next, and the first is the one that will bite.**

* **A CRON JOB IS DATABASE STATE, which is the same invisibility class as realtime publication
  membership.** `db:check` compares migration versions, `db:audit` reads policies, and a fresh
  `db reset` schedules nothing. A job created in the dashboard is drift with nothing in the repo
  able to see it. **It must be created in a migration and asserted there** — all three existing
  jobs are. AGENTS.md's "REALTIME NEEDS THE TABLE IN A PUBLICATION" is the same incident
  arriving through `cron.job`, and that section's warning about an instruction in a migration
  addressed to a person applies word for word.
* **A job has no `auth.uid()`, so it has no caller to authorize.** That is why the alert poller
  must SUGGEST and a person must RAISE (FutureFeature.md §5 argues it): automating the raise
  means inventing a system actor and hanging the family's most sensitive write off it, with
  §2b's rule about never taking an identity as a parameter standing in the way. **The precedent
  is now set by the two jobs that exist** — neither invents an actor, and the reminder resolves
  every recipient from a `people` row it read itself rather than from any argument.

Recorded 2026-08-23, rewritten 2026-09-01.

## GO LIVE: the Send Email hook is ON. What is left is proving it and retiring the fallback

**BUILT 2026-08-27, and TURNED ON — reported 2026-08-29.** The hook is configured on the
hosted project; steps 1–3 below are done and are kept as the record of what was done and in
what order, because turning it back on after a rollback is the same three steps and the order
still matters. `npm run auth-email:check` reports all five auth emails composed by this app,
in all three languages, with the right `type=` on every link and both halves of an address
change — and `20260827…`-era work has not touched that path since.

**Nothing in this repo can confirm the hook is on**, which is why this item does not close on
a report. `config.toml`'s `[auth.hook.send_email]` is `enabled = false` and stays that way —
that is the LOCAL stack, and AGENTS.md explains why it is off there (a local signup would then
need `npm run dev` answering, and without it every signup 500s and leaves no `auth.users`
row). The hosted flag is dashboard state, in the same invisibility class as realtime
publication membership and a `cron.job` row.

### WHAT IS ACTUALLY LEFT

1. **Send yourself a real signup and a real password reset, and look at both on a phone.**
   This is the whole remaining item. `auth-email:check` proves the bytes are composed; it
   opens no mail client and renders nothing. The GO LIVE item above already asks for this.
2. **Then delete `supabase/templates/*.html`** — see the second bullet under "THE TWO THINGS
   TO WATCH", which is now a live cleanup rather than a note. Until they go, the English
   exists twice and `email:push` keeps pushing a copy GoTrue no longer reads.
3. **Confirm `/api/auth/send-email` answers 401 to an unsigned POST** on production if it was
   not checked at step 1. That is the open-relay check and it costs one `curl`.

### THE ORDER IT WAS DONE IN, AND WHY GETTING IT BACKWARDS TAKES AUTH DOWN

GoTrue calls the hook SYNCHRONOUSLY, and a non-2xx rolls the whole operation back — measured:
a failing hook on a signup leaves no `auth.users` row at all. So a hook enabled before the
endpoint answers means **nobody can register, reset a password, or change their address**, and
every attempt fails with `unexpected_failure`.

1. **Merge to `master` and let it deploy.** `/api/auth/send-email` has to be live and
   answering before anything is switched on. Confirm with an unsigned POST — it must answer
   401, which is also the open-relay check. *(Done: `e0f03d5`, on `master`.)*
2. **Set `SUPABASE_AUTH_HOOK_SECRET` in Vercel** (all environments), and `RESEND_API_KEY` must
   already be there — it is, or no mail works today.
3. **Then** enable the hook on the hosted project: `hook_send_email_enabled`,
   `hook_send_email_uri = https://genorra.com/api/auth/send-email`, and
   `hook_send_email_secrets` = the same secret. Dashboard → Authentication → Hooks, or the
   Management API.

To undo, disable the hook. GoTrue falls straight back to `supabase/templates/*.html` — which
is exactly why item 2 above is "delete them once turning the hook off is not the plan" rather
than "delete them now".

### WHY IT IS NOT PUSHED FROM CI, WHICH IS A DECISION RATHER THAN AN OMISSION

`npm run email:push` sends only the ten mailer template fields, deliberately — see
`scripts/auth-templates.mjs`, and AGENTS.md on why it is not `supabase config push`. Adding
the hook fields to it would mean CI enabling an auth hook, and the failure mode is the one
above: a green deploy that has taken authentication down. A human doing step 3 after watching
step 1 land is the whole safeguard.

If it is ever automated, it has to be ordered AFTER the Vercel alias moves — which is
`migrate.yml`'s Deployment Check in reverse, and that is a mechanism nobody has built.

### THE TWO THINGS TO WATCH NOW IT IS ON

* **Auth mail now depends on the Next deployment.** It did not before. A build that fails to
  alias, or an outage, takes auth email with it — and a signup attempted during one leaves no
  account rather than an account with no email, so nothing is stranded. Worth knowing before
  reading a support ticket that says "I cannot sign up". **This is live behaviour now, not a
  future consequence.**
* **`supabase/templates/*.html` are FROZEN and now UNREAD in production.** They are the
  fallback, the English in them is a second copy, and `migrate.yml` still pushes all ten
  mailer fields on every merge — so a wording change made in the HTML reaches hosted and
  changes nothing anybody receives, which is the worst kind of edit to make by mistake.
  Change wording in `lib/email/auth-mail.ts`. Delete the HTML — and the `email:push` step
  with it — once the hook has been on long enough that turning it off is not the plan.
  **That deletion is now the second item on the list above rather than a someday note.**

## NOTHING IN THE PRODUCT SHOWS THAT A DUES REMINDER WAS SENT

**Action:** decide whether the reminder queue gets a surface, and where. Recorded 2026-09-01, in
the same commit that built the queue, because the gap is a consequence of that design rather
than something discovered later.

`dues_reminders` accumulates one row per member per installment with a delivery outcome beside
it — `sent`, `failed`, `unreachable`, `cancelled` — and **no screen reads any of it.** The table
has a SELECT policy and a `permission_table_map` row keyed on `admin/accounting`, so the access
model is already decided; what does not exist is anything that asks the question.

**THAT MAKES ONE OF THE FEATURE'S OWN ARGUMENTS HOLLOW, WHICH IS WHY THIS IS NOT COSMETIC.**
`unreachable` is a separate state from `failed` on the stated ground that filing a generated
placeholder address as a failure *"would sit forever in the column an organizer works through"*.
There is no column. `distribution_recipients` earned that distinction because
`/community/distributions` renders the outcomes; this earned it by analogy and has not paid for
it yet.

Three things it would answer, and the second is the one a treasurer will ask first:

* **Did anything go out?** A queue that silently sends nothing and a queue with nothing to send
  are indistinguishable today, including to whoever is wondering why nobody paid.
* **Whose address does not work?** Every `unreachable` row is a relative the family cannot reach
  by email at all — which is a fact worth acting on well beyond dues, and is already recorded.
* **Was anybody reminded twice?** The unique index makes it impossible, and the screen is how
  somebody satisfies themselves of that without reading a migration.

**Where it belongs is a real choice and not obvious.** A band on `/reporting/dues-projections`
is the cheapest and sits beside the figures it is about; a pane on `/admin/accounting/dues` is
closer to the schedule that generated it. **A new route is the expensive answer** — a
`permission_resources` row, a `resource_visibility` backfill, the Administrators grant, a rail
item, a help chapter and an RLS case, per *"A FEATURE THAT RECORDS SOMETHING OWES A REPORT ON
IT"*. Either of the first two reuses a grant that already exists.

**AND IT IS PREMIUM-ONLY, so whatever surface it gets needs the tier by hand** if it is a pane
on a page whose own tier is lower — the four-sub-key pattern in AGENTS.md, not a new `FEATURES`
row unless it becomes a route.

## `tests/rls` has no member who has replied STOP

**Action:** add a `stop_received` consent event to one ALPHA actor in the fixture, and a case
asserting `grantSmsConsent` refuses them.

`SMS_CONSENT_CASES` in `tests/rls/cases.mjs` names this as a stated gap and it is the one thing in
the consent model with no runtime assertion. The rule it would cover is the sharpest one there:
**a carrier-level opt-out is revoked by the handset, never by a checkbox on a website**, so
`grantSmsConsent` refuses a `stopped` person and `consentStatus()` ignores a `granted` event folded
over a STOP.

**Both halves are tested — separately, and that is the gap.** `lib/sms/consent.test.ts` covers the
FOLD by value and by mutation (removing the guard trips exactly one case). The ACTION's refusal is
covered by nothing, because the fixture has no stopped member and the only way one arrives today
is by texting STOP to an inbound webhook that does not exist.

**Seeding it directly is legitimate and is the fix.** The event is an ordinary row —
`{ event: 'stop_received', source: 'sms_reply' }` — and writing it in `seed.mjs` needs no provider.
Worth doing on a THIRD actor rather than on `alphaMember` or `alphaOther`: both are already
positive controls for the grant and withdraw cases, and a stopped actor cannot be a control for
either (`deletableChild`'s rule).

While there: the same fixture addition makes `smsBlockReason`'s `stopped` branch reachable from an
action-shaped case, which is currently only exercised as a pure function.

Recorded 2026-08-23.

## Meta: `Lead` has no surface, the validation table is owed, and nothing reports on it

**Action:** walk the validation table on a preview deployment, decide what a `Lead` is here, and
build the campaign-to-paying-family report.

**The money half is wired.** `lib/stripe/platform-events.ts` calls `trackSubscriptionPayment`
from the verified webhook after Stripe confirms the charge, and `app/actions/billing.ts` calls
`trackCheckoutStarted` when a hosted Checkout Session is created. The four rules that call site
has to keep — the id is the CHARGE and never the subscription, `firstPayment` comes from the
PROVIDER, `amountCents` comes from the transaction rather than from `TIER_PRICE`, and a renewal
is deliberately not a `Purchase` — are argued at length in `lib/meta/billing.ts`, which is where
a future edit meets them.

**`Lead` still waits for a real lead surface.** There is no waitlist, demo request or newsletter
in this product, and using `Lead` to mean "viewed pricing" would make a Lead-optimised campaign
chase readers instead of prospects.

**Validation, now checkable and therefore OWED rather than hypothetical.** It needs
`META_TEST_EVENT_CODE` and a Stripe test key on the same preview deployment:

| | |
|---|---|
| Refresh the success page repeatedly | One `Purchase` in Test Events, not one per refresh |
| Replay the webhook from Stripe's dashboard | Still one — `stripe_webhook_events` refuses the second delivery before Meta is ever reached |
| Let a renewal charge settle | `SubscriptionRenewal` only. **No `Purchase`, no `Subscribe`** |
| Compare `value` against the Stripe charge | Dollars, not cents. A $5.00 charge reported as `500` is the failure |
| `SELECT * FROM marketing_conversion_events WHERE delivery <> 'sent'` | Empty, or a readable reason in `detail` |

**And the reporting half is one join rather than none.** `marketing_attribution` records which
campaign found each account, and the question it exists to answer — *which campaign produced this
paying family?* — is answerable the moment `platform_payments` has rows in it. A `/reporting`
screen for it is the natural follow-up, and the join is `marketing_attribution` → account →
`people.family_code` → `platform_payments`.

Recorded 2026-08-23.

## Four smaller Stripe follow-ups, none of them urgent

**Action:** four short conversations and a few hours of code, in whatever order they come up.

1. **A FAMILY'S BILLING EMAIL. There is deliberately no column for one.**
   `ensureCustomer` in `app/actions/billing.ts` creates the Stripe customer with the family's
   NAME and no email, and Stripe collects one on the hosted page instead. The obvious value —
   whoever happened to press the button — is wrong the moment that administrator leaves the
   family, and it is where Stripe would mail every future receipt and dunning notice. So it
   wants to be a field on Family Settings, chosen once, and it is not built.

2. **DOES GENORRA TAKE A CUT OF FAMILY DUES?** Today: no.
   `app/actions/pay-dues.ts` sets no `application_fee_amount` and there is no column to hold
   one. That is a real decision rather than an omission — direct charges permit it, so adding
   one later is a line of code, whereas taking one now and reversing it means refunding
   families. If it is ever wanted, the fee has to appear on the member's own screen before they
   pay: a family collecting $40 of dues and receiving $38 needs to have been told.

3. **v2 EVENT DESTINATIONS for connected-account capability changes.** Accounts are created
   through the v2 API, whose capability events —
   `v2.core.account[configuration.merchant].capability_status_updated` — travel through EVENT
   DESTINATIONS rather than a v1 webhook endpoint, and that is not wired up. The Connect handler
   listens for the v1 `account.updated` instead, which still fires and carries enough; and
   `refreshProcessorStatus()` pulls the account on demand, which is the path the return-from-
   onboarding page uses and does not depend on any webhook. So this is a robustness item, not a
   gap: worst case a treasurer presses **Check with Stripe**.

4. **CLOSING THE `STRIPE-INERT` VERDICT.** Eleven actions in `scripts/rls-coverage.mjs` have no
   RLS case because they refuse on a missing credential before they query anything, so a case
   would assert the credential check and pass with every family conjunct deleted. Giving
   `tests/rls` a Stripe TEST key would make all eleven reachable and turn each verdict into a
   real case — and would make the suite talk to the network, which is a slower and flakier
   suite. `BACKLOG_CEILING` was raised from 57 to admit them (69 today) and its own comment carries
   the trade.

Recorded 2026-08-23.

## The consent banner has no privacy policy to link to

**Action:** write a privacy page, then link it from the banner. It was "one route, one link"
when this was recorded; **since 2026-08-27 the public site is three sites and it is four
things.** See the cost below — the second one fails `npm test` rather than shipping quietly.

`components/consent/ConsentBanner.tsx` names Meta, says what the measurement is for, and
states the boundary — no names, relationships, birthdays, photographs or messages — because
"we use cookies" tells nobody anything. What it does not do is link anywhere, and that is
not a design choice: **there is no privacy policy page in this product.** `app/(marketing)`
holds About, Features, How It Works, Pricing and Why Us, and nothing else.

That is a gap the Meta integration makes sharper rather than one it created. A product
holding family trees and children's records should have had one before it had a Pixel, and a
consent banner that asks for agreement while pointing at no policy is the version of the gap
somebody notices.

**Two things to get right when it is written.** It goes under `app/(marketing)` and is
therefore indexable, unlike everything behind the login (`app/(protected)/layout.tsx` sets
`robots: { index: false }`). And it needs its own `alternates: { canonical: '/privacy' }`
like every other page there — a canonical in the shared layout would tell Google that six
pages are duplicates of one, which AGENTS.md calls the one metadata mistake worse than
having none.

`lib/marketing-nav.ts` is what puts it in the header, the footer and the sitemap at once, so
adding it there is the whole of the wiring. `npm run sitemap:check` and `npm run help:check`
will both have opinions.

**AND SINCE 2026-08-27 IT IS A THREE-LANGUAGE PAGE, which is most of what this now costs.**
Re-checked 2026-08-29:

1. **`LOCALIZED_ROOTS` in `lib/i18n/route-locale.ts` needs the entry**, or `/es/privacy` and
   `/fr/privacy` 404 while the English one works — invisible in English and invisible in a
   build. It will not ship quietly: `lib/i18n/route-locale.test.ts` reads `app/(marketing)`
   off disk and asserts every directory in it is on that list, so **the page fails `npm test`
   until it is added**, and the failure names the route. That gate is the reason this is a
   line item rather than a hazard.
2. **The copy is catalogue keys in `lib/marketing/strings/{en,es,fr}.ts`**, not prose in the
   component. `npm run i18n:literals` has a ceiling of ZERO and is a `verify.yml` step, so a
   privacy policy typed into JSX is a red build — and a privacy policy is a page of prose,
   which makes it the largest single addition either bundle has taken.
3. **A legal document translated by this pass is a legal document nobody has reviewed in
   Spanish or French.** That is not the testimonials rule (a translation is an edit of words
   somebody actually said) but it rhymes with it, and it is a decision for a person: publish
   three reviewed versions, or publish English and say so on the localized routes. Deciding
   it is part of writing the page.
4. Then the `alternates` block, exactly as every other page there has it.

Recorded 2026-08-23; the i18n cost added 2026-08-29.

## 1. PARKED 2026-08-07: "Were you already added to the family?"

**Action:** decide how a registrant proves they are the pre-entered person, then either
rebuild it around that proof or delete the code. It is off, not gone.

Turned off with `LINK_EXISTING_PERSON_ENABLED = false`
([lib/feature-flags.ts](lib/feature-flags.ts)). The dashboard banner
([LinkPersonBanner](components/dashboard/LinkPersonBanner.tsx)) and both actions
(`getLinkPersonBannerData`, `linkPersonToCurrentUser`) remain in the tree.

**It is switched off at the ENDPOINTS, not merely hidden**, and that distinction is the
whole reason this is more than a CSS change. Both actions are `'use server'` exports, so
each has a URL and stays callable by anyone signed in however the dashboard renders
(AGENTS.md §5). Hiding the banner alone would have left:

* `getLinkPersonBannerData` returning the first name, last name and birth date of every
  unlinked person in the caller's family — a roster, one POST away;
* `linkPersonToCurrentUser` still able to move one of those rows onto the caller's
  account.

Verified as the *rightful* caller in their *own* family — an ALPHA newcomer claiming an
ALPHA record — not merely as a cross-family attacker: banner `[]`, link refused.

### Why it was worth parking rather than leaving on

What the feature asks the user is "which of these people is you?", and the answer is
self-asserted. What it hands over on that answer is an existing `people` row, which may
already carry dues history, payments, relationships and photo tags — and, since Phase 3,
a `membership_status` that the action has to carry across by hand precisely so claiming
a record is not a way to launder approval.

It is the same shape as the claim-by-email block Phase 3 deleted from `register.ts`, one
step further along: there the match was automatic, here it is a menu. That deletion is
documented in `register.ts` and its reasoning applies unchanged.

### What has to be decided before it comes back

1. **What counts as proof.** An administrator approving the link is the obvious answer
   and fits the machinery that now exists — Member Approvals already reviews strangers;
   reviewing "this newcomer says they are your Aunt Ada" is the same decision. An
   invitation addressed to the pre-entered person's email is the other, and needs no new
   surface at all now that invitations exist.
2. **Whether the roster should ever reach the browser.** Today it ships names and birth
   dates to anyone who has just registered with a valid family code, before anybody has
   vouched for them. Matching server-side and returning only "we found a likely match,
   ask an administrator to confirm" discloses nothing and probably suffices.
3. **What happens to the stub.** The current implementation deletes it after moving
   `user_id`, which is why the pending status has to be copied first. Any redesign
   inherits that ordering problem.

### Turning it back on

Flip the flag, and in the same commit restore the two suspended assertions in
`tests/rls/cases.mjs` — `getLinkPersonBannerData`'s positive control (it currently
returns `[]` for everyone, so its isolation assertion is vacuous while the flag is off,
and the case says so) and the positive half of
`link-person.linkPersonToCurrentUser (feature off + cross-family)`. The cross-family
half of that case is live either way and needs no change.

## The advisors: what is left, and why each one is a decision rather than a fix

**Action:** enable leaked-password protection in the dashboard (below). Nothing else here is
work; the rest of this entry exists so nobody re-litigates findings that are by design.

Measured 2026-08-22 against hosted (`npx supabase db advisors --linked --type all --level
info`) and against a fresh local `db reset`, and the two were DIFFED — which is the part worth
copying, because eight of that day's findings existed only on hosted and no repo-side check can
see them. `20260822000011` reconciles that drift and says how it was found.

What five migrations closed: `function_search_path_mutable` (5), `multiple_permissive_policies`
(11), `auth_rls_initplan` (10, plus five the lint did not report), `duplicate_index` (4) and
`unindexed_foreign_keys` (69). What remains:

* **`auth_leaked_password_protection`, one WARN, and the only one that needs a person.**
  GoTrue can refuse a password that appears in a HaveIBeenPwned breach. There is no
  `config.toml` key for it — the Management API field is `password_hibp_enabled` and the route
  is Authentication → Sign In / Providers → Password. It is NOT pushed from the repo because
  `supabase config push` would carry `site_url` with it. The reasoning is beside
  `password_requirements` in `config.toml`. Note while you are there that
  `minimum_password_length` is 6, which is the CLI default and not a considered number.

* **`authenticated_security_definer_function_executable`, 27 WARN, and every one is
  deliberate.** This is AGENTS.md §2b as a report: a SECURITY DEFINER function that
  `authenticated` may execute is a public HTTP endpoint, and in this product that is the
  DESIGN — grants are the primary control and the bodies re-derive the caller. Audited
  function by function on 2026-08-22 and all 27 are correctly granted: the `auth_*` and
  `election_*` helpers are named in RLS policies, so the grant is load-bearing (revoke
  `auth_family_code()` and every authenticated query in the app dies with "permission denied
  for function"); the other 13 are called with the USER client — `createClient()`, checked at
  each call site — because they need `auth.uid()` from the request's JWT. There is nothing to
  revoke and nothing to fix. **`anon_security_definer_function_executable` (1) is
  `peek_family_invitation`, granted to `anon` on purpose:** somebody following an invitation
  link has no session yet.

* **`rls_enabled_no_policy`, the two INFO.** `genorra_staff` has RLS enabled and ZERO policies
  because that is the whole mechanism — staffness is resolved on the server through the
  service role and there is no client-side check to spoof (AGENTS.md, "Three words"). Same for
  `family_action_challenges`: the challenge is minted in TypeScript and consumed by
  `consume_family_action_challenge`, and the browser must never read a hash it could compare
  against. Both are the §2c pattern working as intended, and both would be a finding if they
  ever gained a policy. *(That table was `family_removal_challenges` when this was measured;
  `20260825000000` generalised it — a `purpose` column and a second caller, disconnecting
  Stripe — which changes the name and none of the argument.)*

* **`unused_index`, and it got LOUDER on purpose — 15 findings locally became 88.**
  `20260822000014` created 73 foreign-key indexes, and an index on a database with no traffic
  has by definition never been scanned. This is not a regression and must not be "fixed" by
  dropping them: index-usage counters on a product no family is using yet measure nothing, and
  Postgres does not index the referencing side of a foreign key, so without them one parent
  delete seq-scans the child table once per row. **The review this deserves is after there are
  families**, against `pg_stat_user_indexes` on hosted, and it is a review rather than a fix.

## Function grants: `anon` is exercised by one case, and deserves more

`20260806000015` and `20260806000016` closed the anon-callable-function hole and the
reasoning is now AGENTS.md §2b. **The first of its two loose ends is closed**:
`get_my_family_code()` is dropped (`20260831000000`), after asking the database rather than
the repo — no policy, no function body, no view and no app code referenced it, and that
migration's verify block re-asks all three before it drops, so a hosted database that has
drifted into using it fails the deploy instead of losing the function underneath a live
policy. `auth_family_code()` is the one resolver now.

**What survives is the test gap.** `tests/rls` exercises `anon` through exactly ONE case.
That is one more than before and fewer than the role deserves — it is the role the browser
bundle's key speaks as, and §2b's whole argument is that a function in `public` is an
unauthenticated HTTP endpoint. The three worth adding first, because each is granted to
`anon` deliberately and so cannot be covered by asserting a blanket refusal:
`peek_family_invitation`, `validate_family_code` and `join_family_by_code` — the three
doors a stranger can knock on, and the three that must answer the same message for a
family that does not exist as for one that was removed.

## `setTemplatePermission` takes a scope from the client and validates it against nothing

**Action:** validate the `(resourceKey, action, scope)` triple against
`permission_resources.actions` and the no-owner rule, server-side. It is every key's problem,
which is why it is here rather than in the commit that found it.

`setTemplatePermission` (`app/actions/admin/permissions.ts`) upserts whatever `scope` the client
sent. Members & Access decides which switches to DRAW through `scopesFor()` in
`components/admin/resource-groups.ts` — that is where `NO_OWNER_KEYS` lives, and where
`transactions/*` has its `'own'` dropped — but nothing on the server reads either. So a caller
holding `admin/users/templates:edit` can POST a scope the grid refuses to offer, on any key.

**What it costs is a screen nobody can diagnose**, and `/admin/boardpositions` is the worked
example. Store `view = 'own'` for that key and every member on the template passes
`requireView` (which is `can()`), while every read behind the page is `requireScope`
(`canAny`) and answers `[]` — a permanently empty screen whose switch the grid no longer
renders. That page now guards itself with an extra `canAny` line for exactly this reason;
seven other keys on `NO_OWNER_KEYS` do not, and neither does the `transactions/*` prefix.

**The fix is a small refactor rather than a line**, which is the other reason it is here:
`scopesFor` and `NO_OWNER_KEYS` live in a `components/` module that imports a TYPE from the
action that would have to import them back, so the rule wants moving into `lib/` first — the
shape `lib/board-positions.ts` took on 2026-08-19 for the same reason. Then one check in the
action, and one `tests/rls` case per refused scope.

Found 2026-08-19 by review, while flipping `/admin/boardpositions` live.

## `tests/rls` has no actor holding scope `'own'`, so no `own_expr` in the schema is tested

**Action:** add a fifth ALPHA actor on a THIRD permission template — one whose grid holds `view` at
scope `'own'` on a resource with a real `own_expr` — and give the existing cases a variant that
uses it. `gatherings` (`own_expr = created_by`), `gathering_tasks` and
`gathering_task_submissions` (`assignee_id` / `submitted_by`, which are also their `self_expr`),
`announcements`, `photos` and `chat_messages` are all waiting for it.

Found on 2026-08-19 while writing the Gatherings cases, and measured rather than assumed. The
fixture gives each family exactly two grids — Administrators, and General with
`gatherings:view = 'any'` — so **every read in the whole suite is satisfied by the `= 'any'`
disjunct** and the `'own'` and `self` branches of every composed policy decide nothing. The proof is
a mutation: neutering three membership gates at once leaked through `auth_permission()` resolving
`'any'` from the applicant's own template, never through `self_expr`.

This is not specific to Gatherings, and it is worth stating plainly what the green suite does
and does not mean: **625 assertions are evidence about CROSS-FAMILY ISOLATION**, which is what
the suite was built for and what `20260618000001`'s composed policies most needed checking.
They are almost no evidence about SCOPE RESOLUTION. Those are different questions, and the
second one has no runner — `lib/auth/permissions.ts`'s `resolveScope` is pure enough to test
under vitest, which may be the cheaper half of this.

**"ALMOST" SINCE 2026-08-20, and the exception arrived as a side effect rather than as work on
this entry.** `20260820000007` gave the General template `review/photos:delete` at scope
`'own'`, so `alphaMember` and `alphaOther` genuinely hold an `'own'` grant now — and
`photos.deletePhoto (a photo they did not upload)` is the first case in the file whose refusal
comes from an `own_expr` (`uploader_id = auth_person_id()`) rather than from a missing grant.
Mutation-checked by neutering that conjunct in the composed policy, which turns it red.

That is one resource, on one action, and a DELETE. What was still missing — and what the fifth
actor was really for — was an `'own'` grant on a resource with a **read** to narrow, which is
where a wrong `own_expr` would quietly hand over rows instead of quietly refusing them.

**THE READ HALF ARRIVED 2026-08-23, and it needed no fifth actor.**
`community/safety-check-ins` gives the General template `view: 'own'`, so `alphaMember` is now an
own-scoped READER on an existing template — and `safety-check-ins.getCheckIns (an ordinary member,
scope own)` is the suite's first case whose answer is decided by the `'own'` disjunct and a
`self_expr` rather than by `= 'any'`. It asserts both directions at once: the member reaches the
screen, AND `rosterVisible` is false for them while true for `alphaAdmin` on the same data.

**It also caught a real bug on its first run, which is the argument for the rest of this entry.**
`20260823000002` §10 backfilled the General templates that EXISTED and did not teach
`seed_family_permission_templates()`, so every family created afterwards got `view: 'none'` and
`requireView` answered 404 — the feature's own members locked out of answering. Found by querying
a freshly reset database, not by any gate, because that migration's assertion was written as
`IF EXISTS (a General template) AND NOT EXISTS (…)` and on a fresh chain there is no template yet
for the guard to find. `20260823000003` fixes both halves and asserts the FUNCTION SOURCE, which
cannot skip. Mutation-checked by reverting the seed function in place: the new case goes red with
`unexpected: null`.

**What is left is narrower than it was**, and worth restating so nobody re-does the done part:

* an own-scoped read where the `own_expr` names a **column on the row** rather than reaching
  through a parent. `community/safety-check-ins`' is `raised_by = auth_person_id()`, which is that
  shape — so this may be closed already and wants a mutation check rather than new fixture work.
* an own-scoped **write** narrowed by an `own_expr` on a resource where the row is not the
  caller's own by construction. `gatherings` (`created_by`), `announcements` and `chat_messages`
  are still waiting.
* and `resolveScope` in `lib/auth/permissions.ts` is pure enough to test under vitest, which
  remains the cheaper half of the original entry and is untouched.

Recorded 2026-08-19; narrowed 2026-08-20 and again 2026-08-23.

## Authorization

**Nothing open.** The two findings that came out of building `tests/rls` (see AGENTS.md §7)
are both closed.

The heading stays because the next finding of this shape belongs under it.

