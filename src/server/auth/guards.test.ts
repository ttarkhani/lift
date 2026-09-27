import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "./viewer";

const getSession = vi.fn();
const configured = vi.fn(() => true);
vi.mock("./auth0", () => ({
  getAuth0: () => ({ getSession }),
  isAuth0Configured: () => configured(),
}));
vi.mock("@/server/db/client", () => ({ withTx: (fn: (tx: unknown) => unknown) => fn("tx") }));
const loadViewer = vi.fn();
vi.mock("./viewer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./viewer")>()),
  loadViewer: (...args: unknown[]) => loadViewer(...args),
}));

const {
  assertCanViewThread,
  assertOrganizer,
  assertTeamMember,
  assertUser,
  getViewer,
  requireOrganizer,
  requireTeamMember,
  requireUser,
} = await import("./guards");

const maple = { id: "1", slug: "maple", name: "Maple", isDemo: false };
const aurora = { id: "2", slug: "aurora", name: "Aurora", isDemo: false };
const orbit = { id: "3", slug: "orbit", name: "Orbit", isDemo: false };

function viewer(overrides: Partial<Viewer> = {}): Viewer {
  return { userId: "10", displayName: "Sam", email: null, team: maple, roles: [], ...overrides };
}

const participant = viewer();
const teamless = viewer({ team: null });
const organizer = viewer({ team: null, roles: ["organizer"] });

function status(fn: () => unknown): number | "ok" {
  try {
    fn();
    return "ok";
  } catch (error) {
    return (error as { status: number }).status;
  }
}

describe("assertUser", () => {
  it("allows any signed-in viewer and rejects signed-out with 401", () => {
    expect(assertUser(teamless)).toBe(teamless);
    expect(status(() => assertUser(null))).toBe(401);
  });
});

describe("assertTeamMember", () => {
  it("allows a viewer on a team", () => {
    expect(assertTeamMember(participant)).toBe(participant);
  });

  it("rejects a viewer without a team with 403, even an organizer", () => {
    expect(status(() => assertTeamMember(teamless))).toBe(403);
    expect(status(() => assertTeamMember(organizer))).toBe(403);
  });

  it("rejects signed-out with 401", () => {
    expect(status(() => assertTeamMember(null))).toBe(401);
  });
});

describe("assertOrganizer", () => {
  it("allows the organizer role", () => {
    expect(assertOrganizer(organizer)).toBe(organizer);
  });

  it("rejects participants with 403 and signed-out with 401", () => {
    expect(status(() => assertOrganizer(participant))).toBe(403);
    expect(status(() => assertOrganizer(teamless))).toBe(403);
    expect(status(() => assertOrganizer(null))).toBe(401);
  });
});

describe("assertCanViewThread", () => {
  const accepted = { requestingTeamId: aurora.id, helpingTeamId: maple.id };
  const open = { requestingTeamId: aurora.id, helpingTeamId: null };

  it("allows the requesting team", () => {
    expect(status(() => assertCanViewThread(viewer({ team: aurora }), open))).toBe("ok");
    expect(status(() => assertCanViewThread(viewer({ team: aurora }), accepted))).toBe("ok");
  });

  it("allows the helping team only once it has accepted", () => {
    expect(status(() => assertCanViewThread(participant, accepted))).toBe("ok");
    expect(status(() => assertCanViewThread(participant, open))).toBe(403);
  });

  it("allows organizers", () => {
    expect(status(() => assertCanViewThread(organizer, accepted))).toBe("ok");
    expect(status(() => assertCanViewThread(organizer, open))).toBe("ok");
  });

  it("rejects other teams and viewers without a team with 403", () => {
    expect(status(() => assertCanViewThread(viewer({ team: orbit }), accepted))).toBe(403);
    expect(status(() => assertCanViewThread(teamless, accepted))).toBe(403);
  });

  it("rejects signed-out with 401", () => {
    expect(status(() => assertCanViewThread(null, accepted))).toBe(401);
  });
});

describe("getViewer and the require guards", () => {
  beforeEach(() => {
    configured.mockReturnValue(true);
  });

  afterEach(() => {
    getSession.mockReset();
    loadViewer.mockReset();
  });

  it("is signed out when Auth0 isn't configured", async () => {
    configured.mockReturnValue(false);
    expect(await getViewer()).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("is signed out without a session", async () => {
    getSession.mockResolvedValue(null);
    expect(await getViewer()).toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
    await expect(requireTeamMember()).rejects.toMatchObject({ status: 401 });
    await expect(requireOrganizer()).rejects.toMatchObject({ status: 401 });
  });

  it("loads the viewer for the session's user", async () => {
    const user = { sub: "auth0|sam" };
    getSession.mockResolvedValue({ user });
    loadViewer.mockResolvedValue(participant);
    expect(await requireUser()).toBe(participant);
    expect(await requireTeamMember()).toBe(participant);
    await expect(requireOrganizer()).rejects.toMatchObject({ status: 403 });
    expect(loadViewer).toHaveBeenCalledWith("tx", user);
  });

  it("lets an organizer through requireOrganizer", async () => {
    getSession.mockResolvedValue({ user: { sub: "auth0|org" } });
    loadViewer.mockResolvedValue(organizer);
    expect(await requireOrganizer()).toBe(organizer);
  });
});
