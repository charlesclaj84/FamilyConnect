# Auth email templates

The bodies GoTrue sends. Wired up in `supabase/config.toml` under
`[auth.email.template.*]` — and, because hosted does not read that file, **pasted by
hand** into Supabase → Authentication → Email Templates.

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

`config.toml` points at these files for **local** development only. Hosted renders
whatever was last pasted into the dashboard, so an edit here does nothing to production
until somebody pastes it. That is the one genuine drift risk in this directory — if you
change a template, paste it, and send yourself a real message before calling it done.

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

`reauthentication.html` is the exception: GoTrue sends a 6-digit `{{ .Token }}` there,
not a URL, so there is no link and no fragment to avoid.

`{{ .SiteURL }}` comes from `auth.site_url` and must match the deployment the mail was
sent from. It also builds the mark's `<img src>`, so the artwork follows the deployment
rather than being pinned to a hostname in the file.

**Never write `{{ … }}` inside an ordinary HTML comment.** Go substitutes inside comments
too, so a placeholder mentioned in passing renders a live token into every message. The
pointer comment in `confirmation.html` writes `.TokenHash` bare for this reason. The
conditional comments around the VML button are the deliberate opposite case — the braces
there *must* render.

## Size, and Gmail's clip

Gmail clips a message body over ~102 KB and hides the remainder behind *View entire
message* — which on a confirmation email would hide the button. Each file here is 8–11 KB
with ~90 KB of headroom, and the artwork is **referenced, not embedded**. A base64 `data:`
URI would spend that headroom for nothing: Gmail strips them anyway.

```bash
for f in supabase/templates/*.html; do echo "$(wc -c <"$f")  $f"; done
```

## No SVG, and the wordmark is text

Gmail strips `<img>` pointing at SVG entirely, so the mark is served as PNG
(`public/identity/genorra-app-256.png`) rather than `BRAND_MARK_SRC`.

The **wordmark is set as text**, not placed as artwork — the same rule as `.gn-wordmark`
in `globals.css`, and doubly right here, because most clients block images by default and
text survives that. Cormorant Garamond will not load in mail, so the stack falls through
to Georgia; letterspaced serif caps carry the brand adequately without a web font.

The mark's `alt` is deliberately empty. It sits directly beside the wordmark text, so alt
text would make a screen reader — and every recipient with images off — read "GENORRA"
twice.

## The band does not change between themes

`#6b2d3a` in both. The PNG has that exact colour baked into its own rounded-square tile
(sampled: ground `#6b2d3a`, marks `#d6a24a`, corners transparent), so a matching band
makes the tile disappear and leaves the gold mark floating on burgundy. Recolour the band
for dark mode and the tile reappears as a lighter square on a darker one.

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
