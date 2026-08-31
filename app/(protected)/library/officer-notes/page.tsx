import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookText } from 'lucide-react'
import { requireView } from '@/lib/auth/permissions'
import { resolveZone } from '@/lib/auth/zone'
import { getJournalEntries, getMyOffices } from '@/app/actions/journal'
import { OfficerNotesClient } from '@/components/library/OfficerNotesClient'
import { HelpLink } from '@/components/help/HelpLink'
import { PageShell } from '@/components/layout/PageShell'
import { callerI18n } from '@/lib/i18n/server'
import { currentUser } from '@/lib/auth/current-user'
import { docTitle } from '@/lib/i18n/page-metadata'

export async function generateMetadata() {
  return docTitle('page./library/officer-notes.title')
}

/**
 * Library > Officer Notes: an office's notebook, read and written by whoever holds it.
 *
 * ── THE ROUTE HAS MOVED THREE TIMES IN THREE DAYS ────────────────────
 * `/journal` → `/journals` → `/journals/officer` → `/library/officer-notes`. Each
 * move is one rule being obeyed rather than four opinions: the caption is the route and the
 * route is the key (§1).
 *
 * The section was renamed **Library** on 2026-08-22 because it had stopped holding only
 * journals — Meeting Minutes, Bylaws and Documents sit beside this now, and a heading that
 * names one of its four children tells a reader the other three are somewhere else. The item
 * was renamed **Officer Notes** in the same commit, because "Officer" alone leaned entirely on
 * the word above it and under any other section reads as a list of officers, which is what
 * `/admin/members/board-positions` is. `20260822000021` carried every family's grant across.
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
 * ── `requireView('library/officer-notes')` IS THE GATE AND GATES ONLY THE SCREEN ────────
 * `library/officer-notes:view` defaults to 'everyone', so what it is FOR is letting a family switch
 * this screen off entirely. It decides nothing about which entries anybody reads — no policy on
 * the table evaluates `auth_permission` at all, and `20260821000005` asserts that absence in
 * both directions so a later policy sweep cannot quietly make the key a row filter.
 *
 * ── THE FIRST OFFICE'S ENTRIES ARE FETCHED HERE, AND ONLY THE FIRST ────────────
 * §5. A member may hold several offices and the client refetches on a switch, because an
 * officeholder's journal is the sharpest personal data in the product — shipping every
 * office's notes into the RSC payload so a rail can hide four of them is exactly what "gate the
 * fetch, not the button" forbids.
 */
export default async function JournalPage() {
  const { user } = await currentUser()
  if (!user) redirect('/login')

  await requireView(user.id, 'library/officer-notes')

  const { t } = await callerI18n(user.id)

  const offices = await getMyOffices()
  // NOT FETCHED AT ALL for a member with no office. The action would answer `[]` on its own —
  // the policies refuse — but this is the difference between "not asked" and "asked and
  // refused", which is the distinction §5 is about even where the answer is the same.
  //
  // THE ROSTER USED TO BE FETCHED HERE TOO, for a meeting's attendee picker, and it was the
  // sharper half: the whole family's names, in the RSC payload, for a control most officers
  // never opened. The meeting half left for `/library/meeting-minutes` on 2026-08-22 and the
  // roster went with it, which means this page now reads nothing but the caller's own offices
  // and one office's notes.
  const entries = offices.length ? await getJournalEntries(offices[0].role_id) : []
  // Every timestamp on a note is an instant, so it is read in the member's own zone.
  const zone = await resolveZone(user.id)

  return (
    <PageShell className="space-y-8">
      {/* THE HEADING IS THE RAIL CAPTION, which is the convention every other page here
          follows (AGENTS.md, "Captions come from the screen"): "Members", "Membership", "Dues
          & Donations" are each their own rail word. The section heading above it in the rail
          supplies the rest.

          ── THE LEDE WENT ON 2026-08-25 AND LEFT A LINK BEHIND ──────────────────────────
          It read "A journal for each office you hold. Notes stay with the office — whoever
          holds it next will read them." The first sentence restated the heading; the second
          is the single most surprising rule in this screen, and it is not furniture — a
          notebook that a successor inherits is the whole feature, and nothing on the page
          shows it, because it is a fact about a handover that has not happened yet.

          So the sentence moved rather than being deleted. It is stated twice in `journal` —
          once in "What this screen is" and once in "Who can read it" — and this is the link
          to it. A `HelpLink` rather than a paragraph because the rule is read ONCE, by
          somebody who has just been given an office, and then never needed again; a caption
          every officeholder scrolls past on every visit is what the sweep was removing.

          THE EMPTY STATE BELOW ALREADY SAYS IT IN FULL, for the opposite reader — somebody
          with no office at all, who has no notebook to look at and needs to be told what the
          screen would be for. That branch is untouched. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t('page./library/officer-notes.title')}</h1>
        {offices.length > 0 && (
          <HelpLink
            variant="inline"
            slug="journal"
            section="what-it-is"
            label={t('lib.whyNotesStayHelp')}
          />
        )}
      </div>

      {offices.length === 0 ? (
        // A REAL EMPTY STATE, which is what the unconditional rail row buys — see the header.
        // It says what the screen is FOR and where offices come from, rather than reporting a
        // refusal: nothing has gone wrong for a member who holds no office.
        <div className="rounded-xl border bg-card px-4 py-12 text-center">
          <BookText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('lib.officerSJournalMembers')}</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{t('lib.everyOfficeFamilyNotebook')}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('lib.officesRecordedUnder')}{' '}
            <Link href="/admin/members/board-positions" className="underline underline-offset-4">{t('lib.membersAccessBoardPositions')}</Link>
            .
          </p>
        </div>
      ) : (
        <OfficerNotesClient
          offices={offices}
          initialOffice={offices[0].role_id}
          initialEntries={entries}
          zone={zone}
        />
      )}
    </PageShell>
  )
}
