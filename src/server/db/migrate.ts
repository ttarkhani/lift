import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Sql } from "./client";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

const MIGRATION_FILE = /^(\d+)_[\w-]+\.sql$/;

/** Migration files in the order they apply: by filename, which starts with a zero-padded number. */
export function orderMigrations(filenames: string[]): string[] {
  const files = filenames.filter((name) => MIGRATION_FILE.test(name)).sort();
  const seen = new Map<string, string>();
  for (const file of files) {
    const number = MIGRATION_FILE.exec(file)![1];
    const other = seen.get(number);
    if (other) throw new Error(`Migrations ${other} and ${file} share the number ${number}.`);
    seen.set(number, file);
  }
  return files;
}

/** A migration runs in a transaction unless its first line is `-- no-transaction`. */
export function runsInTransaction(contents: string): boolean {
  const firstLine = contents.split(/\r?\n/, 1)[0].trim();
  return firstLine.toLowerCase() !== "-- no-transaction";
}

/**
 * Splits SQL into statements on top-level semicolons, skipping those inside quotes,
 * dollar-quoted bodies, and comments. Used for `-- no-transaction` files, where each
 * statement must run on its own.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
    } else if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      i++;
      while (i < sql.length) {
        if (sql[i] === quote && sql[i + 1] === quote) i += 2;
        else if (sql[i] === quote) break;
        else i++;
      }
      i++;
    } else if (sql[i] === "$" && /^\$(\w*)\$/.test(rest)) {
      const tag = /^\$(\w*)\$/.exec(rest)![0];
      const end = sql.indexOf(tag, i + tag.length);
      i = end === -1 ? sql.length : end + tag.length;
    } else if (sql[i] === ";") {
      statements.push(sql.slice(start, i));
      i++;
      start = i;
    } else {
      i++;
    }
  }
  statements.push(sql.slice(start));
  return statements.map((s) => s.trim()).filter((s) => stripComments(s) !== "");
}

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

/** Applies pending migrations from `dir` in order and returns the filenames it applied. */
export async function migrate(sql: Sql, dir = MIGRATIONS_DIR): Promise<string[]> {
  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const applied = new Set(
    (await sql<{ filename: string }[]>`select filename from schema_migrations`).map((r) => r.filename),
  );
  const pending = orderMigrations(await readdir(dir)).filter((file) => !applied.has(file));

  for (const file of pending) {
    const contents = await readFile(path.join(dir, file), "utf8");
    try {
      if (runsInTransaction(contents)) {
        await sql.begin(async (tx) => {
          await tx.unsafe(contents);
          await tx`insert into schema_migrations (filename) values (${file})`;
        });
      } else {
        const connection = await sql.reserve();
        try {
          for (const statement of splitStatements(contents)) {
            await connection.unsafe(statement);
          }
          await connection`insert into schema_migrations (filename) values (${file})`;
        } finally {
          connection.release();
        }
      }
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
    }
  }
  return pending;
}

/** Drops everything in the public schema, including the TimescaleDB extension. Local databases only. */
export async function dropSchema(sql: Sql): Promise<void> {
  await sql.unsafe("drop schema if exists public cascade; create schema public;");
}
