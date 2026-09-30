/**
 * SL-1 / SL-2 / SL-12: ThinkTank authorization.
 *
 * Every procedure acts as ctx.auth.userId; group management needs the owner or a group admin;
 * private and invite-only groups need an invite to join and are readable by members only; group
 * posts need membership and the caller's own ThinkPages account; notification names come from
 * the identity resolver, never an ID fragment.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { notificationHooks } from "~/lib/notifications/hooks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(thinkpagesThinktanksRouter);
type Db = ReturnType<typeof createMockPrisma>;

const OWNER = "user_owner";
const ADMIN = "user_group_admin";
const MEMBER = "user_member";
const OUTSIDER = "user_outsider";

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    name: "Economists",
    type: "public",
    createdBy: OWNER,
    isActive: true,
    settings: null,
    conversationId: null,
    ...overrides,
  };
}

const ROLES: Record<string, string> = { [OWNER]: "owner", [ADMIN]: "admin", [MEMBER]: "member" };

/** A db whose ThinktankMember rows follow ROLES; `g` is returned for any group lookup. */
function makeDb(g = group()): Db {
  const db = createMockPrisma();
  db.thinktankGroup.findUnique.mockResolvedValue(g);
  db.thinktankGroup.update.mockResolvedValue(g);
  db.thinktankGroup.delete.mockResolvedValue(g);
  db.thinktankMember.findUnique.mockImplementation(async (args: any) => {
    const userId = args.where.groupId_userId.userId as string;
    const role = ROLES[userId];
    return role ? { id: `m_${userId}`, userId, role, isActive: true } : null;
  });
  return db;
}

function callerAs(userId: string | null, db: Db) {
  return createCaller(
    createMockRouterContext({
      auth: userId ? { userId } : null,
      user: userId ? { id: `db_${userId}`, clerkUserId: userId, isActive: true } : null,
      db,
    }) as never
  );
}

beforeEach(() => {
  (notificationHooks.onThinktankActivity as jest.Mock).mockClear();
});

describe("SL-1: group management needs the owner or a group admin", () => {
  it.each([OUTSIDER, MEMBER])("updateThinktank rejects %s and writes nothing", async (who) => {
    const db = makeDb();
    await expect(
      callerAs(who, db).updateThinktank({ groupId: "g1", name: "Hijacked" })
    ).rejects.toThrow(/owner or a group admin/);
    expect(db.thinktankGroup.update).not.toHaveBeenCalled();
  });

  it("updateThinktank lets a group admin rename the group", async () => {
    const db = makeDb();
    await callerAs(ADMIN, db).updateThinktank({ groupId: "g1", name: "Renamed" });
    expect(db.thinktankGroup.update).toHaveBeenCalled();
  });

  it("deleteThinktank rejects a non-owner and deletes nothing", async () => {
    const db = makeDb();
    await expect(callerAs(MEMBER, db).deleteThinktank({ groupId: "g1" })).rejects.toThrow(
      /owner or a group admin/
    );
    expect(db.thinktankGroup.delete).not.toHaveBeenCalled();
  });

  it("deleteThinktank lets the owner delete", async () => {
    const db = makeDb();
    await expect(callerAs(OWNER, db).deleteThinktank({ groupId: "g1" })).resolves.toEqual({
      success: true,
    });
    expect(db.thinktankGroup.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
  });

  it("updateGroupSettings rejects a plain member", async () => {
    const db = makeDb();
    await expect(
      callerAs(MEMBER, db).updateGroupSettings({ groupId: "g1", allowPersonaPosting: true })
    ).rejects.toThrow(/owner or a group admin/);
    expect(db.thinktankGroup.update).not.toHaveBeenCalled();
  });

  it("inviteToThinktank rejects a plain member and records the caller as inviter", async () => {
    const db = makeDb();
    await expect(
      callerAs(MEMBER, db).inviteToThinktank({ groupId: "g1", userIds: ["user_friend"] })
    ).rejects.toThrow(/owner or a group admin/);
    expect(db.thinktankInvite.createMany).not.toHaveBeenCalled();

    db.user.findMany.mockResolvedValue([{ clerkUserId: "user_friend", countryId: null }]);
    await callerAs(OWNER, db).inviteToThinktank({
      groupId: "g1",
      userIds: ["user_friend"],
      invitedBy: MEMBER,
    } as never);
    expect(db.thinktankInvite.createMany).toHaveBeenCalledWith({
      data: [{ groupId: "g1", invitedUser: "user_friend", invitedBy: OWNER }],
    });
  });
});

describe("SL-1: join, leave and documents act as the caller", () => {
  it("joinThinktank ignores a spoofed userId and joins the caller", async () => {
    const db = makeDb();
    await callerAs(OUTSIDER, db).joinThinktank({ groupId: "g1", userId: "victim" } as never);
    expect(db.thinktankMember.create).toHaveBeenCalledWith({
      data: { groupId: "g1", userId: OUTSIDER, role: "member" },
    });
  });

  it.each(["private", "invite_only"])(
    "joinThinktank refuses a %s group without an invite",
    async (type) => {
      const db = makeDb(group({ type }));
      await expect(callerAs(OUTSIDER, db).joinThinktank({ groupId: "g1" })).rejects.toThrow(
        /invite-only/
      );
      expect(db.thinktankMember.create).not.toHaveBeenCalled();
    }
  );

  it("joinThinktank uses up an open invite for a private group", async () => {
    const db = makeDb(group({ type: "private" }));
    db.thinktankInvite.findFirst.mockResolvedValue({ id: "inv1" });
    db.thinktankInvite.updateMany.mockResolvedValue({ count: 1 });

    await callerAs(OUTSIDER, db).joinThinktank({ groupId: "g1" });

    expect(db.thinktankInvite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: "g1", invitedUser: OUTSIDER, isUsed: false }),
      })
    );
    expect(db.thinktankInvite.updateMany).toHaveBeenCalledWith({
      where: { id: "inv1", isUsed: false },
      data: { isUsed: true },
    });
    expect(db.thinktankMember.create).toHaveBeenCalled();
  });

  it("leaveThinktank looks up the caller's membership, not input.userId", async () => {
    const db = makeDb();
    await callerAs(MEMBER, db).leaveThinktank({ groupId: "g1", userId: ADMIN } as never);
    expect(db.thinktankMember.findUnique).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: "g1", userId: MEMBER } },
    });
  });

  it("createThinktankDocument rejects a non-member even with a spoofed createdBy", async () => {
    const db = makeDb();
    await expect(
      callerAs(OUTSIDER, db).createThinktankDocument({
        groupId: "g1",
        title: "Paper",
        createdBy: MEMBER,
      } as never)
    ).rejects.toThrow(/Not a member/);
    expect(db.collaborativeDoc.create).not.toHaveBeenCalled();
  });

  it("createThinktankDocument records the caller as author", async () => {
    const db = makeDb();
    db.collaborativeDoc.count.mockResolvedValue(0);
    db.collaborativeDoc.create.mockResolvedValue({ id: "d1", title: "Paper" });
    await callerAs(MEMBER, db).createThinktankDocument({ groupId: "g1", title: "Paper" });
    expect(db.collaborativeDoc.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdBy: MEMBER, lastEditBy: MEMBER }),
    });
  });

  it("updateThinktankDocument ignores a spoofed userId", async () => {
    const db = makeDb();
    db.collaborativeDoc.findUnique.mockResolvedValue({
      id: "d1",
      groupId: "g1",
      createdBy: MEMBER,
      group: { ...group(), members: [{ userId: MEMBER, isActive: true }] },
    });
    await expect(
      callerAs(OUTSIDER, db).updateThinktankDocument({
        documentId: "d1",
        userId: MEMBER,
        title: "Defaced",
      } as never)
    ).rejects.toThrow(/Not a member/);
    expect(db.collaborativeDoc.update).not.toHaveBeenCalled();
  });

  it("deleteThinktankDocument ignores a spoofed owner userId", async () => {
    const db = makeDb();
    db.collaborativeDoc.findUnique.mockResolvedValue({
      id: "d1",
      groupId: "g1",
      createdBy: MEMBER,
      group: group(),
    });
    await expect(
      callerAs(OUTSIDER, db).deleteThinktankDocument({ documentId: "d1", userId: OWNER } as never)
    ).rejects.toThrow(/creator or a group owner/);
    expect(db.collaborativeDoc.delete).not.toHaveBeenCalled();
  });
});

describe("SL-1: group posts", () => {
  it("createGroupPost rejects a non-member", async () => {
    const db = makeDb();
    await expect(
      callerAs(OUTSIDER, db).createGroupPost({ groupId: "g1", content: "hi" })
    ).rejects.toThrow(/Not a member/);
    expect(db.thinkpagesPost.create).not.toHaveBeenCalled();
  });

  it("createGroupPost rejects posting as a persona when the group disallows it", async () => {
    const db = makeDb();
    await expect(
      callerAs(MEMBER, db).createGroupPost({ groupId: "g1", accountId: "acc_mine", content: "hi" })
    ).rejects.toThrow(/does not allow posting as a persona/);
    expect(db.thinkpagesPost.create).not.toHaveBeenCalled();
  });

  it("createGroupPost rejects someone else's ThinkPages account", async () => {
    const db = makeDb(group({ settings: JSON.stringify({ allowPersonaPosting: true }) }));
    db.thinkpagesAccount.findFirst.mockResolvedValue(null);
    await expect(
      callerAs(MEMBER, db).createGroupPost({
        groupId: "g1",
        accountId: "acc_victim",
        content: "hi",
      })
    ).rejects.toThrow(/your own ThinkPages accounts/);
    expect(db.thinkpagesAccount.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_victim", clerkUserId: MEMBER, isActive: true },
      select: { id: true },
    });
    expect(db.thinkpagesPost.create).not.toHaveBeenCalled();
  });

  it("createGroupPost accepts the caller's own persona when allowed", async () => {
    const db = makeDb(group({ settings: JSON.stringify({ allowPersonaPosting: true }) }));
    db.thinkpagesAccount.findFirst.mockResolvedValue({ id: "acc_mine" });
    db.thinkpagesPost.create.mockResolvedValue({ id: "p1" });
    await callerAs(MEMBER, db).createGroupPost({
      groupId: "g1",
      accountId: "acc_mine",
      content: "hi",
    });
    expect(db.thinkpagesPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accountId: "acc_mine" }) })
    );
  });
});

describe("SL-2: private group content is for members only", () => {
  const privateGroup = group({ type: "private" });

  it("getThinktankDocuments refuses signed-out callers and non-members of a private group", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    for (const who of [null, OUTSIDER]) {
      const db = makeDb(privateGroup);
      await expect(callerAs(who, db).getThinktankDocuments({ groupId: "g1" })).rejects.toThrow(
        /only visible to its members/
      );
      expect(db.collaborativeDoc.findMany).not.toHaveBeenCalled();
    }
    warnSpy.mockRestore();
  });

  it("getThinktankDocuments serves members of a private group", async () => {
    const db = makeDb(privateGroup);
    db.collaborativeDoc.findMany.mockResolvedValue([{ id: "d1" }]);
    await expect(callerAs(MEMBER, db).getThinktankDocuments({ groupId: "g1" })).resolves.toEqual([
      { id: "d1" },
    ]);
  });

  it("getThinktankDocuments serves a public group to signed-out callers", async () => {
    const db = makeDb();
    db.collaborativeDoc.findMany.mockResolvedValue([{ id: "d1" }]);
    await expect(callerAs(null, db).getThinktankDocuments({ groupId: "g1" })).resolves.toEqual([
      { id: "d1" },
    ]);
  });

  it("getGroupFeed refuses non-members of a private group", async () => {
    const db = makeDb(privateGroup);
    await expect(callerAs(OUTSIDER, db).getGroupFeed({ groupId: "g1" })).rejects.toThrow(
      /only visible to its members/
    );
    expect(db.thinkpagesPost.findMany).not.toHaveBeenCalled();
  });

  it("getThinktankById hides documents and members of a private group from outsiders", async () => {
    const db = makeDb();
    db.thinktankGroup.findUnique.mockResolvedValue({
      ...privateGroup,
      conversationId: "c1",
      conversation: { id: "c1", lastActivity: new Date() },
      tags: null,
      members: [{ userId: MEMBER, role: "member", isActive: true }],
      collaborativeDocs: [{ id: "secret_doc" }],
    });

    const result = await callerAs(OUTSIDER, db).getThinktankById({ groupId: "g1" });

    expect(result?.collaborativeDocs).toEqual([]);
    expect(result?.members).toEqual([]);
    expect(result?.isMember).toBe(false);
  });
});

describe("SL-12: notification names come from the identity resolver", () => {
  it("joinThinktank names the joiner by their nation, not an ID fragment", async () => {
    const db = makeDb();
    db.thinktankMember.findMany.mockResolvedValue([{ userId: OWNER }]);
    db.user.findMany.mockResolvedValue([
      {
        clerkUserId: OUTSIDER,
        forumUsername: null,
        wikiUsername: null,
        country: { name: "Caphiria" },
      },
    ]);

    await callerAs(OUTSIDER, db).joinThinktank({ groupId: "g1" });

    expect(notificationHooks.onThinktankActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: OUTSIDER, actorUserName: "Caphiria" })
    );
  });
});
