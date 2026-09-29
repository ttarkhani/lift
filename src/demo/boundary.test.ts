import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

// The public demo must never reach real data. ESLint's no-restricted-imports rule (see
// eslint.config.mjs) stops direct imports; this also follows what those imports import in turn.

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const DEMO_DIRS = [path.join(SRC, "demo"), path.join(SRC, "app", "demo")];

/** Code the demo may not load at runtime, however indirectly. */
const FORBIDDEN_FILES = [
  path.join(SRC, "server") + path.sep,
  path.join(SRC, "lib", "api.ts"),
  path.join(SRC, "lib", "usePoll.ts"),
];
const FORBIDDEN_PACKAGES = ["postgres", "@auth0/", "next/headers"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

/** The module specifiers a file loads at runtime: type-only imports and exports are skipped. */
function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const bindings = clause?.namedBindings;
      const onlyTypes =
        clause &&
        !clause.name &&
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((element) => element.isTypeOnly);
      if (onlyTypes) continue;
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
      specifiers.push((statement.moduleSpecifier as ts.StringLiteral).text);
    }
  }
  return specifiers;
}

/** A file path for "@/…" and relative specifiers, or null for a package. */
function resolve(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Can't resolve ${specifier} from ${path.relative(ROOT, from)}.`);
}

/** Everything the entry files load at runtime that they shouldn't, as "chain → forbidden" lines. */
function forbiddenReach(entries: string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const queue = entries.map((file) => ({ file, chain: [path.relative(ROOT, file)] }));
  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of runtimeImports(file)) {
      const resolved = resolve(specifier, file);
      if (resolved === null) {
        if (FORBIDDEN_PACKAGES.some((name) => specifier === name || specifier.startsWith(name))) {
          problems.push(`${chain.join(" → ")} → ${specifier}`);
        }
        continue;
      }
      const next = [...chain, path.relative(ROOT, resolved)];
      if (FORBIDDEN_FILES.some((forbidden) => resolved === forbidden || resolved.startsWith(forbidden))) {
        problems.push(next.join(" → "));
        continue;
      }
      queue.push({ file: resolved, chain: next });
    }
  }
  return problems;
}

describe("the demo's import boundary", () => {
  it("keeps every demo file away from server code, /api helpers, and the session, however indirectly", () => {
    const entries = DEMO_DIRS.flatMap(sourceFiles);
    expect(entries.length).toBeGreaterThan(5);
    expect(forbiddenReach(entries)).toEqual([]);
  });

  describe("the indirect check", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lifts-demo-boundary-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it("catches server code reached through another module", () => {
      const file = path.join(dir, "page.tsx");
      writeFileSync(file, 'import { AppShell } from "@/components/app-shell";\nexport default AppShell;\n');
      expect(forbiddenReach([file]).join("\n")).toMatch(/src\/server\/auth\/guards\.ts/);
    });

    it("ignores type-only imports", () => {
      const file = path.join(dir, "types.ts");
      writeFileSync(
        file,
        'import type { Viewer } from "@/server/auth/viewer";\nimport { type Tx } from "@/server/db/client";\nexport type T = [Viewer, Tx];\n',
      );
      expect(forbiddenReach([file])).toEqual([]);
    });
  });

  describe("the ESLint rule", () => {
    const eslint = new ESLint({ cwd: ROOT });

    async function restricted(code: string, file = "src/app/demo/example.tsx") {
      const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
      return result.messages.filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-globals");
    }

    it.each([
      'import { withTx } from "@/server/db/client";',
      'import { getLeaderboard } from "@/server/services/awards";',
      'import { env } from "@/server/env";',
      'import { getViewer } from "@/server/auth/guards";',
      'import { env } from "../../server/env";',
      'import postgres from "postgres";',
      'import { getJson } from "@/lib/api";',
      'import { Page } from "@/components/app-shell";',
    ])("fails when a demo file adds %s", async (line) => {
      expect(await restricted(`${line}\nexport const used = [${line.match(/import \{? ?(\w+)/)![1]}];\n`)).not.toEqual([]);
    });

    it("fails when a demo file calls fetch", async () => {
      const code = 'export const load = () => fetch("/api/leaderboard");\n';
      expect(await restricted(code, "src/demo/example.ts")).not.toEqual([]);
    });

    it("allows type-only imports and the demo's own modules", async () => {
      const code = [
        'import type { Viewer } from "@/server/auth/viewer";',
        'import { DEMO_TEAMS } from "@/demo/fixtures";',
        "export const used: [Viewer | null, unknown] = [null, DEMO_TEAMS];",
        "",
      ].join("\n");
      expect(await restricted(code)).toEqual([]);
    });

    it("leaves the rest of the app alone", async () => {
      const code = 'import { withTx } from "@/server/db/client";\nexport const used = withTx;\n';
      expect(await restricted(code, "src/app/leaderboard/example.tsx")).toEqual([]);
    });
  });
});
