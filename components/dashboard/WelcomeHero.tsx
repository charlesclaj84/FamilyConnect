import { Award, MapPin } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EventPhoto, HeroCurve, TreeWatermark } from '@/components/dashboard/curves'
import type { T } from '@/lib/i18n/t'

interface Props {
  /**
   * The reader's language, bound. Threaded from the page rather than resolved here: a
   * Server Component cannot read `LocaleProvider` and has no `user` of its own. See
   * `lib/i18n/server.ts`.
   */
  t: T
  firstName: string
  initials: string
  avatarUrl?: string | null
  /** Board positions this member holds, already formatted. Empty for most people. */
  roles: string[]
  chapterName?: string | null
  /**
   * The premier gathering's photograph, already a URL — only ever set alongside
   * `ground="page"`, because the crop it fills exists only in that composition. `null` or
   * absent draws the kit's traced-tree placeholder in the same shape, so the band is complete
   * either way and a family that has not chosen a picture is not shown a hole.
   */
  photoUrl?: string | null
  /**
   * Which ground the greeting sits on. `'band'` is the standalone Heritage band — the
   * default, and what most members see. `'page'` is the Golden Master's composition, used
   * ONLY when `PremierGatheringHero` follows directly beneath it. See the header.
   */
  ground?: 'band' | 'page'
}

/**
 * The greeting that opens the Dashboard, on either of the kit's two grounds.
 *
 * ── WHY THERE ARE TWO, AND WHY THE SECOND IS NOT THE DEFAULT ──────────────────────
 * The Golden Master draws ONE composition: the greeting on CREAM at the top left, a family
 * photograph clipped organically at the top right, and a burgundy event band beneath, with a
 * single swoop between them and a gold hairline along it. The repo INVERTED that for a real
 * reason — with no event band to sit above, a cream greeting is three lines of text floating
 * on the page, and the Heritage band is the entire visual identity of the screen.
 *
 * So the ground follows whether the band beneath EXISTS:
 *
 *   | `ground`  | when                          | what the member sees                    |
 *   |-----------|-------------------------------|-----------------------------------------|
 *   | `'band'`  | no premier gathering (usual)  | one Heritage band, swoop at its foot    |
 *   | `'page'`  | a premier gathering is flagged | the kit's composition, greeting on cream |
 *
 * `'page'` is therefore only ever correct with `PremierGatheringHero` directly beneath, and
 * `app/(protected)/dashboard/page.tsx` is the one caller that decides. Rendering `'page'`
 * alone is not a style choice — it removes the screen's only Heritage surface.
 *
 * ── WHAT IS HERE AND WHAT IS NOT ──────────────────────────────────────────────────
 *   * **The event** has SHIPPED, and not into this band. This said it was "real data with a
 *     working action behind it, blocked only by `/events` being `status: 'future'`" — that
 *     product is retired (`20260819000006`) and Gatherings replaced it, so the sentence named
 *     a route that no longer exists. It is `PremierGatheringHero`, the band beneath; read its
 *     header before changing either, because the two are deliberately one curve language and
 *     that only holds if both ends know it.
 *   * **The photograph** has no home in the schema at all — `families` has no image column and
 *     there is no bucket for one. On the `'page'` ground the kit's own `eventPhotoMask` holds
 *     the space instead (`EventPhoto`), which is the shape the kit reserved without
 *     the affordance the schema cannot honour. On `'band'` the traced tree watermark fills the
 *     right of the band, which is the same answer in the composition that has no cream to
 *     put a crop on.
 *   * **The kit's subline** — "Let's keep our family connected." — is deliberately NOT here on
 *     either ground. It is mock sentiment, and `lib/brand.ts` says in terms that `APP_LEAD`
 *     "leads a marketing page and speaks to somebody who has not signed up" while the motto
 *     the rail already renders is the line for a member who is inside. A second slogan on the
 *     same screen is noise; the role chips and chapter that occupy that space are FACTS about
 *     the person reading, which is the better use of it.
 *   * **The avatar stays**, which the kit does not draw — its greeting has none, because the
 *     member's picture is in the top bar. Ours is too (`TopBar` renders it), so this is a
 *     deliberate departure rather than an oversight: that one is a 32px menu trigger and this
 *     is a portrait, and the repo had already chosen to open the screen with the member's own
 *     face. Dropping it is deleting one element if that judgement ever changes.
 *
 * ── COLOUR IS PER GROUND, AND NOT ONE TOKEN OF IT IS OPTIONAL ─────────────────────
 * `--brand-on-hero` is sand: correct on Heritage, invisible on cream. `--brand-ink` is the
 * inverse — burgundy on a cream page, sand on a dark one, which is exactly the role "strong
 * brand text" and why the `'page'` heading sets NO colour at all and lets the base layer paint
 * it.
 *
 * SO THE STRUCTURE IS SHARED AND ONLY THE TOKENS BRANCH. Every element of the greeting is
 * written once and rendered on both grounds; what differs is a `text-*` and, for the avatar
 * ring, gold-on-Heritage versus the soft well on cream (gold on cream is 2.30 and reads as a
 * smudge). This paragraph used to end by naming `--brand-legacy` as "the one token that is
 * right on both … which is why the role chips are untouched" — that was true while positions
 * were gold pills, and they are lines now, so the chips are gone and with them the only piece
 * of this greeting that did NOT branch. Nothing is worse for it: a filled gold surface was the
 * one element that had to look identical on two grounds precisely because it could not adapt.
 *
 * THE CURVE IS THE PAGE, NOT A COLOUR. `HeroCurve` fills with `currentColor` and the band
 * sets `text-background`, so the swoop is literally the page ground cutting up into it. That
 * is why the redesign needed no "curve colour" token and why it is correct in dark mode free.
 *
 * THE GROUND IS A GRADIENT, AND IT IS TWO CLASSES ON PURPOSE. `.gn-hero-gradient` sets a
 * `background-image` and `bg-brand-hero` stays underneath as the surface — the kit fills its
 * burgundy hero corner-to-corner rather than flat. Neither the stops nor the direction are
 * here: they are `--brand-hero-gradient` in `app/globals.css`, measured against
 * `--brand-on-hero` at both extremes, which is the only place a colour may be decided.
 *
 * `pb-20` on the band is not padding taste — it is clearance for the curve, which is `h-16`
 * absolutely positioned at the bottom. Reduce one and the greeting sits in the swoop.
 */
export function WelcomeHero({
  firstName, initials, avatarUrl, roles, chapterName, photoUrl, ground = 'band', t,
}: Props) {
  const onBand = ground === 'band'

  const greeting = (
    <>
      {/* `ring-brand-legacy/40` on Heritage rather than the Avatar's default foreground ring:
          on a burgundy ground that default is a dark halo on a dark field, i.e. nothing. On
          cream the opposite holds — gold on cream is 2.30 and reads as a smudge — so the ring
          becomes the soft brand well, which is what that token is for. */}
      <Avatar
        url={avatarUrl}
        initials={initials}
        size="lg"
        className={onBand ? 'ring-2 ring-brand-legacy/40' : 'ring-2 ring-brand-soft'}
      />
      <div className="min-w-0">
        {/* On Heritage `text-brand-on-hero` is not optional: the base layer paints every
            h1/h2 `--brand-ink`, which is burgundy in light mode — burgundy on burgundy. On
            cream that base layer is exactly right, so the heading names no colour and the
            eyebrow takes `--brand-ink` to match the kit, which sets both in Heritage. */}
        {/* THE TYPE SCALE ON CREAM IS THE KIT'S, NOT THE BAND'S. The Golden Master sets the
            name at 62px against a 30px "Welcome back," in a 790-wide box — so on a dashboard
            it is the largest thing on the screen by a wide margin, which is the whole reason
            its greeting can hold the top of the page with no burgundy behind it. The band
            variant stays smaller because a 60px name inside a 200px band leaves no room for
            the roles and chapter under it. `font-display` on the eyebrow because the kit sets
            BOTH lines in Cormorant; the base layer gives the serif to h1/h2 automatically and
            to nothing else. */}
        <p
          className={
            onBand
              ? 'text-sm text-brand-on-hero/80'
              : 'font-display text-xl text-brand-ink sm:text-2xl'
          }
        >
          {t('dash.welcome')}
        </p>
        <h1
          className={
            onBand
              ? 'truncate text-3xl leading-tight text-brand-on-hero sm:text-4xl'
              : 'truncate text-4xl leading-tight sm:text-6xl'
          }
        >
          {firstName}!
        </h1>

        {/* ── POSITION, THEN CHAPTER — ONE TREATMENT, BOTH GROUNDS ──────────────────
            A board position outranks a chapter: it is what the member DOES for the family,
            where the chapter is where they are. So it reads first and the chapter sits under it
            as the qualifier — which is also the order `formatBoardTitle` puts them in inside a
            single title ("Austin Chapter Treasurer").

            THE BAND USED TO PUT THE POSITION IN GOLD CHIPS and the chapter on a line, and the
            two did not read as belonging together — a saturated pill above a quiet line looks
            like a badge and a footnote rather than one block of standing. Worse, once the cream
            variant existed the same member saw their position two different ways depending on
            whether the family happened to have a premier gathering flagged, which is the
            drift "A table is a table" is about one screen over: two surfaces answering one
            question owe the same answer.

            So both grounds render the same pair of icon+text lines and differ only in the
            tokens, which is the one thing that MUST differ — `--brand-on-hero` is sand and
            unreadable on cream, `--brand-ink` is burgundy and invisible on Heritage. The
            position takes the stronger of the two colours on each ground and the chapter the
            quieter one, so the hierarchy survives the theme as well as the ground.

            `Award` for the position and `MapPin` for the chapter, so the pair is distinguishable
            without reading — and neither is announced, because the text beside each already says
            what it is.

            Positions are a LIST: a member may hold more than one (`getMyRoles` returns every
            `user_roles` row) and there is no primary. Each gets its own line rather than being
            joined with commas, so somebody holding "National President" and "Austin Chapter
            Treasurer" reads two facts instead of one run-on phrase. */}
        {roles.length > 0 && (
          <div className="mt-3 space-y-1">
            {roles.map(role => (
              <p
                key={role}
                className={
                  onBand
                    ? 'flex items-center gap-1.5 text-sm font-medium text-brand-on-hero'
                    : 'flex items-center gap-1.5 text-sm font-medium text-brand-ink'
                }
              >
                <Award className="h-3.5 w-3.5 shrink-0" />
                {role}
              </p>
            ))}
          </div>
        )}

        {chapterName && (
          <p
            className={
              onBand
                ? 'mt-1 flex items-center gap-1.5 text-sm text-brand-on-hero/80'
                : 'mt-1 flex items-center gap-1.5 text-sm text-muted-foreground'
            }
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {chapterName} Chapter
          </p>
        )}
      </div>
    </>
  )

  if (!onBand) {
    return (
      <section className="relative z-10">
        {/* THE KIT'S PHOTO CROP, hanging over the seam so the swoop can cut it.

            `-bottom-24 h-56` IS ONE RATIO, NOT TWO NUMBERS. `EventPhoto` spans the
            crop's top (kit y=27) to the crest window's bottom (y=330) — 303 units, of which the
            crest is the last 130. The band draws its crest at `h-24` (96px), so 130 units are
            96px and the whole element is 303/130 x 96 = 224px, which is `h-56`; and its bottom
            has to land where the crest window's does, which is 96px below this section, i.e.
            `-bottom-24`. Both numbers move if the band's crest height does, and
            `PremierGatheringHero` says so at its crest.

            `z-10` ON THE SECTION, AND NO `isolate`. The crop overhangs the band, which is a
            LATER sibling and would otherwise paint over it. `isolate` was here and had to go:
            it makes this section a stacking context, which traps the crop's z-index inside it
            and hands the band the top of the page again.

            `w-full` IS NOT REDUNDANT BESIDE `inset-x-0`, AND LEAVING IT OFF IS WHY THIS FIRST
            SHIPPED IN THE MIDDLE OF THE PAGE. An `<svg>` is a REPLACED element, and for an
            absolutely positioned replaced element with `width: auto` CSS resolves the width from
            the intrinsic size and then, being over-constrained, IGNORES `right` — so `inset-x-0`
            set the left edge, the viewBox's own ratio set the width, and the crop landed about
            a third of the way across instead of running off the right edge. All four curves in
            `curves.tsx` carry `w-full` for exactly this reason; it looks like belt-and-braces
            next to `inset-x-0` and it is the thing doing the work.

            Worth knowing how it survived review: the geometry was verified by rendering the
            same paths and boxes through `sharp`, which draws SVG directly and never resolves a
            CSS box — so the harness showed the correct composition while the browser did not.
            A preview that bypasses the layout engine cannot see a layout bug.

            HIDDEN BELOW `sm`. At 390px the greeting and the crop cannot both have room, and the
            thing that would give way is the member's name. The band draws its own crest and
            hairline, so the seam is complete without this. */}
        <EventPhoto photoUrl={photoUrl} className="pointer-events-none absolute inset-x-0 -bottom-24 hidden h-56 w-full text-brand-soft sm:block" />

        {/* `sm:pr-[42%]` keeps the name clear of the crop. It tracks `CROP_LEFT_PCT` in
            `curves.tsx` — 62%, so the crop takes the right-hand 38% — plus four points, because
            the shape's widest point is partway down and a name stopping exactly at its edge
            reads as a collision. It was 58% while the crop sat at the kit's own 43.5%; the crop
            is slimmer now and the name has the room back.

            `min-h-32` is 128px, which is exactly the crop's 224px less the 96px that hangs
            below — so the crop starts at the top of the greeting the way the kit's photograph
            does. Taller than this and the crop begins partway down; shorter and it starts above
            the section. It also matters most for the member who holds no board position and no
            chapter, where the greeting is two lines. */}
        <div className="relative flex min-h-32 flex-wrap items-center gap-5 py-2 sm:pr-[42%]">
          {greeting}
        </div>
      </section>
    )
  }

  return (
    <section className="gn-hero-gradient relative isolate overflow-hidden rounded-3xl bg-brand-hero text-brand-on-hero">
      {/* Behind everything, bleeding off the right edge the way the kit's does. Low
          opacity is required, not stylistic — see tree-watermark-path.ts on why this
          artwork must never be shown large and crisp. */}
      <TreeWatermark className="pointer-events-none absolute -right-8 -top-6 h-[125%] w-auto opacity-[0.07]" />

      <div className="relative flex flex-wrap items-center gap-5 px-6 pb-20 pt-8 sm:px-10 sm:pt-10">
        {greeting}
      </div>

      <HeroCurve className="absolute inset-x-0 bottom-0 h-16 w-full text-background" />
    </section>
  )
}
