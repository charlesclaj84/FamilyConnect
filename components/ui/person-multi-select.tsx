'use client'

import { useId, useMemo, useState } from 'react'
import { X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'

/**
 * THE control for choosing several members of a family.
 *
 * WHAT IT IS FOR, and why it is shared rather than written where it is needed: a family
 * is not a handful of people. A hundred-member family is an ordinary one for this
 * product — that is the whole premise — and every list-of-members control has to still
 * work at that size. A bare column of checkboxes does not: at 120 names the thing you
 * came for is three screens down, and there is no way to reach it but scrolling.
 *
 * Four things make it survive a big family, and each is load-bearing:
 *
 *   1. **Search.** The only way to reach one name out of a hundred without scrolling.
 *      Matches first, last and nickname, case- and accent-insensitively.
 *
 *   2. **Selections stay visible as chips, above the search.** This is the one that is
 *      easy to leave out and is the actual bug at scale. Filter the list to "mar" and
 *      every previously ticked name that does not match VANISHES — so the only record
 *      of what you have chosen is off-screen, and the control quietly starts lying
 *      about its own state. The chips are the state; the list is a way to change it.
 *
 *   3. **An honest count, and an honest overflow.** "3 selected · 12 of 137 shown" —
 *      and when a filter still leaves more rows than RENDER_LIMIT, it says how many are
 *      not on screen rather than truncating in silence. A capped list that looks
 *      complete is worse than a long one.
 *
 *   4. **A scroll container with a fixed maximum height**, so the dialog's own buttons
 *      cannot be pushed off the bottom of a phone by the size of the family.
 *
 * WHY NOT `<select multiple>`. It needs ctrl-click to add a second name and silently
 * drops the whole selection on a plain click. On a field like "who is this gift hidden
 * from" that misclick un-hides a surprise, and nothing on screen would say so. It also
 * cannot be searched, cannot show chips, and renders differently on every platform.
 *
 * WHY IT DOES NOT CLAIM `role="combobox"`. That role promises a managed listbox:
 * arrow-key navigation, `aria-activedescendant`, Enter to commit, Escape to close — and
 * a screen reader changes its own key handling to match. None of that is implemented
 * here, so claiming it would strand exactly the users it is aimed at. What this is, is
 * what it says it is: a text input that filters, and a group of checkboxes. Tab and
 * Space work, which is true. Same reasoning as `MainRail` refusing `role="tablist"` and
 * `RowMenu` refusing `role="menu"`.
 */

/** The minimum a person needs for this control to name them unambiguously. */
export interface SelectablePerson {
  id: string
  first_name: string
  last_name: string
  nick_name?: string | null
  date_of_birth?: string | null
}

/**
 * How many matches are put in the DOM at once.
 *
 * Not a performance cliff so much as a usability one: past this many rows the list has
 * stopped being something you read and become something you scroll, and the answer is
 * to type another letter. The count line always says what is not shown — see rule 3
 * above and AGENTS.md on silent caps.
 */
const RENDER_LIMIT = 60

/** Case- and accent-insensitive, so "jose" finds "José" and "OConnor" finds "O'Connor". */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    // The combining-diacritic block NFD just split the accents into. Written as escapes
    // rather than as literal marks, which are invisible in an editor and get eaten by
    // the first tool that touches the file.
    .replace(/[\u0300-\u036f]/g, '')
    // Punctuation and spaces dropped entirely, so "oconnor" finds "O'Connor" and
    // "maryjane" finds "Mary Jane".
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase()
}

export function PersonMultiSelect({
  people,
  selected,
  onChange,
  label,
  hint,
  emptyMessage = 'No members to choose from yet.',
  disabled = false,
}: {
  people: SelectablePerson[]
  /** Selected people.ids. Order is not meaningful and is not preserved. */
  selected: string[]
  onChange: (next: string[]) => void
  label: string
  /** What choosing someone DOES. Shown under the label, before the control. */
  hint?: string
  emptyMessage?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  // useId, not a hand-rolled counter: two of these on one page would otherwise share
  // checkbox ids, and clicking a label in the second would toggle a box in the first.
  const fieldId = useId()
  const chosen = useMemo(() => new Set(selected), [selected])

  // Names are computed against the WHOLE roster, not the filtered subset, or two
  // Martha Allens would read as unambiguous the moment a search separated them — which
  // is precisely when telling them apart matters most.
  const named = useMemo(
    () => people.map(p => ({ person: p, name: disambiguatedName(p, people) })),
    [people],
  )

  const matches = useMemo(() => {
    const q = normalize(query)
    if (!q) return named
    return named.filter(({ person, name }) =>
      normalize(name).includes(q)
      || normalize(`${person.first_name}${person.last_name}`).includes(q)
      || normalize(person.nick_name ?? '').includes(q),
    )
  }, [named, query])

  const shown = matches.slice(0, RENDER_LIMIT)
  const hiddenByLimit = matches.length - shown.length

  // Resolved from `named` rather than from `matches`, which is the entire point of the
  // chips: a selected person the current filter excludes must still appear here.
  const selectedPeople = named.filter(({ person }) => chosen.has(person.id))

  function toggle(id: string) {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange([...next])
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${fieldId}-search`}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <>
          {/* The chips come FIRST, above the search, because they are the answer and
              the list below is only the way to change it. Putting them underneath a
              scrolling box would put the state off-screen at exactly the moment the
              box is full. */}
          {selectedPeople.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pb-0.5">
              {selectedPeople.map(({ person, name }) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    disabled={disabled}
                    // The whole chip is the remove control. A tiny × beside a name is a
                    // 12px target on the screen where a mis-tap is most expensive.
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-1',
                      'text-xs font-medium text-brand-on-soft',
                      'hover:bg-brand-primary hover:text-brand-on-primary',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    {name}
                    <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="sr-only">Remove {name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={`${fieldId}-search`}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={disabled}
              placeholder={`Search ${people.length} members…`}
              className="h-9 pl-8 text-sm"
            />
          </div>

          {matches.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
              No member matches “{query}”.
            </p>
          ) : (
            // role="group" and not "listbox": these are real checkboxes and a listbox
            // would promise key handling this does not implement. See the header.
            <div
              role="group"
              aria-label={label}
              className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border p-2"
            >
              {shown.map(({ person, name }) => {
                const boxId = `${fieldId}-${person.id}`
                return (
                  <label
                    key={person.id}
                    htmlFor={boxId}
                    className={cn(
                      'flex cursor-pointer select-none items-center gap-2 rounded px-1.5 py-1 text-sm',
                      'hover:bg-muted/60',
                      disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    <input
                      id={boxId}
                      type="checkbox"
                      checked={chosen.has(person.id)}
                      onChange={() => toggle(person.id)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span>{name}</span>
                  </label>
                )
              })}
            </div>
          )}

          {/* aria-live, so a screen-reader user typing in the search is told how many
              results they now have. Without it the filter is a silent change to a
              region they are not focused on. */}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {selected.length > 0 && (
              <span className="font-medium text-brand-on-soft">
                {selected.length} selected
              </span>
            )}
            {selected.length > 0 && ' · '}
            {matches.length === people.length
              ? `${people.length} member${people.length === 1 ? '' : 's'}`
              : `${matches.length} of ${people.length} shown`}
            {/* Never truncate quietly. A list that has stopped at 60 while looking
                complete is how somebody concludes a person is not in the family. */}
            {hiddenByLimit > 0 && ` · ${hiddenByLimit} more — keep typing to narrow`}
          </p>
        </>
      )}
    </div>
  )
}
