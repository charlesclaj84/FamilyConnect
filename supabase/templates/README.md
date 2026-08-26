# Auth email templates

The bodies GoTrue sends. Wired up in `supabase/config.toml` under
`[auth.email.template.*]`, which is what the local stack reads — and pushed to hosted
with `npm run email:push`, which is what production reads. See
"[Keeping the two copies in step](#keeping-the-two-copies-in-step)"; they were pasted by
hand until 2026-08-12 and no longer are.

**The rationale lives here, not in the templates.** These files are the payload: every
byte is transmitted to every recipient and is one "view source" away in any mail client.
A 4 KB comment block explaining our session plumbing is 35% of the message and tells a
stranger more about the auth flow than they need. Each template keeps a short pointer
comment; everything else is below.

| File | Config key | Dashboard name | Triggered by | Status |
|---|---|---|---|---|
| `confirmation.html` | `confirmation` | Confirm signup | sign-up | **live** |
| `recovery.html` | `recovery` | Reset password | `resetPasswordForEmail` → `/auth/confirm` → `/update-password` | **live** |
| `email-change.html` | `email_change` | Change email address | `auth.updateUser({ email })` — Sign-in & Security | **live** |
| `reauthentication.html` | `reauthentication` | Reauthentication | `auth.reauthenticate()` — same section | **live** |
| `invite.html` | `invite` | Invite user | `auth.admin.inviteUserByEmail()` | dormant — nothing calls it |

Four of the five were dormant when they were written, and overriding them anyway is what
made activating them a one-commit job rather than a bug hunt. Every GoTrue default links
with `{{ .ConfirmationURL }}`, so a stock tab means the first person ever to use that flow
hits the fragment bug below — a successful action and no session, in production, on the
day somebody flips a switch they think is unrelated.

`invite.html` stays overridden for exactly that reason, though nothing calls it.

## `invite.html` is not the family invitation email

The one thing in this directory most likely to be misread. There are two unrelated
invitation systems, and only one of them is here:

* **The family invitation** — `family_invitations`, `InviteMemberDialog`,
  `/invite/<token>`. It carries pre-approval and a target family. Since 2026-08-11 it
  emails through [`lib/email/`](../../lib/email/README.md) over Resend's HTTP API, because
  GoTrue knows nothing about families, family codes or pre-approval. Editing `invite.html`
  will not change that email.
* **`invite.html`** — GoTrue's `admin.inviteUserByEmail()`, which nothing in the app
  calls, and which cannot express either of those things.

There is a second, smaller reason the GoTrue one is still unused: an account it creates
has no password, so it needs the same set-a-password landing that recovery does. That
screen now exists at `/update-password`, so wiring it up is no longer blocked — it is
just not something the product needs while the family flow does the job better.

## Keeping the two copies in step

`config.toml` points at these files for **local** development only, and hosted keeps its own
copy of every template body — which it holds until CI replaces it.

**SINCE 2026-08-19 AN EDIT HERE REACHES PRODUCTION ON THE NEXT MERGE TO `master`, with nobody
running anything.** `.github/workflows/migrate.yml`'s one job ends with a step that runs
`npm run email:push -- --yes --project-ref=…` using the Management API token that job already
holds. Three consequences, and the second is the one that surprises people:

* This directory is now **unconditionally authoritative**. A template edited in the Supabase
  dashboard is reverted on the next merge that finds drift.
* One drifted template rewrites **all ten fields** — five bodies and five subjects — not only
  itself, because the PATCH is built from every row.
* `npm run email:pull` is the only route back, and it is a laptop command.

So treat a change to any file in this directory as a change to production mail. The commands
below are what a laptop still uses — asking rather than writing — and the drift risk that used
to be the point of this section is now mechanical rather than remembered:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…      # a Management API token, see below
npm run email:check                     # read-only. exit 1, with a diff, if hosted differs
npm run email:push                      # make hosted match this directory
npm run email:pull                      # overwrite this directory from hosted
```

[`scripts/auth-templates.mjs`](../../scripts/auth-templates.mjs) reads the same
`[auth.email.template.*]` table the CLI reads, so **`config.toml` remains the single
statement of which file is which template and what its subject is** — there is no second
list to keep in step, which is the failure this replaced rather than repeated.

**Why not `supabase config push`.** That command sends the entire `[auth]` block,
`site_url` included. Pushing a one-word copy edit from a checkout pointed at a local
stack would reconfigure production's redirect handling as a side effect — TODO.md's GO
LIVE section has carried that warning since before the script existed, and it is exactly
why these files were pasted by hand for two months. The Management API takes a partial
body, so `email:push` sends **ten fields**: a subject and a body for each of the five
templates, and nothing else. `assertOnlyMailerFields` refuses to transmit a key outside
`mailer_subjects_*` / `mailer_templates_*_content`, so that stays true of the code as
*run* rather than only of the code as written.

Three practical notes:

* **`SUPABASE_ACCESS_TOKEN` is a Management API personal access token** (`sbp_…`) from
  <https://supabase.com/dashboard/account/tokens>. It is not the service role key and not
  the database password. `supabase login` keeps its own copy in the OS keyring, which a
  script cannot read, so being logged in to the CLI is not enough. Export it for the one
  command rather than putting it in `.env.local` — it is an account-wide credential, far
  broader than anything else this repo holds.
* **The project ref** comes from `--project-ref=`, `SUPABASE_PROJECT_REF`, or
  `supabase/.temp/project-ref` if the CLI is linked — in that order, and the script prints
  which one it used, because the whole point is knowing what you just wrote to.
* **A push is not a send.** It proves the bytes arrived, not that the mail renders. The
  old advice survives intact: change a template, push it, and send yourself a real message
  before calling it done.

`email:pull` exists for the opposite direction — somebody edits a template in the
dashboard and the repo needs to catch up. It writes only where hosted differs and never
where hosted has no override, so it cannot blank a file against a stock GoTrue tab.

## The shared scaffold

All five are the same document with one content block swapped: preheader, `<h1>`, body
copy, the call to action, and the fine print. Everything else — the band, the gold rule,
the `<style>` block, the footer — is byte-identical, and should stay that way. GoTrue has
no include mechanism, so this is enforced by eye rather than by the language:

```bash
diff supabase/templates/confirmation.html supabase/templates/recovery.html
```

Anything outside the content block showing up in that diff is drift. `reauthentication`
is the one legitimate exception — it has no button, so it carries `.gn-otp` instead of
`.gn-btn` in its `<style>` block.

---

## Why they look like 2003

Nested tables with inline styles, because Outlook renders mail with **Word's** engine:
no flexbox, no grid, no external CSS.

The `<style>` block is **enhancement only** — dark mode and one mobile breakpoint. Gmail
strips `<style>` for non-Gmail accounts in its app, so every colour that matters is also
inline. Delete the block and the email is still correct, just always light and slightly
wide on a phone. Do not move an inline style into it.

Editor warnings about inline styles are expected here and should not be "fixed".

The button is doubled: a VML `<v:roundrect>` inside `<!--[if mso]>` and the real anchor
inside `<!--[if !mso]><!-- -->`. Word's engine ignores padding on an inline `<a>`, so
without the VML the button collapses to a bare text link in Outlook desktop — on a
product whose users skew older, that is not a rounding error. If comments are ever
stripped in transit the anchor survives and the VML does not, which is the safe
direction.

## The link is `token_hash`, not `{{ .ConfirmationURL }}`

The thing in this directory that must not be "simplified". GoTrue's default
`{{ .ConfirmationURL }}` points at its own `/auth/v1/verify`, which confirms server-side
and then redirects to `site_url` **with the session in the URL fragment**. A fragment is
never sent to the server, and this app is cookie-based via `@supabase/ssr` — so the user
confirms successfully and lands on a signed-out page with nothing explaining why.

So each template links to our own `/auth/confirm` with a `token_hash`, and
[`app/auth/confirm/route.ts`](../../app/auth/confirm/route.ts) exchanges it server-side
through the same cookie plumbing every other request uses. The stock template *looks*
like it works, which is what makes this worth a paragraph.

`reauthentication.html` is the exception: GoTrue sends an 8-character `{{ .Token }}`
there, not a URL, so there is no link and no fragment to avoid.

### The code block is sized for eight characters, at the worst case

`auth.email.otp_length` is **8** (matched to hosted, 2026-08-12), which makes it a layout
constant as much as a security one. The block has to fit on a 320px phone **with the
`<style>` block stripped**, because that is what Gmail does for non-Gmail accounts — so
the mobile `.gn-pad` override cannot be assumed and the inline size has to survive alone.

That worst case leaves 182px for the code:

```
320  viewport
-24  outer cell padding (12px each side)
-2   card border
-88  content cell padding — 44px each side, because .gn-pad did NOT apply
-24  the code block's own padding (12px each side)
=182px
```

A monospace advance is about `0.6em`, and letter-spacing adds to every character, so eight
characters cost `8 × size × (0.6 + spacing)` plus one `text-indent` — which is there to
undo the trailing letter-space that would otherwise throw the centring off by one slot.
At **28px / 0.14em** that is `8 × 20.7 + 3.9 ≈ 170px`, leaving about 12px of slack:

| size | spacing | 8 chars | fits 182px? |
|---|---|---|---|
| 38px | 0.26em | 271px | no — the old six-character setting |
| 34px | 0.18em | 218px | no |
| 30px | 0.12em | 176px | barely — inside the margin of error on the advance estimate |
| **28px** | **0.14em** | **170px** | **yes** |

The mobile `.gn-otp` size override was **removed** rather than retuned: it existed to pull
38px down to 32px on a phone, and an inline value that already fits the phone makes it a
second number to keep in step for no gain. Keep `letter-spacing` and `text-indent` equal
if you retune.

`{{ .SiteURL }}` comes from `auth.site_url` and must match the deployment the mail was
sent from. It also builds the mark's `<img src>`, so the artwork follows the deployment
rather than being pinned to a hostname in the file.

**Never write `{{ … }}` inside an ordinary HTML comment.** Go substitutes inside comments
too, so a placeholder mentioned in passing renders a live token into every message. The
pointer comment in `confirmation.html` writes `.TokenHash` bare for this reason. The
conditional comments around the VML button are the deliberate opposite case — the braces
there *must* render.

## The reauthentication code is not always checked

Worth knowing before writing copy for `reauthentication.html`, because the honest wording
depends on it. `secure_password_change = true`, but GoTrue reads its own setting as
"reauthenticate **or have logged in recently**", and recently means the session was created
within 24 hours. So on a session younger than that the code is composed, sent, typed in and
**not verified** — a deliberately wrong one still changes the password. The measured matrix
is in `config.toml` beside the flag.

Two consequences for this template:

* **The copy may not claim that entering the code proves anything.** It says what the code
  is for and how to treat it, and stops there. `SignInSecurity.tsx` is written to the same
  rule, and asks for the current password as well precisely because this email cannot be
  relied on alone.
* **A recipient who did not ask for this should be told what to do,** since the email is
  the only signal they get that somebody is trying. That is what the fine print is for; it
  is load-bearing rather than boilerplate.

## Size, and Gmail's clip

Gmail clips a message body over ~102 KB and hides the remainder behind *View entire
message* — which on a confirmation email would hide the button. Each file here is 8–11 KB
with ~90 KB of headroom, and the artwork is **referenced, not embedded**. A base64 `data:`
URI would spend that headroom for nothing: Gmail strips them anyway.

```bash
for f in supabase/templates/*.html; do echo "$(wc -c <"$f")  $f"; done
```

## No SVG, and the wordmark is text

Gmail strips `<img>` pointing at SVG entirely, so the mark is served as PNG rather than
`BRAND_MARK_SRC`.

**IT IS `genorra-app-256.png` — THE FULL-COLOUR TILE — SINCE 2026-08-26.** Before that it was
`genorra-mail-mark-256.png`, the gold-on-burgundy tile, chosen so its own ground matched the
band's and the tile disappeared into it. That was the more elegant composition and it had one
cost that outweighed it: **mail was the only surface where GENORRA was monochrome.** The rail
draws the full-colour mark at 64px, an installed home-screen icon is the full-colour tile
(`app/manifest.ts` argues that one), and a transactional email was gold on burgundy — so the
first thing a new member ever sees from this product did not look like the product.

So the tile is the full-colour one, on the same burgundy band, with `border-radius:14px` on the
`<img>`. Its ground is cream, so it now reads as an app-icon badge on the band rather than
vanishing into it — **which is deliberate and is the thing the previous note warned about
happening by accident.** If you find a cream rounded square on burgundy and think it is a
mistake, it is not; changing it back is a decision about whether mail may be monochrome.

`genorra-mail-mark-256.png` is kept in `public/identity/` and is now referenced by nothing.
It is the only asset in that folder in that position, and it stays for one reason: the gold
tile is the artwork a dark-banded design would need, and re-deriving it from the kit is a
`design/` lookup rather than a copy. **Do not repoint the manifest at it** — that is the swap
`app/manifest.ts` exists to prevent.

The **wordmark is set as text**, not placed as artwork — the same rule as `.gn-wordmark`
in `globals.css`, and doubly right here, because most clients block images by default and
text survives that. Cormorant Garamond will not load in mail, so the stack falls through
to Georgia; letterspaced serif caps carry the brand adequately without a web font.

The mark's `alt` is deliberately empty. It sits directly beside the wordmark text, so alt
text would make a screen reader — and every recipient with images off — read "GENORRA"
twice.

## The band does not change between themes

`#6b2d3a` in both, and the reason has changed with the tile. It used to be that
`genorra-mail-mark-256.png` had that exact colour baked into its own rounded square, so a
matching band made the tile disappear — recolour the band for dark mode and the tile reappeared
as a lighter square on a darker one.

The full-colour tile has a cream ground, so it no longer disappears into anything and that
argument is gone. The band still does not move, for a plainer reason: **a header that is the
same in both themes is one fewer thing a mail client can get wrong.** Every dark-mode failure
in this directory has been a client overriding a colour we set; a band with no override to
apply cannot be one of them. It carries `class="gn-band"` purely so Outlook's inverter can be
told to leave it alone.

## Dark mode is the client's, not ours, and that is what broke the button

Reported as: *you cannot see the text on Confirm my email address.*

The `@media (prefers-color-scheme: dark)` block was correct and was not the whole story. Two
gaps, both fixed on 2026-08-26, and the first is the one that mattered:

* **The CSS `color-scheme` property was missing.** Both `<meta>` tags were present —
  `color-scheme` and `supported-color-schemes` — and iOS Mail and Outlook read the CSS
  PROPERTY to decide whether to apply their own inversion. Without it they invert on top of
  whatever we set, darkening the sand button label until it disappears into the burgundy behind
  it. No `@media` rule can prevent that, because the client acts after ours have applied. It is
  now declared on `:root` and on `body` in all five templates and in `lib/email/layout.ts`.
* **Outlook.com ignores `prefers-color-scheme` entirely** and stamps `data-ogsc` (original get
  style color) and `data-ogsb` (background) on what it has rewritten. Those attributes are the
  only hook for putting a colour back, so every dark rule is mirrored through them. In a client
  that never sets them the mirror selects nothing.

**And the button label is pinned inline, with an important flag, on both the anchor and a span
inside it.** Three independent defences, because there is no way to test a mail client from
here: an inline important beats a client-injected rule, and the nested span gives a second
element with its own declaration for a client that rewrites the anchor's.

One consequence worth knowing: an inline important also beats a stylesheet important, so the
dark block's `.gn-btn a` colour rule would now be dead and has been replaced by a comment
saying so. It is not needed — sand is **7.37:1** on the light band and **5.27:1** on the dark
button fill, so one label colour is correct in both themes and there is nothing to swap.

**This is still not a rendered email.** `npm run email:check` reports that the bytes match
hosted; it says nothing about what a phone draws. Send yourself a real signup and look at it in
dark mode before calling this done.

## Colour literals in this directory

`AGENTS.md`, "Colours live in one place", says `app/globals.css` is the only file in the
app that may contain a colour literal. **These templates are the second sanctioned
exception**, on the same grounds as `BRAND_THEME_COLOR` in `lib/brand.ts`: they are
rendered by somebody else's mail client, where no stylesheet of ours is loaded and a CSS
custom property cannot resolve.

Every hex used is a token by value. Keep them in step with `globals.css` by hand.

| Hex | Token | Job in the email |
|---|---|---|
| `#6b2d3a` | `--genorra-heritage` | band, button, headings (`--brand-primary` / `--brand-ink`) |
| `#e5d9c6` | `--genorra-nurturing` | text on heritage (`--brand-on-primary`), 7.31 |
| `#d6a24a` | `--genorra-legacy` | gold rule and bullets — **non-text accent only** |
| `#faf7f2` | `--genorra-light` | the card |
| `#f2ece3` | `--genorra-muted-light` | page ground behind the card |
| `#e7dccf` | `--genorra-border-light` | hairlines |
| `#3c2528` | `--genorra-ink` | body text, 13.21 on Light |
| `#6d5a53` | `--genorra-muted-fg-light` | footer and fine print, 5.98 on Light |
| `#1e1216` | `--genorra-ground-dark` | dark page ground |
| `#26191e` | `--genorra-card-dark` | dark card |
| `#402931` | `--genorra-border-dark` | dark hairlines |
| `#b9afa4` | `--genorra-muted-fg-dark` | dark fine print |
| `#7d474f` | `--genorra-heritage-lift` | `--brand-primary` in dark, carries Light at 6.81 |

Gold has no `on-` partner and never carries text here — it is a 3px rule and two bullet
separators. That is the rule from `AGENTS.md`, not a stylistic choice: Legacy gold is
2.30 against white.

---

## Voice

These are the highest-open messages the product will ever send, and for most recipients
the confirmation email is the **first** GENORRA artefact they see — before the app. It is
a brand moment that happens to carry a link, so the copy is written rather than
defaulted.

Four rules, each of which changed something in the files:

* **Lead with the person, not the mechanism.** The first draft opened "Someone —
  hopefully you — signed up", which begins the relationship by hedging about whether the
  reader exists. Doubt belongs in the security footer, which already carries it. The `<h1>`
  now states progress — "You're almost in", "Let's get you back in" — and the button
  carries the instruction unambiguously for anyone skimming.
* **Say what happens next, especially when it is a wait.** Confirming is not admission:
  the family still approves new members. Unsaid, that holding screen reads as a failure
  and generates a message to whoever sent the invitation. One sentence removes it.
* **Contractions, and "safely".** "You can safely ignore this email" does more reassuring
  work than a longer legal-sounding sentence, and a family product that writes "do not"
  where it means "don't" sounds like a bank. Typographic apostrophes (`&rsquo;`), not
  straight quotes.
* **Never promise what is not built.** An earlier draft of the confirmation copy said
  we would let the member know the moment they were approved. Nothing verifies that
  notification is sent, so the line came out. Copy that outruns the product is a support
  ticket with a delay on it.

Preheader text — the hidden line the inbox shows beside the subject — **extends** the
subject rather than repeating it, and stays under about 90 characters so a phone does not
truncate it. It is padded with zero-width joiners so the client shows the intended
sentence instead of pulling the first paragraph in behind it.

Two pieces of security copy are deliberate and should not be softened: the
reauthentication email says we will never ask for the code by phone, text or email, and
the email-change notice suggests changing the password, because that request can only
come from a signed-in session — if it was not the owner, the session was not theirs.
