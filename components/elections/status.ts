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
