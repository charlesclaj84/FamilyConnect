import type { ElectionPhase } from '@/lib/election-phase'

/**
 * The election phase badge. Consumed by the member list (`app/(protected)/review/elections`),
 * the detail page and the organizer's screen (`components/admin/AdminElectionsClient.tsx`),
 * which print the same badge for the same phase and until this table existed held two
 * byte-identical copies of it.
 *
 * ── COLOUR ENCODES WHETHER ANYTHING IS HAPPENING, not which phase this is ──────────
 * The badge already prints the word. Four of the six phases are "nothing you can do" — a
 * draft, one that has not opened, one between its windows, and one that is over — so all four
 * are muted, and the two brand surfaces are spent on the windows a member can actually act in.
 *
 * THAT RULE IS WHY SIX PHASES NEED ONLY THREE TREATMENTS, and it is the rule to keep when a
 * seventh arrives. It survived the phases going from four to six on 2026-08-21: `scheduled`
 * and `between` are new — the dates run the election now, so "not yet" and "nominations have
 * closed" are states a member sees rather than moments an administrator passed through — and
 * neither is a thing to do, so neither earns a colour.
 *
 * `--brand-withheld` is deliberately NOT used for `between` or `closed`, tempting though it
 * looks. That token is for a CAPABILITY BEING WITHHELD — the pages a family stops being able
 * to open when it downgrades — and a nomination window that has closed on schedule is not
 * something taken away from anybody. It is the calendar working.
 */
export const ELECTION_PHASE_PILL: Record<ElectionPhase, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-muted text-muted-foreground',
  nominations: 'bg-brand-legacy text-brand-on-legacy',
  between: 'bg-muted text-muted-foreground',
  voting: 'bg-brand-affirm text-brand-on-affirm',
  closed: 'bg-muted text-muted-foreground',
}

/**
 * The two date-window panels — nominations and voting — as a tinted well and a label.
 *
 * Here for the same reason the badge above is: three screens draw these, and they had drifted
 * to three different value sets between them before the sweep. Reading the election detail
 * page and the organizer's form side by side is how a member checks that the dates an
 * organizer typed are the dates they will see, so the two must not be able to look like
 * different things.
 *
 * The pairing matches the badge deliberately: nominations is gold, voting is olive, on every
 * surface. A member who has learnt what the badge colour means has learnt the panel too.
 *
 * `/10` tints rather than the filled pairs, because these are large wells behind ordinary
 * body text rather than badges — a filled `bg-brand-legacy` panel would make the dates on
 * it the loudest thing on the page. The labels take the foreground role that survives a
 * pale ground: `--brand-accent` for gold's half (gold itself is 2.30 on cream and may
 * never carry text there), `--brand-affirm` for olive's, which reads at 4.81.
 */
export const ELECTION_WINDOW = {
  nominations: { well: 'bg-brand-legacy/10', label: 'text-brand-accent' },
  voting: { well: 'bg-brand-affirm/10', label: 'text-brand-affirm' },
} as const
