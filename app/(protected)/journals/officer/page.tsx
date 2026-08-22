import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireView } from '@/lib/auth/permissions'
import { getJournalAttendeeOptions, getJournalEntries, getMyOffices } from '@/app/actions/journal'
import { JournalClient } from '@/components/journal/JournalClient'
import { PageShell } from '@/components/layout/PageShell'

export const metadata = { title: 'Officer' }

/**
 * Journals > Officer: an office's notebook, read and written by whoever holds it.
 *
 * ── IT WAS `/journals` UNTIL 2026-08-22 ────────────────────────────
 * The rail read "Journals > Journals" — a section of one whose item wore the section's own
 * word, which says nothing twice. The item is named for whose notebook it is now, and
 * AGENTS.md's route rule takes it from there: the caption is the route and the route is the
 * key, so this moved to `app/(protected)/journals/officer/` and `20260822000017` moved
 * `journals` to `journals/officer`, carrying every family's grant. `lib/features.ts` carries
 * the argument.
 *
 * ── THE RAIL ROW IS UNCONDITIONAL, AND THAT IS THE DOCUMENTED RULE ─────────────────
 * The ask was "available to any member holding a position", and there are two ways to read
 * that: hide the rail row from everybody else, or open the screen to everybody and let it be
 * honest about having nothing in it. This takes the second, and the reason is written down in
 * `components/layout/Sidebar.tsx`:
 *
 *     "`/gatherings` has a real empty state, and a row that is sometimes there is worse than
 *      a row that is sometimes empty."
 *
 * That comment records the deletion of `hasAssignments`, a prop that existed to hide a rail
 * row until a member had work — and there is a second, sharper reason here. The shell is built
 * ONCE and does not re-render on a client-side navigation (AGENTS.md, "The shell is built
 * once"); `ShellWatcher` notices a changed PERMISSION grid, and holding an office is a
 * `user_roles` row, which its fingerprint does not include. So a row conditional on office
 * would appear for a newly appointed officer only after a full reload, and nothing in the
 * product would know to prompt one.
 *
 * The substance of the ask is delivered where it belongs: the DATA. Eleven policies across
 * the three journal tables test who holds the office, so a member with no office reads nothing
 * and writes nothing whatever their template says — and this page renders a sentence
 * explaining that rather than an error.
 *
 * ── `requireView('journals/officer')` IS THE GATE AND GATES ONLY THE SCREEN ────────
 * `journals/officer:view` defaults to 'everyone', so what it is FOR is letting a family switch
 * Journals off entirely. It decides nothing about which entries anybody reads — no policy on
 * the table evaluates `auth_permission` at all, and `20260821000005` asserts that absence in
 * both directions so a later policy sweep cannot quietly make the key a row filter.
 *
 * ── THE FIRST OFFICE'S ENTRIES ARE FETCHED HERE, AND ONLY THE FIRST ────────────────
 * §5. A member may hold several offices and the client refetches on a switch, because an
 * officeholder's journal is the sharpest personal data in the product — shipping every
 * office's notes into the RSC payload so a rail can hide four of them is exactly what "gate
 * the fetch, not the button" forbids.
 */
export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'journals/officer')

  const offices = await getMyOffices()
  // NOT FETCHED AT ALL for a member with no office. Both actions would answer `[]` on their
  // own — the policies refuse, and `getJournalAttendeeOptions` checks the same thing itself —
  // but this is the difference between "not asked" and "asked and refused", which is the
  // distinction §5 is about even where the answer is the same.
  //
  // THE ROSTER IS THE SHARPER HALF. It is the whole family's names, fetched only so a meeting
  // can record who was in the room, and props are serialized into the RSC payload whether a
  // component renders them or not — so for a member holding no office it must never be asked
  // for at all.
  const [entries, attendeeOptions] = offices.length
    ? await Promise.all([
      getJournalEntries(offices[0].role_id),
      getJournalAttendeeOptions(),
    ])
    : [[], []]

  return (
    <PageShell className="space-y-8">
      {/* THE HEADING IS THE RAIL CAPTION, which is the convention every other page here
          follows (AGENTS.md, "Captions come from the screen"): "Members", "Membership", "Dues
          & Donations" are each their own rail word. The section heading above it in the rail
          supplies the rest, and the lede says what an officer's journal IS. */}
      <div>
        <h1 className="mb-1 text-3xl font-bold">Officer</h1>
        <p className="text-muted-foreground">
          A journal for each office you hold. Notes stay with the office — whoever holds it
          next will read them.
        </p>
      </div>

      {offices.length === 0 ? (
        // A REAL EMPTY STATE, which is what the unconditional rail row buys — see the header.
        // It says what the screen is FOR and where offices come from, rather than reporting a
        // refusal: nothing has gone wrong for a member who holds no office.
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <BookText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            An officer&rsquo;s journal is for members who hold an office, and you do not hold
            one yet.
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
            Every office in the family has a notebook of its own — what a treasurer worked out
            about the bank, what an events chair learned about the hall. It belongs to the
            office rather than to the person, so it is still there for whoever comes next.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Offices are recorded under{' '}
            <Link href="/admin/members/board-positions" className="underline underline-offset-4">
              Members &amp; Access &rsaquo; Board Positions
            </Link>
            .
          </p>
        </div>
      ) : (
        <JournalClient
          offices={offices}
          initialOffice={offices[0].role_id}
          initialEntries={entries}
          attendeeOptions={attendeeOptions}
        />
      )}
    </PageShell>
  )
}
