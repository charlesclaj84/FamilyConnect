# Application email

Mail the **app** sends, over Resend's HTTP API. Distinct from `supabase/templates/`,
which is mail **GoTrue** sends over SMTP. One Resend account, two protocols, because
GoTrue only speaks SMTP and a serverless function only comfortably speaks HTTPS.

| | GoTrue (`supabase/templates/`) | App (`lib/email/`) |
|---|---|---|
| Sends | sign-up, recovery, email change, reauthentication, GoTrue invite | membership approved, family invitation |
| Composed from | static HTML pasted into the Supabase dashboard | `layout.ts` + `templates.ts` |
| Knows about families | no | yes — which is the whole reason these are here |
| Transport | SMTP → `smtp.resend.com` | HTTPS → `api.resend.com` |

## Environment

Three variables, none of which has a safe fallback in production.

| Variable | Required | What breaks without it |
|---|---|---|
| `RESEND_API_KEY` | yes | Nothing is sent. Logged as a warning, never thrown — an approval still succeeds. |
| `NEXT_PUBLIC_SITE_URL` | no | An override. Unset, `emailOrigin()` resolves through `lib/site.ts`: the custom domain on a production deployment, the stable `.vercel.app` host on a preview, `localhost:3000` in dev. Set it only to point somewhere else — `.env.local` uses it so a dev server's emails link to localhost. |
| `EMAIL_FROM` | no | Defaults to `GENORRA <noreply@genorra.com>`. Must be on a Resend-verified domain or every send 403s. |

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

## The scaffold is expressed twice

`layout.ts` reproduces `supabase/templates/confirmation.html` in TypeScript, because
GoTrue renders static files that cannot import anything. They will drift if nobody looks.

All the reasoning behind the markup — tables, the enhancement-only `<style>`, the doubled
VML button, the Heritage band that does not change between themes, the sanctioned hex
literals, Gmail's 102 KB clip — lives in
[`supabase/templates/README.md`](../../supabase/templates/README.md) and is not repeated
here. Read it before changing either side, and change both together.
