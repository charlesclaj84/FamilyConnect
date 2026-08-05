'use client'

import { useState } from 'react'

/**
 * Client state seeded from a server prop that ADOPTS the prop whenever the server
 * sends a new value.
 *
 * Why this exists: `useState(serverValue)` reads its argument only on mount. Lists on
 * this site are held in client state so edits can be applied optimistically, and a
 * plain initializer makes that state permanently deaf to the server — every later
 * render (from a Server Action's `revalidatePath`, from `router.refresh()`, or from a
 * sibling component refreshing the route) arrives as a new prop that state ignores.
 * The symptom is a row you just created not appearing until the component remounts,
 * i.e. until you navigate away from the page and back.
 *
 * Note that `router.refresh()` cannot fix this on its own: it deliberately merges the
 * new server payload *without* discarding client state, so a frozen initializer stays
 * frozen through a refresh.
 *
 * The adoption happens during render rather than in an effect. An effect runs after
 * paint, so it would show one frame of stale data, and it is what
 * `react-hooks/set-state-in-effect` warns about; comparing against the previous server
 * value is the pattern React documents for resetting state when a prop changes.
 *
 * Local `setValue` calls survive until the next server value arrives, so optimistic
 * updates still work — the server just gets the last word.
 *
 * That last part is what makes it safe to BOTH append a created row locally and let a
 * `revalidatePath` refresh land: adoption replaces the whole value rather than merging
 * into it, so the row cannot end up in the list twice however the two interleave.
 */
export function useServerState<T>(serverValue: T) {
  const [value, setValue] = useState(serverValue)
  const [prevServerValue, setPrevServerValue] = useState(serverValue)

  // Compared by identity: a server render produces fresh arrays/objects, so this is
  // true exactly when new server data has arrived.
  if (prevServerValue !== serverValue) {
    setPrevServerValue(serverValue)
    setValue(serverValue)
  }

  return [value, setValue] as const
}
