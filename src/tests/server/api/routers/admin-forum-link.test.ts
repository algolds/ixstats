/** @jest-environment node */
/**
 * Phase 4b: linking an old forum account is a staff action in the admin users panel. Only admins may call it; it
 * links and attributes the imported posts at once (the module, faked here), writes an audit row, and maps the
 * module's refusals to tRPC errors.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/modules/thinkpages-forum", () => {
  class ForumError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
  return { ForumError, linkOldForumAccount: jest.fn(), unlinkOldForumAccount: jest.fn() };
});

import { describe, expect, it, beforeEach } from "@jest/globals";
import { adminUsersRouter } from "~/server/api/routers/admin/users";
import {
  ForumError,
  linkOldForumAccount,
  unlinkOldForumAccount,
} from "~/server/modules/thinkpages-forum";
import { createIdorContext } from "~/tests/helpers/country-idor-context";

function caller(role: "member" | "admin") {
  const ctx = createIdorContext(
    { adminAuditLog: { create: jest.fn().mockResolvedValue({}) } },
    role
  );
  return { caller: adminUsersRouter.createCaller(ctx as never), db: ctx.db as never as AuditDb };
}
type AuditDb = { adminAuditLog: { create: jest.Mock } };

const LINKED = {
  username: "OldTimer",
  previousXenforoUserId: 55,
  released: { threads: 0, posts: 3 },
  relinked: { threads: 1, posts: 2 },
};

beforeEach(() => {
  jest.mocked(linkOldForumAccount).mockReset().mockResolvedValue(LINKED);
  jest
    .mocked(unlinkOldForumAccount)
    .mockReset()
    .mockResolvedValue({ released: { threads: 1, posts: 2 } });
});

describe("admin.linkUserForum / unlinkUserForum", () => {
  it("refuse non-admins without touching anything", async () => {
    const { caller: member } = caller("member");
    await expect(member.linkUserForum({ userId: "u1", xenforoUserId: 77 })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(member.unlinkUserForum({ userId: "u1" })).rejects.toThrow(
      /Admin privileges required/
    );
    expect(linkOldForumAccount).not.toHaveBeenCalled();
    expect(unlinkOldForumAccount).not.toHaveBeenCalled();
  });

  it("links, attributes the imported posts at once and writes an audit row", async () => {
    const { caller: admin, db } = caller("admin");
    await expect(
      admin.linkUserForum({ userId: "u1", xenforoUserId: 77, forumUsername: "OldTimer" })
    ).resolves.toEqual(LINKED);
    expect(jest.mocked(linkOldForumAccount).mock.calls[0]![1]).toEqual({
      userId: "u1",
      xenforoUserId: 77,
      username: "OldTimer",
    });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "FORUM_ACCOUNT_LINKED",
        targetId: "u1",
        adminId: "db_user_caller",
      }),
    });
    const changes = JSON.parse(db.adminAuditLog.create.mock.calls[0]![0].data.changes);
    expect(changes).toMatchObject({ xenforoUserId: 77, previousXenforoUserId: 55 });
  });

  it("unlinks and audits", async () => {
    const { caller: admin, db } = caller("admin");
    await expect(admin.unlinkUserForum({ userId: "u1" })).resolves.toEqual({
      released: { threads: 1, posts: 2 },
    });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "FORUM_ACCOUNT_UNLINKED", targetId: "u1" }),
    });
  });

  it("maps a refusal to its tRPC code and writes no audit row", async () => {
    jest
      .mocked(linkOldForumAccount)
      .mockRejectedValue(new ForumError("CONFLICT", "Another account is already linked"));
    const { caller: admin, db } = caller("admin");
    await expect(admin.linkUserForum({ userId: "u1", xenforoUserId: 77 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive XenForo id", async () => {
    const { caller: admin } = caller("admin");
    await expect(admin.linkUserForum({ userId: "u1", xenforoUserId: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
