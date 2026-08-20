import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch space the Supabase CLI writes when the local stack starts —
    // generated Deno edge-runtime source, not ours. It is gitignored, but
    // ESLint does not read .gitignore, so without this it lints and reported
    // 186 problems: nearly three times the rest of the codebase combined,
    // which is enough noise to make `npm run lint` not worth reading.
    "supabase/.temp/**",
    // The vendor design kits under design/ are reference material, delivered as-is, and
    // NOT part of the build — nothing imports them, and since 2026-08-20 they are not under
    // `public/` either, so nothing is served out of them by construction rather than by
    // convention (see the design/ table in AGENTS.md). `design/home/` never tripped this
    // because it ships no TypeScript; the Dashboard Golden Master kit does, in
    // `06_REACT/`, and its five stub components turned the Lint step red the moment
    // they landed — one hard error for an unescaped apostrophe in a hardcoded
    // "Let's keep our family connected.", plus img-element warnings.
    //
    // Ignored rather than fixed, deliberately. Editing a handoff kit to satisfy our
    // lint rules destroys the one property that makes it useful as a reference: that
    // it is byte-for-byte what the designer delivered, and can be diffed against the
    // next drop. The real implementation lives in components/dashboard/.
    //
    // THE GLOB IS `design/**` AND NOT `design/*/**`: the kits are two levels deep now
    // (`design/<kit>/<version>/`), so the shallower pattern this replaced would have
    // stopped matching and quietly turned the Lint step red again.
    "design/**/*.{ts,tsx,js,jsx}",
  ]),
]);

export default eslintConfig;
