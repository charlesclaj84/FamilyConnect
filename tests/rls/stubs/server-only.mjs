/**
 * `server-only`, which is not a package in this repo at all.
 *
 * ── WHY THERE IS NOTHING TO INSTALL ─────────────────────────────────────────────────
 * Next aliases the specifier in its own bundler config, so `import 'server-only'` compiles
 * without the package ever being on disk — `npm run build` proves that on every run. Bare Node
 * has no such alias, so the import is an unresolved module and every action that transitively
 * reaches `lib/email/strings` fails as a HARNESS ERROR rather than as a test result. Measured:
 * 83 of them, all five `processing.*` cases among them, the first time the email bundle existed.
 *
 * ── WHAT THIS COSTS, STATED RATHER THAN DISCOVERED ──────────────────────────────────
 * The real module is empty under React's `react-server` condition and throws everywhere else,
 * and the throwing half IS the gate that keeps email prose out of the browser bundle. Stubbing
 * it here removes that gate from the harness — deliberately, because this suite is about family
 * isolation and knows nothing about bundling.
 *
 * Two other things enforce it, which is why the trade is admissible: `npm run build` fails on a
 * client component importing the bundle, and `npm run i18n:check` reports it as CLIENT-BUNDLE
 * naming the file. Do not read a green RLS run as evidence about that boundary.
 */
export {}
