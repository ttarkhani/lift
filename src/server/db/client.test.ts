import { describe, expect, it } from "vitest";
import { connectionOptions, isLocalDatabaseUrl } from "./client";

describe("connectionOptions", () => {
  it("turns off prepared statements for Tiger Cloud's transaction pooler", () => {
    expect(
      connectionOptions("postgres://u:p@abc.tsdb.cloud.timescale.com:29303/tsdb_transaction?sslmode=require")
        .prepare,
    ).toBe(false);
    expect(connectionOptions("postgres://u:p@abc.tsdb.cloud.timescale.com:31234/tsdb?sslmode=require").prepare).toBe(
      true,
    );
  });
});

describe("isLocalDatabaseUrl", () => {
  it.each([
    ["postgres://lifts:lifts@localhost:5432/lifts", true],
    ["postgres://lifts:lifts@127.0.0.1/lifts", true],
    ["postgres://lifts:lifts@[::1]:5432/lifts", true],
    ["postgres://u:p@abc.tsdb.cloud.timescale.com:31234/tsdb?sslmode=require", false],
    ["postgres://u:p@localhost.evil.example/lifts", false],
  ])("%s → %s", (url, expected) => {
    expect(isLocalDatabaseUrl(url)).toBe(expected);
  });
});
