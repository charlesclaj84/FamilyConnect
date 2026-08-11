/**
 * Dark mode, in one place.
 *
 * The storage key and the boot script live together because they have to
 * agree exactly: the script runs before React exists and decides what the
 * first paint looks like, and `ThemeToggle` reads the same key to decide
 * what its own initial state is. Two copies of the string would drift and
 * the symptom — a toggle that shows "Light" on a dark page — would only
 * appear on a hard refresh.
 */

/** Where the preference is persisted. */
export const THEME_STORAGE_KEY = 'genorra-theme'

/** Light, dark, or "follow the OS". */
export type Theme = 'light' | 'dark' | 'system'

export const THEMES: readonly Theme[] = ['light', 'dark', 'system']

/**
 * What the app looks like to someone who has never touched the toggle.
 *
 * Light, NOT `system`. GENORRA's identity is burgundy on cream — that is the
 * brand board, the printed guide and the light app icon — so a member whose
 * laptop happens to be in dark mode should still meet the product the way it
 * was designed, rather than having the OS pick for them on first contact.
 *
 * `system` remains a choice, it is simply not the default. A stored preference
 * of any kind still wins on every load; this constant only decides what happens
 * when there is nothing stored.
 */
export const DEFAULT_THEME: Theme = 'light'

/**
 * Runs synchronously in `<head>`, before the browser paints anything.
 *
 * This is the technique from the Next guide "How to prevent flash before
 * hydration", with one deliberate departure: the guide sets `data-theme`,
 * and this toggles the `dark` CLASS instead. That is not a preference —
 * `globals.css` declares `@custom-variant dark (&:is(.dark *))`, and the
 * 45 `dark:` utilities already in the components resolve against that
 * class. Switching to `data-theme` would light up the CSS variables and
 * silently leave every one of those utilities dead.
 *
 * `useEffect` cannot do this job: it runs after paint, so the user sees a
 * white page flash to burgundy on every load. The script runs during HTML
 * parsing, before React is involved at all.
 *
 * Wrapped in try/catch because `localStorage` throws outright in Safari's
 * private mode and under some embedded webviews — a themed page is worth
 * less than a page that renders.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=s==="dark"||(s==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`
