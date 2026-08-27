# Application email

Mail the **app** sends, over Resend's HTTP API. Distinct from `supabase/templates/`,
which is mail **GoTrue** sends over SMTP. One Resend account, two protocols, because
GoTrue only speaks SMTP and a serverless function only comfortably speaks HTTPS.

| | GoTrue (`supabase/templates/`) | App (`lib/email/`) |
|---|---|---|
| Sends | sign-up, recovery, email change, reauthentication, GoTrue invite | membership approved, family invitation, family-removal code, Stripe-disconnect code, email distributions, safety check-in |
| Language | English only, today — Phase 6 moves these behind a Send Email Hook so they can be translated | translated; see below |
| Composed from | static HTML pasted into the Supabase dashboard | `layout.ts` + `templates.ts` |
| Knows about families | no | yes — which is the whole reason these are here |
| Transport | SMTP → `smtp.resend.com` | HTTPS → `api.resend.com` |

## Environment

Three variables, none of which has a safe fallback in production.

| Variable | Required | What breaks without it |
|---|---|---|
| `RESEND_API_KEY` | yes | Nothing is sent. Logged as a warning, never thrown — an approval still succeeds. |
| `NEXT_PUBLIC_SITE_URL` | no | An override. Unset, `emailOrigin()` resolves through `lib/site.ts`: the custom domain on a production deployment, the stable `.vercel.app` host on a preview, `localhost:3000` in dev. Set it only to point somewhere else — `.env.local` uses it so a dev server's emails link to localhost. |
| `EMAIL_FROM` | no | Defaults to `GENORRA <support@genorra.com>`. Must be on a Resend-verified domain or every send 403s. |

`RESEND_API_KEY` is the **same** `re_…` key used as the SMTP password in the Supabase
dashboard. One key, both paths — revoking it stops all mail, which is the correct blast
radius for a compromised credential.

`PRODUCTION_ORIGIN` in [`lib/site.ts`](../site.ts) must stay in step with `auth.site_url`
in `supabase/config.toml` **and** with the Site URL in the Supabase dashboard, so
application email and GoTrue email agree about where the product lives. They are three
separate settings and nothing reconciles them — the dashboard one in particular is read
by GoTrue alone and by nothing in this repo.

```bash
# .env.local — localhost so a dev server's invitation links are clickable.
# The logo still will not render: a hosted mail client fetches images through its own
# proxy, where `localhost` is that proxy's machine. Expected, not a bug.
RESEND_API_KEY=re_xxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Three rules

**1. Never export a sender from a `'use server'` file.** Everything exported from one is
a public HTTP endpoint, so a `sendEmail` export would be an **open relay**: any signed-in
user could POST an arbitrary recipient, subject and body and have it delivered over
GENORRA's authenticated domain, with our SPF and DKIM on it. That is not spam, it is
phishing with our reputation attached. These are plain modules and have no URL — the same
boundary `lib/notifications.ts` and `lib/invitations.ts` draw, for the same reason.

**2. The origin comes from configuration, never from a request header.** `Host` and
`X-Forwarded-Host` are attacker-controlled, and what they would control here is the
hostname inside a link an email tells somebody to trust. Host-header poisoning turning a
reset or invitation link into an attacker's domain is a well-worn bug and this is exactly
its shape. `emailOrigin()` reads `NEXT_PUBLIC_SITE_URL`.

**3. Sending fails soft, and the caller must say so.** `sendEmail()` never throws. Every
call site sits *after* a decision has been committed — a membership approved, an
invitation minted — and an unreachable mail provider must not roll that back or surface
as a failure to the administrator who just clicked Approve.

The cost is that a dropped email is invisible to the person expecting it, so the UI is
required to close that gap rather than assume delivery. `inviteMember` is the worked
example: on success the token is withheld from the response entirely, and on failure it
comes back and the dialog shows the copy-a-link fallback with an explicit "we could not
email it". A success screen over an email nobody received is the failure mode this
design exists to prevent.

## One recipient per call

`sendEmail` takes a single `to`. Resend accepts an array, and a shared array is how one
family's members end up reading another recipient's address in the To line. Fan out with
one call each.

**Email distributions is the reason that rule now has a cost worth knowing about.**
`/community/distributions` mails everyone in a family, so one distribution to a hundred and
forty relatives is a hundred and forty calls at a provider rate limit — which does not fit
one request, and there is no cron, worker or queue anywhere in this product. So it does not
try: `sendDistribution` writes a `distribution_recipients` row per addressed relative and
mails nobody, and `sendDistributionBatch` claims a bounded slice, sends it, and records each
outcome. **The recipient rows are the queue.** A send survives a closed laptop, and the
constants that size a batch (`BATCH_SIZE`, `SEND_SPACING_MS`) are about two limits we do not
control — the provider's per-second cap and the platform's wall-clock ceiling. Raise either
and do the multiplication first; the header on those constants says what goes wrong.

## Which language a message is in is a rule, not a per-template choice

Every template takes an optional `locale` and looks its prose up through `emailT` in
[`strings/index.ts`](strings/index.ts). What decides the value is one question, and the
answer divides the six cleanly:

> **Whose thing is this message?**

| Substance | Language | Templates |
|---|---|---|
| **ours** — a decision, a code, an ask | the **reader's** | membership approved, family-removal code, Stripe-disconnect code, safety check-in |
| **one member's own words** | that **member's** | email distributions |
| ours, but the reader has no account yet | the **inviter's** | family invitation |

The third row is not a third rule. An invitee has no `people.locale` and has made no request,
so there is no `Accept-Language` either — the inviter is the only evidence there is, and it is
decent evidence: somebody writing to a relative in Spanish is usually writing to a
Spanish-speaking relative.

**Never resolve a recipient's language with `resolveLocale`.** That function answers *what
language is the CALLER reading in* and falls through to the `Accept-Language` header, which for
a piece of mail is the administrator's browser. Using it would mail a Spanish-speaking family
in whatever language the treasurer's laptop asks for — silently, and visible only to them.
`storedLocale` (`lib/i18n/locales.ts`) and `localesOfPeople` (`lib/auth/locale.ts`) are the
recipient-facing pair: the stored column, else English, and no second source. The two code
emails are the one place `resolveLocale` is right, because those actions take no arguments and
resolve the address from the session — the reader **is** the caller.

**The locale must never be a parameter a client chooses.** Same argument as `to` and
`reply_to` below: it comes off a row the action already read.

**The safety check-in is deliberately bilingual.** The ask, the two answers and the footnote
are in the reader's language; the raiser's `title` and `detail` pass through in whatever
language they were written in. We do not paraphrase what somebody said about an emergency, and
we do not leave the ask in a language the reader does not use.

### The bundle is `server-only`, and that is load-bearing

`lib/i18n/catalogues.ts` is a static import a client component can reach, which is right for
the shell and wrong for this: it would ship the prose of six emails to every reader.
`strings/index.ts` carries `import 'server-only'`, so an import from a `'use client'` file is a
**build failure**. `npm run i18n:check` reports the same thing as CLIENT-BUNDLE and names the
file, because a build error on a transitive import points at the module rather than at whoever
imported it.

Two consequences worth knowing. `server-only` is **not an installed package** — Next aliases
the specifier in its own bundler — so anything running under bare Node needs a stub:
`tests/rls/stubs/server-only.mjs` and the hook inside `scripts/i18n-coverage.mjs` both exist
for that, and both say what stubbing it costs. And a green RLS run is **not** evidence about
this boundary; the build and `i18n:check` are.

### Adding or editing a string

One catalogue per language under [`strings/`](strings), one key per sentence, and
`npm run i18n:check` gates the lot — a key nobody reads, a translation of English that has
since changed (STALE), an invented `{placeholder}`, a key defined by two bundles. After
re-checking wording, `npm run i18n:accept <locale>` records the new source hashes.

Two conventions the checker cannot enforce:

* **Interpolated values are escaped at the CALL SITE**, in `templates.ts`, where `esc()` is
  visible next to the value. Subjects and preheaders take the **raw** value instead — neither
  is HTML, and `&amp;` in a subject line is a visible defect.
* **`<strong>` lives inside the string**, because the emphasis moves with word order. A
  translator has to keep the tags, so the tags are kept few and simple.

**One plural split is kept on purpose.** `email.disconnect.autopayOne` / `autopayMany` are two
keys rather than one string carrying `{n}`, because English needs two — and a language with
more plural forms than two can add its own, which a single string could never allow.

## `reply_to` is resolved on the server, never taken from a caller

Added with distributions, and the only two messages that set it are the two a relative wrote:
a distribution, and a safety check-in. The other four are *from the product about the product*,
so a reply belongs at `support@`; a distribution was written by a relative, and a cousin
pressing Reply means to reach them.

The rule that comes with it is rule 1 in a different costume: **the address must come from a
row the caller already owns.** `sendDistribution` reads it off the sender's own `people` row
and skips it entirely for a generated placeholder address. A caller-supplied reply-to on mail
carrying GENORRA's SPF and DKIM is a phishing header on authenticated mail — the same reason
`to` is not a parameter a client chooses either.

## A member's words are the one payload that must be escaped

`distributionEmail` and `safetyCheckInEmail` are the two templates here whose *content*
somebody typed — the whole body in the first, and `title`/`detail` in the second. The other
four compose their own prose and interpolate a family name or a token, so `esc()` there is
hygiene; in those two it is the boundary, because the string is rendered in somebody else's
mail client.

`bodyParagraphs()` in `lib/distribution-audience.ts` deliberately returns **plain text** and
the escaping happens in the template, one line away — that module is pure and importing the
email layer to be correct would defeat the point of it. Keep the two adjacent, and keep the
`esc()` visible.

## The scaffold is expressed twice

`layout.ts` reproduces `supabase/templates/confirmation.html` in TypeScript, because
GoTrue renders static files that cannot import anything. They will drift if nobody looks.

All the reasoning behind the markup — tables, the enhancement-only `<style>`, the doubled
VML button, the Heritage band that does not change between themes, the sanctioned hex
literals, Gmail's 102 KB clip — lives in
[`supabase/templates/README.md`](../../supabase/templates/README.md) and is not repeated
here. Read it before changing either side, and change both together.

## The five auth emails come through a hook, and the endpoint is the exception to the rule above

Everything in this folder exists because **a sender must never be exported from a `'use
server'` file** — that would be an open relay on a domain carrying our SPF and DKIM.
`app/api/auth/send-email/route.ts` is a `POST` handler that composes and sends, which is that
shape one layer out, and the three things that make it a feature rather than the hole:

* **It has no recipient parameter.** The address comes from the signed payload and from nowhere
  else — not a query string, not a header.
* **The signature is checked before anything else happens.** `lib/auth/hook-signature.ts`,
  Standard Webhooks, over the raw bytes. There is no session to fall back on: the caller is a
  Go process in another container.
* **A failure answers non-2xx.** This is the ONE caller that must read `sendEmail`'s result,
  because GoTrue is waiting on it — everywhere else in this folder a soft failure is correct,
  since the decision is already committed.

`lib/email/auth-mail.ts` holds the five compositions. `supabase/templates/*.html` are the
frozen fallback for a deployment where the hook is off; that folder's README says so at the
top.

## Looking at an email locally, which was impossible until 2026-08-27

`sendEmail` posts to Resend's HTTPS API. The local Supabase stack captures SMTP in Mailpit.
**Those two have never met** — so without `RESEND_API_KEY` a send returns `{ sent: false }` and
logs a line, and with one it really sends, from a laptop, to a real inbox. Neither is a way to
read a message.

`EMAIL_CAPTURE_URL` points a send at a local listener instead. It receives the same JSON body
Resend would, so a capture is a dozen lines of Node — `scripts/auth-email-check.mjs` runs one.

**It is read only when `NODE_ENV !== 'production'`, and that guard must not become
configurable.** Set on a deployed environment, every approval, invitation and confirmation code
would go somewhere else and nothing would report a failure, because a capture answers 200.
Note that `next start` sets `NODE_ENV=production`: the capture works under `npm run dev` and is
correctly ignored by a production build.
