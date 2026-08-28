'use client'

import { useId, useMemo, useState } from 'react'
import { Search, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { disambiguatedName } from '@/lib/name-utils'
import { matchesPersonQuery } from '@/lib/person-search'
import type { SelectablePerson } from '@/components/ui/person-multi-select'
import { useT } from '@/components/layout/LocaleProvider'

/**
 * THE control for choosing ONE member of a family. The single-select counterpart to
 * `PersonMultiSelect`, and it exists for the same reason that one does.
 *
 * ── WHY NOT A NATIVE `<select>` ─────────────────────────────────────────────────────
 * AGENTS.md says a single-select over members is "the one case where the platform helps",
 * because a native `<select>` has OS-level type-ahead — and that is true where the list is
 * a field on a form. It stops being true here. This control appears inside a DIALOG on a
 * canvas, where the question is "which of a hundred and forty relatives is this person's
 * mother", and native type-ahead only matches from the START of an option: typing "allen"
 * finds nobody in a list of "Martha Allen". Searching any part of any name is the whole
 * job of this control.
 *
 * So it is a filter box over a bounded, scrolling list of radio buttons — the same shape
 * as `PersonMultiSelect` with the chips removed, because a single selection has nowhere to
 * hide: the chosen row is stated above the box whether or not the filter includes it,
 * which is the rule those chips exist to enforce.
 *
 * ── THE FOUR THINGS IT SHARES WITH THE MULTI-SELECT ─────────────────────────────────
 *   1. Search matching first, last and nickname, accent- and punctuation-insensitively —
 *      through `lib/person-search.ts`, the SAME module, so the two cannot drift the way
 *      the Directory and the photo tagger did.
 *   2. The current selection stays visible above the search, for the reason above.
 *   3. An honest count and an honest overflow. A list that stops at 60 while looking
 *      complete is how somebody concludes a relative is not in the family.
 *   4. A bounded height with its own scroll, so a family's size cannot push a dialog's
 *      Save button off the bottom of a phone.
 *
 * Names come from `disambiguatedName` computed against the WHOLE roster, never the
 * filtered subset — two Martha Allens are likelier in a large family, not less, and
 * scoring against the filtered list would make them read as unambiguous at exactly the
 * moment a search had separated them.
 *
 * IT DOES NOT CLAIM `role="listbox"` OR `role="combobox"`, for the reason
 * `PersonMultiSelect` refuses the latter and `MainRail` refuses `role="tablist"`: those
 * roles promise arrow-key roving focus and `aria-activedescendant`, a screen reader
 * changes its key handling to match, and none of it is implemented. What this is, is a
 * text input and a group of real radio buttons — which Tab and arrow keys already handle,
 * because a radio group is one roving-focus widget the platform gives you for free.
 */

const RENDER_LIMIT = 60

export function PersonPicker({
  people, value, onChange, label, hint, emptyMessage = 'Nobody else in the family yet.',
}: {
  people: SelectablePerson[]
  /** The chosen people.id, or '' for none. */
  value: string
  onChange: (next: string) => void
  label: string
  hint?: string
  emptyMessage?: string
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  // useId, not a hand-rolled counter: two pickers on one page would otherwise share a
  // radio NAME, and choosing in the second would clear the first.
  const fieldId = useId()

  const named = useMemo(
    () => people.map(p => ({ person: p, name: disambiguatedName(p, people) })),
    [people],
  )

  const matches = useMemo(
    () => named.filter(({ person, name }) => matchesPersonQuery(person, name, query)),
    [named, query],
  )

  const shown = matches.slice(0, RENDER_LIMIT)
  const hiddenByLimit = matches.length - shown.length
  // Resolved from `named`, not `matches` — the point of showing it above the box is that
  // a selection the current filter excludes is still visible.
  const chosen = named.find(({ person }) => person.id === value)

  if (people.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${fieldId}-search`}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <p className="text-xs text-muted-foreground">
        {chosen
          ? <>{t('ui.chosen')}<span className="font-medium text-foreground">{chosen.name}</span></>
          : 'Nobody chosen yet.'}
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={`${fieldId}-search`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('ui.searchName')}
          className="pl-8"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        className="max-h-56 overflow-y-auto rounded-lg border"
      >
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">{t('ui.nobodyMatches')}</p>
        ) : (
          <ul>
            {shown.map(({ person, name }) => {
              const active = person.id === value
              return (
                <li key={person.id} className="border-b border-border/60 last:border-0">
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                      active ? 'bg-brand-soft text-brand-on-soft' : 'hover:bg-muted/60',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-person`}
                      className="sr-only"
                      checked={active}
                      onChange={() => onChange(person.id)}
                    />
                    {/* Rendered on both branches so choosing changes a colour and never a
                        size — same reasoning as the sidebar's active pill. */}
                    <Check
                      className={cn('h-3.5 w-3.5 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* NEVER TRUNCATE QUIETLY. A capped list that looks complete is how somebody
          concludes a relative is not in the family — same rule as PersonMultiSelect and
          as the migration verify blocks: a skip must be visible. */}
      <p className="text-xs text-muted-foreground">
        {shown.length} of {people.length} shown
        {hiddenByLimit > 0 && <> · {hiddenByLimit} more match — keep typing</>}
      </p>
    </div>
  )
}
