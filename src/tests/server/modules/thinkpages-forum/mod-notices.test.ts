/** @jest-environment node */
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));

import { notificationAPI } from "~/lib/notifications/api";
import {
  notifyAppealDecision,
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
  href: "/thinkpages/forum#standing",
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

  it("says 1 point in the singular", async () => {
    await notifyWarning(userDb() as never, {
      userId: "u_m",
      points: 1,
      reason: "Off topic",
      activePoints: 1,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A moderator gave you 1 point (1 active now). Reason: Off topic",
      })
    );
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

describe("notifyBan", () => {
  const until = new Date("2026-10-16T12:00:00Z");

  it.each([
    [{ scope: "site", scopeName: null }, "the forum"],
    [{ scope: "realm", scopeName: "Eurth" }, "Eurth's forum"],
    [{ scope: "realm" }, "a realm's forum"],
    [{ scope: "category", scopeName: "General" }, "the General category"],
    [{ scope: "category", scopeName: null }, "a forum category"],
  ] as const)("names the place for %o", async (place, text) => {
    await notifyBan(userDb() as never, {
      userId: "u_m",
      ban: { ...place, expiresAt: until, reason: "Spam" },
    });
    expect(create).toHaveBeenCalledWith({
      ...COMMON,
      title: "You are banned from posting",
      message: `You can't post in ${text} until 16 Oct 2026. Reason: Spam`,
      type: "warning",
    });
  });

  it("says when a ban is permanent", async () => {
    await notifyBan(userDb() as never, {
      userId: "u_m",
      ban: { scope: "site", expiresAt: null, reason: "Spam" },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "You can't post in the forum until a moderator lifts the ban. Reason: Spam",
      })
    );
  });

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
  it("tells the member they can post again", async () => {
    await notifyBanLifted(userDb() as never, {
      userId: "u_m",
      ban: { scope: "realm", scopeName: "Eurth" },
    });
    expect(create).toHaveBeenCalledWith({
      ...COMMON,
      title: "Your forum ban was lifted",
      message: "You can post in Eurth's forum again.",
      type: "info",
    });
  });

  it("never throws", async () => {
    create.mockRejectedValueOnce(new Error("boom"));
    await expect(
      notifyBanLifted(userDb() as never, { userId: "u_m", ban: { scope: "site" } })
    ).resolves.toBeUndefined();
  });
});

describe("notifyAppealDecision", () => {
  it.each([
    [
      "overturned",
      "ban",
      "Your appeal was accepted",
      "Your ban was overturned. Response: Fair point.",
    ],
    ["upheld", "warning", "Your appeal was declined", "Your warning stands. Response: Fair point."],
  ] as const)(
    "tells the member the appeal was %s",
    async (outcome, subjectType, title, message) => {
      await notifyAppealDecision(userDb() as never, {
        userId: "u_m",
        subjectType,
        outcome,
        response: "Fair point.",
      });
      expect(create).toHaveBeenCalledWith({ ...COMMON, title, message, type: "info" });
    }
  );

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
