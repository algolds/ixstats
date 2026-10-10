/** @jest-environment node */
import { firstUnreadPost } from "~/server/modules/thinkpages-forum/first-unread";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = { id: "u1", clerkUserId: "clerk_1", countryId: null, role: { name: "user", level: 100 } };
const category = {
  id: "cat_general",
  scope: "site",
  realmId: null,
  key: "general",
  style: "ooc",
  visibility: "public",
};

function db(first: { id: string } | null, last: { id: string } | null) {
  const findFirst = jest.fn(async (args: { orderBy: Array<{ createdAt: string }>; where: { createdAt: { gt: Date } } }) =>
    args.orderBy[0]?.createdAt === "asc" ? first : last
  );
  return {
    ...engagementTables(),
    forumThread: {
      findUnique: jest.fn(async () => ({
        id: "t1",
        categoryId: category.id,
        title: "Hello",
        authorUserId: "u2",
        authorPersonaId: null,
        importedAuthorName: null,
        xenforoThreadId: null,
        pinned: false,
        locked: false,
        hidden: false,
        archived: false,
        postCount: 4,
        lastPostAt: ago(1),
        createdAt: ago(5),
        category,
      })),
    },
    forumPost: { findFirst },
    realm: { findUnique: jest.fn(async () => null) },
  };
}

describe("firstUnreadPost", () => {
  it("is the first visible post after what the member read", async () => {
    const readAt = ago(3);
    const fake = db({ id: "p_next" }, { id: "p_last" });
    fake.forumThreadRead.findUnique.mockResolvedValue({ readAt });
    await expect(firstUnreadPost(fake as never, member, "t1")).resolves.toBe("p_next");
    expect(fake.forumPost.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { threadId: "t1", hidden: false, createdAt: { gt: readAt } },
      })
    );
  });

  it("starts from the thirty-day floor when the thread was never read", async () => {
    const fake = db({ id: "p_next" }, { id: "p_last" });
    await firstUnreadPost(fake as never, member, "t1");
    const gt = fake.forumPost.findFirst.mock.calls[0]![0].where.createdAt.gt;
    expect(Date.now() - gt.getTime()).toBeGreaterThan(29 * DAY);
  });

  it("falls back to the last post when everything is read", async () => {
    const fake = db(null, { id: "p_last" });
    await expect(firstUnreadPost(fake as never, member, "t1")).resolves.toBe("p_last");
  });

  it("is null for a thread with no visible post", async () => {
    await expect(firstUnreadPost(db(null, null) as never, member, "t1")).resolves.toBeNull();
  });
});
