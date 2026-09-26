import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ConflictError,
  errorResponse,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "./errors";

describe("errorResponse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [new ValidationError("Bad input"), 400, "validation"],
    [new UnauthenticatedError(), 401, "unauthenticated"],
    [new ForbiddenError(), 403, "forbidden"],
    [new NotFoundError(), 404, "not_found"],
    [new ConflictError("Already accepted"), 409, "conflict"],
  ])("maps %s to %i", async (error, status, code) => {
    const response = errorResponse(error);
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(body.error.message).toBe(error.message);
  });

  it("includes validation details", async () => {
    const response = errorResponse(
      new ValidationError("Bad input", { title: ["Required"] }),
    );
    expect(await response.json()).toEqual({
      error: {
        code: "validation",
        message: "Bad input",
        details: { title: ["Required"] },
      },
    });
  });

  it("maps zod errors to 400 with field errors", async () => {
    const result = z.object({ title: z.string() }).safeParse({});
    if (result.success) throw new Error("expected a parse failure");
    const response = errorResponse(result.error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation");
    expect(body.error.details.fieldErrors.title).toHaveLength(1);
  });

  it("hides unknown errors behind a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = errorResponse(new Error("db password is hunter2"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal", message: "Something went wrong." },
    });
  });
});
