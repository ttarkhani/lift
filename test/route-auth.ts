// Test helpers for route handlers: fake the Auth0 session and the database, and keep the
// real guards, so a test exercises the same 401/403 checks production does.
import { vi } from "vitest";
import type { Viewer } from "@/server/auth/viewer";

export const auth = {
  viewer: null as Viewer | null,
  /** Every query a service ran. A rejected request should leave this empty. */
  queries: vi.fn<(...args: unknown[]) => unknown[]>(() => []),
};

export function signInAs(viewer: Viewer | null) {
  auth.viewer = viewer;
  auth.queries.mockClear();
}

export const participant: Viewer = {
  userId: "10",
  displayName: "Sam Okafor",
  email: "sam@example.test",
  team: { id: "1", slug: "maple", name: "Maple", isDemo: false },
  roles: [],
};

export const organizer: Viewer = {
  userId: "20",
  displayName: "Ria Organizer",
  email: "ria@example.test",
  team: null,
  roles: ["organizer"],
};

export function jsonRequest(url: string, body: unknown): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

/** Module mocks for vi.mock; call from the test file's top level. */
export const mocks = {
  auth0: () => ({
    isAuth0Configured: () => true,
    getAuth0: () => ({
      getSession: async () => (auth.viewer ? { user: { sub: `auth0|${auth.viewer.userId}` } } : null),
    }),
  }),
  viewer: async (importOriginal: () => Promise<typeof import("@/server/auth/viewer")>) => ({
    ...(await importOriginal()),
    loadViewer: async () => auth.viewer,
  }),
  db: async (importOriginal: () => Promise<typeof import("@/server/db/client")>) => ({
    ...(await importOriginal()),
    withTx: (fn: (tx: unknown) => unknown) => fn(auth.queries),
  }),
};
