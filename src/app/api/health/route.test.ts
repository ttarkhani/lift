import { afterEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/server/db/client", () => ({ getSql: () => query }));

const { GET } = await import("./route");

describe("GET /api/health", () => {
  afterEach(() => {
    query.mockReset();
    vi.restoreAllMocks();
  });

  it("reports the database as up", async () => {
    query.mockResolvedValue([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: "up" });
  });

  it("returns 503 when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValue(new Error("connection refused"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, db: "down" });
  });
});
