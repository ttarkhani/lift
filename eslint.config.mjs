import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The public demo (/demo) shows invented data only. Its pages, components, and fixtures never
// open a database connection, call a service, read the env or the session, or call an /api
// route. Type-only imports are fine. src/demo/boundary.test.ts also checks what they import
// indirectly.
const demoBoundary = {
  files: ["src/demo/**", "src/app/demo/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/server", "@/server/**", "**/server/**", "!next/server"],
            allowTypeImports: true,
            message: "The demo can't use server code (database, services, env, session). Type-only imports are fine.",
          },
          {
            group: ["postgres", "@auth0/**", "next/headers"],
            message: "The demo can't open a database connection or read the session.",
          },
          {
            group: ["@/lib/api", "@/lib/usePoll", "**/board-list", "**/request-thread", "@/app/api/**"],
            allowTypeImports: true,
            message: "The demo can't call /api routes or poll. Use the fixtures in src/demo.",
          },
          {
            group: ["@/components/app-shell"],
            message: "app-shell loads the session. Import Page from @/components/page.",
          },
        ],
      },
    ],
    "no-restricted-globals": [
      "error",
      { name: "fetch", message: "The demo can't call /api routes. Use the fixtures in src/demo." },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  demoBoundary,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
