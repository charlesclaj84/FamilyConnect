'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CirclePlus, MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormError } from '@/components/ui/form-message'
import { GatheringStatusPill } from '@/components/gatherings/StatusPill'
import { GATHERING_PREMIER_PILL } from '@/components/gatherings/status'
import { formatDateRange, todayLocal } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import { scheduleGathering, type GatheringSummary } from '@/app/actions/gatherings'

/**
 * The Gatherings list, and the one dialog that starts a new one.
 *
 * ── WHAT IS CLIENT ABOUT THIS AND WHAT IS NOT ───────────────────────────────────────
 * The list is static markup over props and would render perfectly well on the server. It
 * lives here anyway because the dialog has to, and splitting a fourteen-line list away from
 * the button that adds to it would leave two files that have to agree about what a row looks
 * like. Nothing about the list is state: there is no local copy of `upcoming` or `past`, no
 * `useServerState` over either, and no optimistic row.
 *
 * ── WHY NO OPTIMISTIC ROW, WHICH IS THE HOUSE DEFAULT ───────────────────────────────
 * `scheduleGathering` does not just insert a gathering — it instantiates every step of every
 * template chosen into `gathering_tasks`, and the row on this screen carries `taskCounts` from
 * those. An optimistic row would have to invent that figure, and the only honest guess is
 * `0 of 0`, which is precisely the sentence `taskProgress` refuses to say (`complete` requires
 * `total > 0`, because a gathering with no work in it must never read as finished). So a
 * successful schedule NAVIGATES to the gathering it created — where the tasks it just
 * instantiated are the point — and falls back to `router.refresh()`, which re-runs the page's
 * own split and its own counts, if the id did not come back.
 *
 * A refresh MERGES the new server payload without discarding client state, which is why the
 * dialog is closed and its fields cleared explicitly rather than being left to unmount.
 *
 * ── `success: true` WITH A MESSAGE IS A THIRD OUTCOME, AND IT MUST NOT NAVIGATE ──────
 * There is no transaction across PostgREST, so `scheduleGathering` inserts the gathering and
 * then attaches the templates — and when one template's steps fail to land it returns
 * `{ success: true, gatheringId, message: 'Scheduled, but the steps from X could not be
 * added…' }`. Both halves of that are true: the row exists (so reporting a failure would be
 * false and the member would go looking for a gathering they were told did not happen), and
 * some of the work is missing (so reporting plain success would hand them a gathering that
 * reads as complete with half its tasks absent).
 *
 * That sentence is the ONLY record of what went wrong — nothing is logged for the member and
 * no screen derives it — so navigating away from it loses it, which is the same rule AGENTS.md
 * states for mail: a caller must not render success over something that did not go. So the
 * dialog stays open, the sentence is rendered through `FormError`, and opening the gathering
 * becomes a second, deliberate press. `NewGatheringDialog` in `AdminGatheringsClient` handles
 * the identical contract from `createGathering` the same way; the two must not diverge.
 *
 * ── THE DIALOG IS TEMPLATE-FIRST, AND A TEMPLATE IS NO LONGER REQUIRED ──────────────
 * This said "a gathering can only exist as an instance of one or more templates" until
 * 2026-08-19, and the form was built on it: the fieldset came first, above the title, and a
 * family with no template got a paragraph INSTEAD of the create button.
 *
 * Standard changed the boundary rather than the shape. `/pricing` sells "the gathering on a
 * shared calendar" on Free — a date, a place and the details — and sells the checklists, the
 * assigned duties and the budget a rung up, so `admin/gathering-templates` is `tier:
 * 'standard'` and a Free family HAS no templates to be offered. Requiring one would leave Free
 * selling a calendar nothing can be put on. `scheduleGathering` accepts an empty list now and
 * its header argues that at length.
 *
 * What survives is the ORDER: when there are templates the fieldset is still first, because
 * choosing one changes what the rest of the form is for, and finding that out after filling in
 * a title is the wrong way round.
 *
 * ── WHAT A FAMILY WITH NO TEMPLATE SEES NOW ─────────────────────────────────────────
 * The button, and a one-line note inside the dialog saying this will be a date with no tasks.
 * `templates` is empty for four different reasons — the plan does not include the library,
 * nobody has authored one, every one is `who_may_schedule = 'admin'` and this caller is not an
 * organizer, or every one is archived — and they are all the same answer to the member, so the
 * note does not try to distinguish them. It links to the library only when the caller both
 * holds the grant AND is on a plan that includes it, because a link that lands on `/upgrade` is
 * a worse offer than no link.
 */
export interface GatheringRow extends GatheringSummary {
  /**
   * `gatheringTiming(...) === 'today'`, resolved on the SERVER.
   *
   * It arrives as a prop rather than being computed here because computing it would read the
   * clock during render: once during SSR on the server's timezone and again in the browser on
   * the viewer's, which hydrates a gathering into the wrong half of the screen for a family
   * spread across a country.
   */
  happeningNow: boolean
}

interface Props {
  upcoming: GatheringRow[]
  past: GatheringRow[]
  /** `gatherings:create` at scope `'any'` — what `scheduleGathering` itself demands. */
  mayCreate: boolean
  /** Only the templates this caller may schedule FROM. Empty unless `mayCreate`. */
  templates: { id: string; name: string; description: string | null }[]
  /** Whether the "no templates" sentence may link to the library. */
  mayAuthorTemplates: boolean
}

export function GatheringsClient({ upcoming, past, mayCreate, templates, mayAuthorTemplates }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [location, setLocation] = useState('')
  const [startsOn, setStartsOn] = useState(todayLocal())
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState('')
  // Set when the gathering was created and something about it still needs saying — a template
  // whose steps could not be added. The row EXISTS, so navigating away silently would lose the
  // one sentence that says what is missing, and reporting a failure would be false. See the
  // header's third outcome.
  const [createdId, setCreatedId] = useState('')
  const [isPending, startTransition] = useTransition()

  // Re-seeded during render rather than in an effect: an effect runs after paint, so a dialog
  // reopened the next morning would flash yesterday's date for a frame. The initializers above
  // run ONCE — this component is never unmounted — so without this a tab left open overnight
  // would keep offering yesterday to every gathering scheduled the next day.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    setError('')
    setCreatedId('')
    if (open) {
      setChosen([])
      setTitle(''); setSummary(''); setLocation('')
      setStartsOn(todayLocal())
      // A CLOSING date defaults to empty, never to today. `ends_on` is NULL for a one-day
      // gathering, which is most of them, and pre-filling it would make every gathering a
      // one-day range that reads as a mistake somebody has to undo.
      setEndsOn('')
    }
  }

  function toggleTemplate(id: string) {
    setError('')
    setChosen(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  /**
   * Closing the dialog, from the X, from Escape and from Cancel — one function because the
   * partial-create path owes a refresh on every one of them.
   *
   * `scheduleGathering` already called `revalidatePath('/gatherings')`, which invalidates the
   * SERVER's cache and does nothing to a client that never asks again. So a member who reads
   * the partial-failure sentence and then dismisses the dialog would be looking at a list with
   * no row for the gathering that was just created — which is the same "told something false"
   * failure the sentence exists to prevent, arriving one press later.
   */
  function closeDialog() {
    setOpen(false)
    if (createdId) router.refresh()
  }

  function handleSchedule() {
    const name = title.trim()
    if (!name) { setError('Give the gathering a title'); return }
    if (!startsOn) { setError('Choose the day it starts'); return }
    if (endsOn && endsOn < startsOn) { setError('The last day cannot be before the first'); return }

    setError('')
    startTransition(async () => {
      const result = await scheduleGathering({
        title: name,
        summary: summary.trim() || undefined,
        location: location.trim() || undefined,
        startsOn,
        endsOn: endsOn || undefined,
        // Order matters: the tasks are instantiated template by template in the order they
        // were named, and `position` on the junction row is what preserves it.
        templateIds: chosen,
      })
      if (!result.success) {
        setError(result.message ?? 'Could not schedule the gathering')
        return
      }
      // `success: true` WITH a message means the gathering exists and one of its templates did
      // not attach. Both facts are true and both are said: the dialog stays open holding the
      // sentence, and the navigation moves behind its own button. Refreshing or pushing here
      // would unmount the only place that sentence is written down.
      if (result.message) {
        setError(result.message)
        if (result.gatheringId) setCreatedId(result.gatheringId)
        else router.refresh()
        return
      }
      setOpen(false)
      // Straight to the gathering that was just created, because the work is the point: the
      // same call instantiated a task per step and the next thing to do is hand them out. A
      // refresh is the fallback for the one case where the insert succeeded and the id did not
      // come back — the row is real either way and the list has to show it. Neither path is an
      // optimistic insert; see the header for why.
      if (result.gatheringId) router.push(`/gatherings/${result.gatheringId}`)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {/* THE TRIGGER NO LONGER DEPENDS ON THERE BEING A TEMPLATE, and until 2026-08-19 it
          did: a family with none got a paragraph here INSTEAD of the button, because a
          gathering could only exist as an instance of one. It can exist as a date now, which
          is what Free sells — so the button is offered to anybody who may schedule, and the
          templates, if there are any, are an optional fieldset inside the dialog. */}
      {mayCreate && (
        <div className="flex justify-end">
          {/* Affirm, never the default burgundy — that is what an active rail item looks
              like, and this is a create trigger. */}
          <Button variant="affirm" onClick={() => setOpen(true)}>
            <CirclePlus className="h-4 w-4 mr-1" /> Schedule a gathering
          </Button>
        </div>
      )}

      <Section
        heading="Coming up"
        rows={upcoming}
        empty="Nothing is planned yet."
      />
      <Section
        heading="Already held"
        rows={past}
        empty="Nothing has been held yet."
      />

      {/* The dialog is only MOUNTED for a caller who could open it. `open` can never be true
          otherwise — the trigger is the only thing that sets it — but markup nobody can reach
          is not worth keeping reachable. It no longer also requires a template: the fieldset
          that needed one is conditional now, inside. */}
      {mayCreate && (
      <Dialog
        open={open}
        onClose={closeDialog}
        title="Schedule a gathering"
        description="Say when and where. If there are templates, choose what it is built from."
        className="max-w-lg"
      >
        <div className="mt-2 space-y-3">
          {/* THE FIELDSET IS CONDITIONAL AND OPTIONAL, which are two separate changes made on
              2026-08-19 and both matter.

              CONDITIONAL, because `templates` is empty for a family whose plan does not include
              the library at all (`admin/gathering-templates` is `tier: 'standard'`), as well as
              for one where nobody has authored a template or where every one of them is marked
              `who_may_schedule = 'admin'`. An empty bordered box above the title, with a legend
              claiming the gathering is "built from" it, reads as a broken form.

              OPTIONAL, because a gathering may now be just a date — see `scheduleGathering`.
              The `RequiredMark` came off the legend with the guard in `handleSchedule`, and the
              two had to move together: a form that marks a group required and then submits
              without it teaches a member that the mark means nothing. */}
          {/* AND WHEN THERE ARE NONE, THE OFFER TO AUTHOR ONE SURVIVES. This sentence is what
              is left of the paragraph that used to stand in place of the trigger, and it is
              kept for the reason that paragraph existed: an organizer looking at a form with no
              template fieldset has no way to learn that templates are the thing that turns a
              date into assigned work. It links only when the caller can actually open the
              library — `mayAuthorTemplates` is resolved with `can`, and on the PLAN as well
              since the library is `tier: 'standard'`, so the link cannot land on `/upgrade` or
              a 404. */}
          {templates.length === 0 && mayAuthorTemplates && (
            <p className="rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              This will be a date on the family calendar with no tasks.{' '}
              <Link href="/admin/gathering-templates" className="font-medium underline">
                Author a template
              </Link>
              {' '}and a gathering can be built from it, with every step handed to a relative.
            </p>
          )}

          {templates.length > 0 && (
          <fieldset className="space-y-1.5">
            {/* A `<fieldset>`/`<legend>` rather than a `Label`, because this group is several
                checkboxes and a `<label>` may name only one control. There is no
                `RequiredMark` on it any more — a template is optional since 2026-08-19 — but
                the reason for the `<fieldset>` is about NAMING the group and is unchanged: a
                bare `<Label>` with no `htmlFor` and no nested input labels nothing at all. */}
            <legend className="text-sm font-medium">Built from</legend>
            <div className="space-y-2 rounded-xl border p-3">
              {templates.map(template => (
                <label key={template.id} className="flex cursor-pointer items-start gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={chosen.includes(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{template.name}</span>
                    {template.description && (
                      <span className="block text-xs text-muted-foreground">{template.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Every step of every template you choose becomes a task on this gathering, ready to
              hand out. Choose none and this is a date on the family calendar with no tasks —
              an organizer can build it out later.
            </p>
          </fieldset>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gathering-title" required>Title</Label>
            <Input
              id="gathering-title"
              value={title}
              placeholder="e.g. Allen Family Reunion 2027"
              onChange={e => { setTitle(e.target.value); setError('') }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gathering-starts" required>First day</Label>
              <Input
                id="gathering-starts"
                type="date"
                value={startsOn}
                onChange={e => { setStartsOn(e.target.value); setError('') }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gathering-ends">Last day</Label>
              <Input
                id="gathering-ends"
                type="date"
                value={endsOn}
                onChange={e => { setEndsOn(e.target.value); setError('') }}
              />
              <p className="text-xs text-muted-foreground">Leave empty for one day.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gathering-location">Where</Label>
            <Input
              id="gathering-location"
              value={location}
              placeholder="e.g. Memorial Park, Houston"
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gathering-summary">What it is</Label>
            <Textarea
              id="gathering-summary"
              autoGrow
              rows={1}
              value={summary}
              placeholder="Optional — a sentence for the family"
              onChange={e => setSummary(e.target.value)}
            />
          </div>

          {/* One per form, beside the button that caused it. Renders nothing for an empty
              message, so there is no `{error && …}` guard. */}
          <FormError message={error} />

          <div className="flex gap-2 pt-1">
            {/* THE SECOND, DELIBERATE PRESS. Once `createdId` is set the gathering is real and
                the message above is the only account of what is missing from it, so the button
                stops being "schedule" and becomes the way out — read the sentence, then go. Not
                `affirm`: nothing is being created any more. */}
            {createdId ? (
              <Button className="flex-1" onClick={() => { setOpen(false); router.push(`/gatherings/${createdId}`) }}>
                Open the gathering
              </Button>
            ) : (
              <Button className="flex-1" variant="affirm" onClick={handleSchedule} disabled={isPending}>
                {isPending ? 'Scheduling…' : 'Schedule gathering'}
              </Button>
            )}
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
      )}
    </div>
  )
}

/** One half of the screen — the heading, its rows, and what stands in for them when there are
 *  none. A sentence in a bordered well, never an empty list: an empty container reads as
 *  something that failed to load. */
function Section({ heading, rows, empty }: {
  heading: string
  rows: GatheringRow[]
  empty: string
}) {
  return (
    <section className="space-y-3">
      {/* No colour class: the base layer paints h2 `--brand-ink`, and this sits on the page's
          own ground rather than on a coloured band. */}
      <h2 className="text-lg">{heading}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => <GatheringCard key={row.id} row={row} />)}
        </div>
      )}
    </section>
  )
}

/**
 * One gathering, as a card that is itself a link.
 *
 * NOTHING INSIDE IS AN ANCHOR. `<a>` inside `<a>` is invalid HTML that browsers silently
 * unnest, so the status pill, the premier marker and the progress line are all spans — the
 * whole card is the target, which is also the bigger tap area on a phone.
 *
 * The link sets an explicit text colour on the card, because `globals.css` carries an unscoped
 * `a { color: var(--brand-accent) }` in its base layer and without it every word in here comes
 * out terracotta (gold, in dark mode).
 */
function GatheringCard({ row }: { row: GatheringRow }) {
  const dates = formatDateRange(row.startsOn, row.endsOn)
  const { total, approved } = row.taskCounts

  return (
    <Link
      href={`/gatherings/${row.id}`}
      className="group block rounded-2xl border bg-card p-4 text-card-foreground transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold group-hover:underline">{row.title}</p>
          {row.summary && (
            <p className="mt-1 text-sm text-muted-foreground">{row.summary}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* PREMIER IS A MARKER, NOT A STATUS. Several gatherings may carry the flag —
              there is deliberately no uniqueness on it, so last year's reunion cannot block
              this year's — and the Dashboard band shows the soonest one. Which is why it sits
              BESIDE the status pill and never instead of it, and why the colour is not a choice
              this file gets to make: see `GATHERING_PREMIER_PILL`, which is Warmth precisely
              because gold is already what a `scheduled` pill fills with. */}
          {row.isPremier && (
            <span className={GATHERING_PREMIER_PILL}>
              <Star className="h-3 w-3" aria-hidden="true" /> Premier
            </span>
          )}
          {row.happeningNow && (
            <span className="whitespace-nowrap rounded-full bg-brand-warm px-2 py-0.5 text-xs font-medium text-brand-on-warm">
              Happening now
            </span>
          )}
          <GatheringStatusPill status={row.status} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {dates && (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3" aria-hidden="true" /> {dates}
          </span>
        )}
        {row.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" aria-hidden="true" /> {row.location}
          </span>
        )}
        {/* THE PROGRESS LINE IS NOT A BAR. `taskProgress` reports five figures and the one an
            organizer acts on is how many are still not approved; a bar shows a ratio and
            hides the count. "No tasks yet" is its own sentence rather than "0 of 0", which
            `taskProgress` refuses to call complete for exactly this reason. */}
        <span className={cn(
          'flex items-center gap-1.5',
          row.taskCounts.complete && 'text-brand-affirm',
        )}>
          {total === 0
            ? 'No tasks yet'
            : row.taskCounts.complete
              ? `All ${total} ${total === 1 ? 'task' : 'tasks'} approved`
              : `${approved} of ${total} tasks approved`}
        </span>
      </div>
    </Link>
  )
}
