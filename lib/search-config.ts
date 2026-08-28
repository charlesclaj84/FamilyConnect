/**
 * The name of the Postgres text search configuration every full-text query must name.
 *
 * ── WHY THIS IS A CONSTANT AND NOT A STRING AT EACH CALL SITE ───────────────────────
 * There are three generated `search_vector` columns — `announcements`, `notifications` and
 * `bylaws` — and every query against one has to name the SAME configuration the column was
 * built with. Name a different one and two things go wrong at once, neither of them loudly:
 * the GIN index cannot be used, so the query table-scans; and the answers change, because
 * the query's tokens were produced by a different dictionary chain from the row's.
 *
 * It was the literal `'english'` in three places until 2026-08-27. That was correct and it
 * was correct three times, which is the shape a rename gets wrong once — the same argument
 * `lib/brand.ts` makes about the product name and `app/globals.css` about a colour.
 *
 * ── WHAT `genorra_search` IS ────────────────────────────────────────────────────────
 * `english` with `unaccent` routed in front of the stemmer, so `reunion` finds `Reunión` and
 * `réunion` finds `Reunion`. `20260827000000` creates it and argues the decision at length —
 * including why `'simple'` was the first plan and was rejected as strictly worse, and why a
 * per-row `spanish`/`french` dictionary is a feature rather than a correction.
 *
 * ── IT IS A DATABASE OBJECT NAME, NOT COPY ──────────────────────────────────────────
 * Nothing translates it and it appears on no screen. It lives here rather than in a
 * catalogue for that reason, and `lib/i18n/*` must not gain an entry for it.
 *
 * ── CHANGING IT IS A MIGRATION ──────────────────────────────────────────────────────
 * The three columns store this name in their generated expression and re-resolve it through
 * `search_path` at read time. Editing this constant alone would leave every query naming a
 * configuration the columns were not built with — which is the silent divergence above, and
 * is worse than a name that does not exist, because that at least errors.
 */
export const SEARCH_CONFIG = 'genorra_search'
