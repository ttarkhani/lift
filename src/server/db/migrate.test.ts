import { describe, expect, it } from "vitest";
import { orderMigrations, runsInTransaction, splitStatements } from "./migrate";

describe("orderMigrations", () => {
  it("orders by filename and ignores other files", () => {
    expect(
      orderMigrations(["0010_later.sql", ".gitkeep", "0002_activity.sql", "0001_core.sql", "notes.md"]),
    ).toEqual(["0001_core.sql", "0002_activity.sql", "0010_later.sql"]);
  });

  it("rejects two migrations with the same number", () => {
    expect(() => orderMigrations(["0002_a.sql", "0002_b.sql"])).toThrow(/share the number 0002/);
  });
});

describe("runsInTransaction", () => {
  it("is true by default", () => {
    expect(runsInTransaction("create table t (id int);")).toBe(true);
  });

  it("is false when the first line is -- no-transaction", () => {
    expect(runsInTransaction("-- no-transaction\ncreate index concurrently i on t (id);")).toBe(false);
    expect(runsInTransaction("  -- No-Transaction  \r\nselect 1;")).toBe(false);
  });

  it("only looks at the first line", () => {
    expect(runsInTransaction("select 1;\n-- no-transaction")).toBe(true);
    expect(runsInTransaction("-- no-transaction please\nselect 1;")).toBe(true);
  });
});

describe("splitStatements", () => {
  it("splits on top-level semicolons", () => {
    expect(splitStatements("select 1;\nselect 2;\n")).toEqual(["select 1", "select 2"]);
  });

  it("ignores semicolons in strings, comments, and dollar quotes", () => {
    const sql = `
      -- no-transaction
      insert into t values ('a;b', 'it''s;');
      /* a; comment */
      create function f() returns void language plpgsql as $body$ begin perform 1; end $body$;
      select $$x;y$$;
    `;
    expect(splitStatements(sql)).toEqual([
      "-- no-transaction\n      insert into t values ('a;b', 'it''s;')",
      "/* a; comment */\n      create function f() returns void language plpgsql as $body$ begin perform 1; end $body$",
      "select $$x;y$$",
    ]);
  });

  it("drops empty and comment-only statements", () => {
    expect(splitStatements("select 1;; -- done\n")).toEqual(["select 1"]);
  });
});
