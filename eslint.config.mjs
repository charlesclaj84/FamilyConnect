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
  ]),
]);

export default eslintConfig;
