import {
  requireForumUser,
  getForumUserByClerkId,
  getForumUserByInternalId,
} from "~/server/modules/forum";
import * as userSync from "~/server/modules/forum/services/xenforo-user-sync";

describe("Linked User Resolution (Canonical Forum Module)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("requireForumUser returns existing forumUserId", async () => {
    const mockDb: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          forumUserId: 42,
          forumUsername: "testuser",
        }),
      },
    };

    const xfUserId = await requireForumUser("internal_user_1", mockDb);
    expect(xfUserId).toBe(42);
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "internal_user_1" },
      select: { forumUserId: true, forumUsername: true },
    });
  });

  test("requireForumUser backfills forumUserId if forumUsername is present", async () => {
    const mockDb: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          forumUserId: null,
          forumUsername: "testuser",
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    jest.spyOn(userSync, "lookupForumUser").mockResolvedValue({
      userId: 88,
      username: "testuser",
      email: "test@example.com",
    } as any);

    const xfUserId = await requireForumUser("internal_user_1", mockDb);
    expect(xfUserId).toBe(88);
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "internal_user_1" },
      data: { forumUserId: 88 },
    });
  });

  test("requireForumUser throws PRECONDITION_FAILED when not linked", async () => {
    const mockDb: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(requireForumUser("internal_user_1", mockDb)).rejects.toThrow(
      "You must link your forum account first"
    );
  });

  test("getForumUserByClerkId queries by clerkUserId namespace", async () => {
    const mockDb: any = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          forumUserId: 42,
          forumUsername: "clerkuser",
        }),
      },
    };

    const result = await getForumUserByClerkId("user_clerk_123", mockDb);
    expect(result).toEqual({ forumUserId: 42, forumUsername: "clerkuser" });
    expect(mockDb.user.findFirst).toHaveBeenCalledWith({
      where: { clerkUserId: "user_clerk_123" },
      select: { forumUserId: true, forumUsername: true },
    });
  });

  test("getForumUserByInternalId queries by internal User.id namespace", async () => {
    const mockDb: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          forumUserId: 99,
          forumUsername: "internaluser",
        }),
      },
    };

    const result = await getForumUserByInternalId("db_id_456", mockDb);
    expect(result).toEqual({ forumUserId: 99, forumUsername: "internaluser" });
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: "db_id_456" },
      select: { forumUserId: true, forumUsername: true },
    });
  });
});
