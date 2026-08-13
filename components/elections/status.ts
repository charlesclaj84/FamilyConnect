import type { Election } from '@/app/actions/elections'

/**
 * The election status badge. Consumed by the member list (`app/(protected)/elections/page.tsx`)
 * and the admin list (`components/admin/AdminElectionsClient.tsx`), which print the same badge
 * for the same four states and until now held two byte-identical copies of this table.
 *
 * Colour here encodes whether anything is HAPPENING, not which state this is — the badge
 * already prints the word. Draft and closed are both "nothing you can do", so both are muted;
 * the brand surfaces are spent on the two windows a member can actually act in.
 */
export const ELECTION_STATUS_PILL: Record<Election['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  nominations: 'bg-brand-legacy text-brand-on-legacy',
  voting: 'bg-brand-affirm text-brand-on-affirm',
  closed: 'bg-muted text-muted-foreground',
}

/**
 * The two date-window panels — nominations and voting — as a tinted well and a label.
 *
 * Here for the same reason the badge above is: two screens draw these, and they had drifted
 * to three different value sets between them before the sweep. Reading the election detail
 * page (`app/(protected)/elections/[id]/page.tsx`) and the admin form
 * (`components/admin/AdminElectionsClient.tsx`) side by side is how a member checks that
 * the dates an administrator typed are the dates they will see, so the two must not be able
 * to look like different things.
 *
 * The pairing matches the badge deliberately: nominations is gold, voting is olive, on both
 * surfaces. A member who has learnt what the badge colour means has learnt the panel too.
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
