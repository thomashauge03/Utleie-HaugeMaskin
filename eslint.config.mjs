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
    // Worktreene fra Claude-øktene ligger her, med egne .next-bygg.
    // Uten denne linja lintes byggene deres, og `npm run lint` feiler.
    ".claude/**",
  ]),
]);

export default eslintConfig;
