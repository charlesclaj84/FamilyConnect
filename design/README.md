# `design/` — the vendor design kits, exactly as delivered

Reference material. **Nothing here is imported, built, or served.** That last word is the
whole reason this directory exists, and it is a change from where these kits used to live.

| Kit | What it is |
|---|---|
| `home/v1_1/` | The brand kit — palette, wordmark, lockups, fonts, brand guide. **Current.** |
| `home/v1_0/` | The previous brand kit. Superseded by v1.1, kept for diffing. |
| `dashboard/v1_0/` | The Dashboard "Golden Master" handoff kit. |

## Why they moved out of `public/`

Both kits sat under `public/` until 2026-08-20, which meant every byte of them was
fetchable by anybody, signed in or not — no route, no gate, no referrer check. These URLs
resolved on production:

```
genorra.com/dashboard/04_MEDIA/family_hero_source.jpg
genorra.com/dashboard/01_REFERENCE/Dashboard_Golden_Master_OFFICIAL.png
genorra.com/dashboard/08_QA/VISUAL_ACCEPTANCE.md
```

**The photographs are what made that urgent.** `dashboard/v1_0/04_MEDIA/` holds seven
photographs — a family group shot, five portraits of an invented family, and an event
thumbnail. Nothing in the kit states a licence, names a photographer, or carries EXIF. So
the position was that GENORRA published seven photographs of identifiable people under its
own domain with no established right to do so, and they were indexable. That is not a
defect that might bite one day; it was a claim being made on every crawl.

Two smaller things went with it. About 28 MB stopped riding in every deploy, of which
2.3 MB is one reference PNG and 1.38 MB is a "vector" SVG that is 99 % embedded base64.
And `dashboard/v1_0/08_QA/`, `07_PAGE_PATTERNS/` and `00_START_HERE/` are internal design
correspondence — no secrets, but written for us rather than for readers.

**What this does not undo.** The blobs stay reachable to anybody who clones the repo, which
is a separate question from what genorra.com serves. Only a history rewrite changes that,
and for demo photography it is very likely not worth one. If provenance for those seven
images ever turns up, record it in `dashboard/v1_0/04_MEDIA/` — it is the one thing that
would settle the licensing question outright.

## The convention

`design/<kit>/<version>/`, and the version folder is not optional even for a kit that
arrived without one. `home/` came with `v1_0` and `v1_1` already; the Dashboard kit did not,
and was filed as `v1_0` anyway so that the next drop has somewhere to go that is not a
rename. AGENTS.md's kit-bump rule turns on being able to diff one version against the next.

## Serving artwork is `public/identity/`, and only that

`public/` now holds exactly one thing: `identity/`, the brand artwork the site actually
serves, named by role and wired through `lib/brand.ts`. Never point a `src` at a path in
this directory — copy the file into `identity/` (or colocate it beside the component and
use a static import, as `components/marketing/screenshots/` and
`components/dashboard/illustrations/` do). AGENTS.md, "Artwork paths, and the versioned
kits", is the full rule and explains why the copy is deliberate rather than lazy.

One script reads a kit directly and is not serving anything:
`scripts/kit-illustration.mjs` derives `components/dashboard/illustrations/family-tree.png`
from `dashboard/v1_0`, and `npm run art:check` fails when the committed PNG is no longer
what the kit derives to. Re-run `npm run art:build` as part of any kit bump.

## Kept out of the toolchain on purpose

`eslint.config.mjs` ignores `design/**/*.{ts,tsx,js,jsx}` and `tsconfig.json` excludes
`design`. The Dashboard kit ships five stub React components, and editing a handoff kit to
satisfy our lint and type rules would destroy the one property that makes it useful: that
it is byte-for-byte what the designer delivered.
