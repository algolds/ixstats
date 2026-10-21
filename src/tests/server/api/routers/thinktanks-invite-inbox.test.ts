/**
 * SL-13: ThinkTank invites are no longer write-only — invitees see an inbox with accept/decline,
 * and managers can hand out single-use invite codes.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(thinkpagesThinktanksRouter);
type Db = ReturnType<typeof createMockPrisma>;

const OWNER = "user_owner";
const GUEST = "user_guest";

const PRIVATE_GROUP = {
  id: "g1",
  name: "Inner Circle",
  type: "invite_only",
  createdBy: OWNER,
  isActive: true,
  settings: null,
  conversationId: null,
};

function makeDb(): Db {
  const db = createMockPrisma();
  db.thinktankGroup.findUnique.mockResolvedValue(PRIVATE_GROUP);
  db.thinktankMember.findUnique.mockImplementation(async (args: any) => {
    const userId = args.where.groupId_userId.userId as string;
    return userId === OWNER ? { userId, role: "owner", isActive: true } : null;
  });
  db.thinktankMember.findMany.mockResolvedValue([]);
  db.thinktankInvite.updateMany.mockResolvedValue({ count: 1 });
  return db;
}

function callerAs(userId: string, db: Db) {
  return createCaller(
    createMockRouterContext({
      auth: { userId },
      user: {
        id: `db_${userId}`,
        clerkUserId: userId,
        isActive: true,
        role: { name: "user", level: 100 },
      },
      db,
    }) as never
  );
}

describe("ThinkTank invite inbox", () => {
  it("accepting joins the group and consumes the invite", async () => {
    const db = makeDb();
    db.thinktankInvite.findFirst.mockResolvedValue({ id: "i1", groupId: "g1" });

    const result = await callerAs(GUEST, db).acceptThinktankInvite({ inviteId: "i1" });
    expect(result.success).toBe(true);
    expect(db.thinktankMember.create).toHaveBeenCalledWith({
      data: { groupId: "g1", userId: GUEST, role: "member" },
    });
    expect(db.thinktankInvite.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", isUsed: false },
      data: { isUsed: true },
    });
  });

  it("refuses to accept an invite addressed to someone else", async () => {
    const db = makeDb();
    db.thinktankInvite.findFirst.mockResolvedValue(null);
    await expect(
      callerAs(GUEST, db).acceptThinktankInvite({ inviteId: "i1" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.thinktankMember.create).not.toHaveBeenCalled();
  });

  it("declining marks only the caller's own invite used", async () => {
    const db = makeDb();
    await callerAs(GUEST, db).declineThinktankInvite({ inviteId: "i1" });
    expect(db.thinktankInvite.updateMany).toHaveBeenCalledWith({
      where: { id: "i1", invitedUser: GUEST, isUsed: false },
      data: { isUsed: true },
    });

    db.thinktankInvite.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      callerAs(GUEST, db).declineThinktankInvite({ inviteId: "i9" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("ThinkTank invite codes", () => {
  it("only managers can create a code", async () => {
    const db = makeDb();
    await expect(
      callerAs(GUEST, db).createThinktankInviteCode({ groupId: "g1" })
    ).rejects.toThrow();
    expect(db.thinktankInvite.create).not.toHaveBeenCalled();

    db.thinktankInvite.create.mockImplementation(async (args: any) => args.data);
    const { code } = await callerAs(OWNER, db).createThinktankInviteCode({
      groupId: "g1",
      days: 3,
    });
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
    expect(db.thinktankInvite.create.mock.calls[0]![0].data).toMatchObject({
      groupId: "g1",
      invitedBy: OWNER,
      inviteCode: code,
    });
  });

  it("joining by code consumes that code for an invite-only group", async () => {
    const db = makeDb();
    db.thinktankInvite.findFirst.mockResolvedValue({ id: "code1", groupId: "g1" });

    const result = await callerAs(GUEST, db).joinThinktankByCode({ code: "abcd2345" });
    expect(result).toMatchObject({ success: true, groupId: "g1" });
    // The join path looks the invite up by code, not by addressee.
    expect(db.thinktankInvite.findFirst.mock.calls[1]![0].where).toMatchObject({
      groupId: "g1",
      inviteCode: "ABCD2345",
      isUsed: false,
    });
    expect(db.thinktankMember.create).toHaveBeenCalled();
  });
});
