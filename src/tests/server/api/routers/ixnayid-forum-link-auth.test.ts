/**
 * WK-1: ixnayid forum linking needs proof. There is no way to link a forum account by name alone;
 * confirmForumVerification links only when the forum profile shows the caller's code.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/env", () => {
  const actual = jest.requireActual("~/env");
  return { env: { ...actual.env, FORUM_VERIFICATION_SECRET: "router-test-secret" } };
});

jest.mock("~/server/db", () => {
  const user = {
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
  };
  const db: Record<string, unknown> = { user };
  db.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/forum/services/xenforo-service", () => ({
  __esModule: true,
  ...jest.requireActual("~/server/modules/forum/services/xenforo-service"),
  xfFetch: jest.fn(),
  getXfApiKey: () => "test-key",
}));

jest.mock("~/server/modules/forum/services/xenforo-user-sync", () => ({
  __esModule: true,
  ...jest.requireActual("~/server/modules/forum/services/xenforo-user-sync"),
  lookupForumUser: jest.fn().mockResolvedValue({ userId: 42, username: "Victim" }),
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidLinkingRouter } from "~/server/api/routers/ixnayid/linking";
import { db } from "~/server/db";
import { xfFetch } from "~/server/modules/forum/services/xenforo-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(ixnayidLinkingRouter);
const userUpdate = (db as unknown as { user: { update: jest.Mock } }).user.update;

function attacker() {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "clerk_attacker" },
      user: { id: "db_attacker", clerkUserId: "clerk_attacker", role: { name: "user" } },
      db,
    }) as never
  );
}

describe("WK-1: forum linking needs proof", () => {
  beforeEach(() => {
    userUpdate.mockClear();
    (xfFetch as jest.Mock).mockReset();
  });

  it("offers no procedure that links a forum account by username alone", async () => {
    // The forum knows the victim's name, so a name-only link would succeed.
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ exact: { user_id: 42, username: "Victim" } }),
    } as never);
    const caller = attacker() as unknown as {
      linkForum?: (input: { forumUsername: string }) => Promise<unknown>;
    };

    await expect(caller.linkForum!({ forumUsername: "Victim" })).rejects.toThrow();
    expect(userUpdate).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("confirmForumVerification refuses when the victim's profile lacks the caller's code", async () => {
    (xfFetch as jest.Mock).mockResolvedValue({ user: { location: "Caphiria", about: "" } });

    await expect(attacker().confirmForumVerification({ forumUsername: "Victim" })).rejects.toThrow(
      /code was not found/
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("links after the code issued to the caller appears on the forum profile", async () => {
    const { code } = await attacker().startForumVerification({ forumUsername: "Victim" });
    (xfFetch as jest.Mock).mockResolvedValue({ user: { location: code } });

    await expect(
      attacker().confirmForumVerification({ forumUsername: "Victim" })
    ).resolves.toMatchObject({ success: true, forumUserId: 42, forumUsername: "Victim" });
    expect(xfFetch).toHaveBeenCalledWith("/users/42/");
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "db_attacker" },
      data: { forumUserId: 42, forumUsername: "Victim" },
    });
  });
});
