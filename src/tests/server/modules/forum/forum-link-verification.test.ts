/**
 * WK-1: a forum account is linked only after its profile shows the code issued to this user.
 */
import { describe, it, expect, jest } from "@jest/globals";
import {
  createForumLinkService,
  FORUM_CODE_WINDOW_MS,
  forumVerificationCode,
  type ForumProfileProof,
} from "~/server/modules/forum/services/forum-link-verification";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const SECRET = "test-forum-secret";
const FORUM_USER = { userId: 42, username: "RealOwner" };
const T0 = new Date(
  Math.floor(Date.UTC(2026, 8, 30, 12) / FORUM_CODE_WINDOW_MS) * FORUM_CODE_WINDOW_MS
);

function setup(profile: ForumProfileProof | null, now = T0, secret: string | null = SECRET) {
  const db = createMockPrisma();
  db.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(db));
  const syncProfile = jest.fn(async () => true);
  const service = createForumLinkService(db as never, {
    secret,
    lookupUser: async (name) => (name.toLowerCase() === "realowner" ? FORUM_USER : null),
    fetchProfile: async () => profile,
    syncProfile,
    isSystemOwner: () => false,
    now: () => now,
  });
  return { db, service, syncProfile };
}

describe("forum link verification (WK-1)", () => {
  it("start issues a code bound to this user and forum account, and stores nothing", async () => {
    const { db, service } = setup(null);

    const res = await service.start("user_a", "realowner");

    expect(res.code).toBe(
      forumVerificationCode(SECRET, "user_a", 42, T0.getTime() / FORUM_CODE_WINDOW_MS)
    );
    expect(res.forumUsername).toBe("RealOwner");
    expect(res.code).not.toBe((await service.start("user_b", "realowner")).code);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("confirm refuses when the code is not on the forum profile", async () => {
    const { db, service } = setup({ location: "Somewhere", about: "Hello" });

    await expect(service.confirm("user_a", "clerk_a", "RealOwner")).rejects.toThrow(
      /code was not found/
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("confirm refuses a code issued to a different IxStats user", async () => {
    const window = T0.getTime() / FORUM_CODE_WINDOW_MS;
    const { db, service } = setup({
      location: forumVerificationCode(SECRET, "user_b", 42, window),
    });

    await expect(service.confirm("user_a", "clerk_a", "RealOwner")).rejects.toThrow(
      /code was not found/
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("confirm links the account when the code is in Location, and evicts an unproven holder", async () => {
    const setupRes = setup(null);
    const { code } = await setupRes.service.start("user_a", "RealOwner");
    const { db, service, syncProfile } = setup({ location: `  ${code} ` });

    await expect(service.confirm("user_a", "clerk_a", "RealOwner")).resolves.toEqual({
      forumUserId: 42,
      forumUsername: "RealOwner",
    });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { forumUserId: 42, id: { not: "user_a" } },
      data: { forumUserId: null, forumUsername: null, lastForumSync: null },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user_a" },
      data: { forumUserId: 42, forumUsername: "RealOwner" },
    });
    expect(syncProfile).toHaveBeenCalledWith("user_a");
  });

  it("accepts the code in About until the end of the next window, then expires it", async () => {
    const { code } = await setup(null).service.start("user_a", "RealOwner");
    const profile = { about: `verify: ${code}` };

    const later = new Date(T0.getTime() + FORUM_CODE_WINDOW_MS + 60_000);
    await expect(
      setup(profile, later).service.confirm("user_a", "c", "RealOwner")
    ).resolves.toBeTruthy();

    const expired = new Date(T0.getTime() + 2 * FORUM_CODE_WINDOW_MS + 60_000);
    await expect(
      setup(profile, expired).service.confirm("user_a", "c", "RealOwner")
    ).rejects.toThrow(/code was not found/);
  });

  it("refuses to run without a secret", async () => {
    await expect(setup(null, T0, null).service.start("user_a", "RealOwner")).rejects.toThrow(
      /not configured/
    );
  });

  it("reports an unknown forum user and an unreadable profile", async () => {
    await expect(setup(null).service.start("user_a", "nobody")).rejects.toThrow(/not found/);
    await expect(setup(null).service.confirm("user_a", "c", "RealOwner")).rejects.toThrow(
      /could not be read/
    );
  });
});
