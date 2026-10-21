/** @jest-environment node */
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { notificationAPI } from "~/lib/notifications/api";
import {
  notifyAppealDecision,
  notifyAutoBanShortened,
  notifyBan,
  notifyBanLifted,
  notifyWarning,
} from "~/server/modules/thinkpages-forum";

const create = jest.mocked(notificationAPI.create);

function userDb(row: { clerkUserId: string } | null = { clerkUserId: "clerk_member" }) {
  return { user: { findUnique: jest.fn(async () => row) } };
}

const COMMON = {
  userId: "clerk_member",
  category: "social",
  href: "/thinkpages#standing",
  source: "thinkpages-forum",
  actionable: true,
};

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue("n1");
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe("notifyWarning", () => {
  it("notifies the member by Clerk id, looked up from User.id", async () => {
    const db = userDb();
    await notifyWarning(db as never, { userId: "u_m", points: 2, reason: "Rude", activePoints: 7 });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u_m" },
      select: { clerkUserId: true },
    });
    expect(create).toHaveBeenCalledWith({
      ...COMMON,
      title: "You received a forum warning",
      message: "A moderator gave you 2 points (7 active now). Reason: Rude",
      type: "warning",
    });
  });
  it("never throws when the notification fails, and logs it", async () => {
    create.mockRejectedValueOnce(new Error("guard disabled"));
    await expect(
      notifyWarning(userDb() as never, {
        userId: "u_m",
        points: 2,
        reason: "Rude",
        activePoints: 2,
      })
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("never throws when the user lookup fails", async () => {
    const db = { user: { findUnique: jest.fn(async () => Promise.reject(new Error("db down"))) } };
    await expect(
      notifyWarning(db as never, { userId: "u_m", points: 2, reason: "Rude", activePoints: 2 })
    ).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it("sends nothing when the member is gone", async () => {
    await notifyWarning(userDb(null) as never, {
      userId: "u_x",
      points: 2,
      reason: "Rude",
      activePoints: 2,
    });
    expect(create).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("notifyAutoBanShortened (M5)", () => {
  it("says the automatic ban was shortened and when it now ends, never as a new ban", async () => {
    await notifyAutoBanShortened(userDb() as never, {
      userId: "u_m",
      expiresAt: new Date("2026-10-16T12:00:00Z"),
    });
    expect(create).toHaveBeenCalledWith({
      ...COMMON,
      title: "Your forum ban was shortened",
      message: "Your automatic forum ban was shortened; it now ends on 16 Oct 2026.",
      type: "info",
    });
  });
});

describe("notifyBan", () => {
  it("never throws", async () => {
    create.mockRejectedValueOnce(new Error("boom"));
    await expect(
      notifyBan(userDb() as never, {
        userId: "u_m",
        ban: { scope: "site", expiresAt: null, reason: "x" },
      })
    ).resolves.toBeUndefined();
  });
});

describe("notifyBanLifted", () => {
  it("never throws", async () => {
    create.mockRejectedValueOnce(new Error("boom"));
    await expect(
      notifyBanLifted(userDb() as never, { userId: "u_m", ban: { scope: "site" } })
    ).resolves.toBeUndefined();
  });
});

describe("notifyAppealDecision", () => {
  it("never throws", async () => {
    create.mockRejectedValueOnce(new Error("boom"));
    await expect(
      notifyAppealDecision(userDb() as never, {
        userId: "u_m",
        subjectType: "ban",
        outcome: "upheld",
        response: "No.",
      })
    ).resolves.toBeUndefined();
  });
});
