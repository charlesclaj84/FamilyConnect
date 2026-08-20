import { cn } from '@/lib/utils'
import type { GatheringStatus, GatheringTaskStatus } from '@/lib/gatherings'

/**
 * How a gathering's status and a task's status are PAINTED. Nothing else.
 *
 * ── THE LABELS ARE NOT HERE, AND MUST NOT BE COPIED HERE ────────────────────────────
 * `GATHERING_STATUS_LABEL` and `GATHERING_TASK_STATUS_LABEL` live in `lib/gatherings.ts`,
 * which is pure and is shared with the server — the actions read the same vocabulary the
 * screens print. Two copies of a vocabulary is how two screens come to disagree, so a call
 * site imports the WORDS from `lib/gatherings.ts` and the CLASSES from here. This module is
 * the visual half and knows nothing else; it is why it may live under `components/` while the
 * vocabulary cannot.
 *
 * ── ONE TABLE PER DOMAIN, WHICH IS WHY NO CALL SITE INLINES A STATUS COLOUR ─────────
 * `components/events/status.ts` is the pattern and the reason: the event lifecycle badge was
 * two byte-identical copies in two components until it was named once. Six Gatherings
 * screens read these two records — `/gatherings`, `/gatherings/[id]`, `/gatherings/my-tasks`,
 * `/gatherings/calendar`, `/admin/gatherings`, `/admin/gatherings/[id]` — and a status recoloured on one
 * of them and not the others is a bug nobody sees until two screens are open side by side.
 *
 * ── THE TOKENS, AND WHY EACH ONE ────────────────────────────────────────────────────
 * Every pairing below is a MEASURED pair from `app/globals.css` and none of them is crossed:
 * a foreground from one pair on the surface of another is not a checked combination in either
 * theme. No hex, no arbitrary value — the rule this file exists inside (AGENTS.md, "Colours
 * live in one place").
 *
 *   * **Muted** for a state that is not yet anything. `planning` and `open` are both "nobody
 *     has done this yet", which is the same thing `draft` is on an event.
 *   * **Legacy gold, AS A SURFACE** for the state that is waiting on somebody:
 *     `bg-brand-legacy text-brand-on-legacy`. Gold is 2.30 on white and 1.65 on sand, so it
 *     can NEVER carry text on a pale ground — the only sanctioned uses are a surface with its
 *     measured dark partner on it (6.14), and a non-text accent. That is why `scheduled` and
 *     `submitted` are filled pills and not gold text.
 *   * **Affirm** for the good terminal state — `approved`, and `complete`, which is the
 *     gathering-level version of the same thing.
 *   * **Withheld for a DENIED TASK, and this is the case that token exists for.** A denial
 *     here is not an error and not a deletion: the organizer has handed the task back WITH
 *     NOTES and the member submits again, which is the whole feedback loop — and
 *     `GATHERING_TASK_STATUS_LABEL` says "Needs another look" rather than "Denied" for the
 *     same reason. `--destructive` reads as alarm because it IS alarm; painting a returned
 *     task in it tells the member they broke something. `--brand-withheld` is Warmth,
 *     deliberately has no `on-` partner, and is used the way the two existing pills in the
 *     tree use it (`DuesProjectionsClient`'s "Nothing paid", `HelpAvailabilityBadge`): a /10
 *     tint carrying its own foreground.
 *   * **Destructive, as a TINT rather than a fill, for `cancelled`.** A cancelled gathering
 *     must not shout louder than a live one in the same list — verbatim the reasoning
 *     `EVENT_STATUS_PILL` records for its own cancelled row. This is the one state in the file
 *     that genuinely is "this is not happening", which is the boundary between the two
 *     tokens: `--destructive` for a thing that has been called off or has failed,
 *     `--brand-withheld` for a capability held back.
 */

/**
 * The pill GEOMETRY, so six screens cannot each pick their own radius and padding.
 *
 * Shape only — no colour at all, because the colour is the whole content of the two records
 * below and a default would be a fourth state. Compose them:
 *
 *     <span className={cn(GATHERING_PILL_SHAPE, GATHERING_TASK_STATUS_PILL[task.status])}>
 *       {GATHERING_TASK_STATUS_LABEL[task.status]}
 *     </span>
 *
 * `whitespace-nowrap` is load-bearing rather than tidy: "Waiting for review" wraps to two
 * lines inside a table cell at 390px, and a two-line pill in a row of one-line pills reads as
 * a different kind of thing.
 */
export const GATHERING_PILL_SHAPE =
  'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium'

/** A gathering's own lifecycle. Stored, not derived — see `GATHERING_STATUS_LABEL`. */
export const GATHERING_STATUS_PILL: Record<GatheringStatus, string> = {
  planning:  'bg-muted text-muted-foreground',
  scheduled: 'bg-brand-legacy text-brand-on-legacy',
  complete:  'bg-brand-affirm text-brand-on-affirm',
  cancelled: 'bg-destructive/10 text-destructive',
}

/** A task's state: not started, waiting on the organizer, approved, or handed back. */
export const GATHERING_TASK_STATUS_PILL: Record<GatheringTaskStatus, string> = {
  open:      'bg-muted text-muted-foreground',
  submitted: 'bg-brand-legacy text-brand-on-legacy',
  approved:  'bg-brand-affirm text-brand-on-affirm',
  denied:    'bg-brand-withheld/10 text-brand-withheld',
}

/**
 * The same four states as bare TEXT, for where a pill is the wrong weight — a meta line under
 * a task label, the organizer's notes on `/gatherings/my-tasks`, a count in a progress line.
 *
 * It exists so that a screen wanting coloured text does not inline a colour, which is the one
 * failure this module is here to prevent. `ASSIGNMENT_STATUS_TEXT` in
 * `components/events/status.ts` is the precedent and carries the same trap in its own comment:
 * `submitted` CANNOT be the legacy token here, because bare gold on a pale ground is 2.30.
 * The text language uses `--brand-accent` where the pill language uses the gold surface — and
 * `--brand-accent` resolves to gold in dark mode against a near-black ground at 7.91, which is
 * the whole reason it is a foreground role and legacy is a surface role.
 */
export const GATHERING_TASK_STATUS_TEXT: Record<GatheringTaskStatus, string> = {
  open:      'text-muted-foreground',
  submitted: 'text-brand-accent',
  approved:  'text-brand-affirm',
  denied:    'text-brand-withheld',
}

/**
 * THE PREMIER MARKER. One decision, one constant, four call sites.
 *
 * ── WHY THIS IS HERE AND NOT AT THE CALL SITES ──────────────────────────────────────
 * It was written twice: `bg-brand-legacy` on `/gatherings` and `/gatherings/[id]`,
 * `bg-brand-warm` on `/admin/gatherings` and `/admin/gatherings/[id]` — each with a local
 * comment arguing for itself, which is what makes it a drift rather than a typo. Both
 * arguments were sound in isolation and that is precisely the failure AGENTS.md records three
 * times: the two "text on navy" tokens the rebrand collapsed, the required-field asterisk
 * repeated at forty call sites, the four treatments of red text. Styling copied by hand is
 * invisible until two screens are open side by side, and a marker that changes colour
 * depending on which screen you are on is not a marker.
 *
 * ── WARMTH, NOT GOLD, AND THE REASON IS `scheduled` ─────────────────────────────────
 * `bg-brand-legacy` is already the fill of the `scheduled` status pill and of `submitted`
 * above, and premier sits BESIDE a status pill on all four surfaces — it is a marker rather
 * than a status, so it never replaces one. Gold would therefore put two identically coloured
 * pills on the same row meaning different things, on every scheduled gathering in the product.
 * `--brand-warm`/`--brand-on-warm` is the fourth measured filled accent and exists for exactly
 * this: a fourth thing to say on a surface where the other three are spoken for. The admin
 * screens had already reached that conclusion; this is that conclusion applied everywhere.
 *
 * `--brand-accent`, the other Warmth role, is NOT an alternative: it resolves to Legacy gold in
 * dark mode, so it is a foreground only and a chip filled with it would be gold again in half
 * the themes.
 *
 * ── THE ONE REMAINING WARM NEIGHBOUR, STATED SO IT IS NOT A SURPRISE ────────────────
 * `/gatherings` also fills a "Happening now" chip with Warmth, so a premier gathering that is
 * running today shows two warm chips in one row. They are told apart by the star and the word,
 * which is the ordinary way two chips of one family are told apart (`DuesProjectionsClient`
 * renders adjacent warm chips already), and the alternative is worse: "Happening now" is a fact
 * DERIVED from today's date rather than a flag anybody set, so promoting it to its own accent
 * would give a transient timing note more visual authority than the marker an organizer chose.
 *
 * ── IT INCLUDES THE SHAPE, DELIBERATELY ─────────────────────────────────────────────
 * Composed with `GATHERING_PILL_SHAPE` and `inline-flex items-center gap-1` already in it, so a
 * call site is `<span className={GATHERING_PREMIER_PILL}><Star … /> Premier</span>` and there is
 * nothing left for one to get right on its own. The star and the word travel with it: the two
 * admin pills carried no icon while the two member pills did, which is the same drift one level
 * down — a marker that grows a star on two screens out of four is not a marker either.
 *
 * `cn` rather than a template string, and that is load-bearing rather than habit: the shape sets
 * `inline-block` and this needs `inline-flex` to centre the star against the word. Both classes
 * in one plain string would leave which of them wins to the order Tailwind happened to emit them
 * in; `cn`'s tailwind-merge resolves the conflict to the later one, which is this file's.
 */
export const GATHERING_PREMIER_PILL = cn(
  GATHERING_PILL_SHAPE,
  'inline-flex items-center gap-1 bg-brand-warm text-brand-on-warm',
)
