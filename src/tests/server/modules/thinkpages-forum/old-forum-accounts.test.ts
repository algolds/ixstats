/** @jest-environment node */
/**
 * Phase 4b: staff link an old XenForo account in the admin users panel. The link attributes that XenForo user's
 * unattributed imported threads and posts at once (no import rerun); unlinking hands them back to the old name.
 */
import { describe, expect, it, jest } from "@jest/globals";
import {
  linkOldForumAccount,
  unlinkOldForumAccount,
} from "~/server/modules/thinkpages-forum/old-forum-accounts";

type Row = {
  id: string;
  authorUserId: string | null;
  xenforoUserId: number | null;
  importedAuthorName: string | null;
};
type Where = { authorUserId?: string | null; xenforoUserId?: number; importedAuthorName?: object };

function store(
  opts: { users?: Array<{ id: string; forumUserId: number | null; createdAt: Date }> } = {}
) {
  const users = opts.users ?? [{ id: "u1", forumUserId: null, createdAt: new Date(0) }];
  const threads: Row[] = [
    { id: "t1", authorUserId: null, xenforoUserId: 77, importedAuthorName: "OldTimer" },
    { id: "t2", authorUserId: null, xenforoUserId: 88, importedAuthorName: "Other" },
    { id: "t3", authorUserId: "u1", xenforoUserId: null, importedAuthorName: null },
  ];
  const posts: Row[] = [
    { id: "p1", authorUserId: null, xenforoUserId: 77, importedAuthorName: "OldTimer" },
    { id: "p2", authorUserId: null, xenforoUserId: 77, importedAuthorName: "OldTimer" },
    { id: "p3", authorUserId: "u1", xenforoUserId: null, importedAuthorName: null },
    { id: "p4", authorUserId: null, xenforoUserId: 88, importedAuthorName: "Other" },
  ];
  const matches = (r: Row, w: Where) =>
    (w.xenforoUserId === undefined || r.xenforoUserId === w.xenforoUserId) &&
    (!("authorUserId" in w) || r.authorUserId === w.authorUserId) &&
    (w.importedAuthorName === undefined || r.importedAuthorName !== null);
  const table = (rows: Row[]) => ({
    findFirst: jest.fn(
      async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null
    ),
    updateMany: jest.fn(
      async ({ where, data }: { where: Where; data: { authorUserId: string | null } }) => {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) r.authorUserId = data.authorUserId;
        return { count: hit.length };
      }
    ),
  });
  const user = {
    findFirst: jest.fn(
      async ({ where }: { where: { forumUserId: number; id: { not: string } } }) =>
        users.find((u) => u.forumUserId === where.forumUserId && u.id !== where.id.not) ?? null
    ),
    findUnique: jest.fn(
      async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null
    ),
    findMany: jest.fn(async ({ where }: { where: { forumUserId: number } }) =>
      users.filter((u) => u.forumUserId === where.forumUserId)
    ),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          forumUserId: number | null;
          forumUsername: string | null;
          lastForumSync: Date | null;
        };
      }) => {
        const u = users.find((x) => x.id === where.id)!;
        u.forumUserId = data.forumUserId;
        return u;
      }
    ),
  };
  // Report re-attribution (M8) runs as raw SQL after a relink; the fake has no reports table.
  const $executeRaw = jest.fn(async (_sql: TemplateStringsArray, ..._values: string[]) => 0);
  const tables = { user, forumThread: table(threads), forumPost: table(posts), $executeRaw };
  const $transaction = jest.fn(async (run: (tx: typeof tables) => Promise<object>) => run(tables));
  return {
    db: { ...tables, $transaction } as never,
    threads,
    posts,
    user,
  };
}

describe("linkOldForumAccount", () => {
  it("sets the account and attributes that XenForo user's imported content at once", async () => {
    const s = store();
    await expect(linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 77 })).resolves.toEqual({
      username: "OldTimer",
      previousXenforoUserId: null,
      released: { threads: 0, posts: 0 },
      relinked: { threads: 1, posts: 2 },
    });
    expect(s.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { forumUserId: 77, forumUsername: "OldTimer", lastForumSync: expect.any(Date) },
    });
    expect(s.threads.map((t) => t.authorUserId)).toEqual(["u1", null, "u1"]);
    expect(s.posts.map((p) => p.authorUserId)).toEqual(["u1", "u1", "u1", null]);
  });

  it("re-linking to another id hands the previous id's posts back before attributing the new one's", async () => {
    const s = store();
    await linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 77 });
    await expect(linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 88 })).resolves.toEqual({
      username: "Other",
      previousXenforoUserId: 77,
      released: { threads: 1, posts: 2 },
      relinked: { threads: 1, posts: 1 },
    });
    // 77's imported rows are back on the old name; 88's are u1's; native content is untouched.
    expect(s.threads.map((t) => t.authorUserId)).toEqual([null, "u1", "u1"]);
    expect(s.posts.map((p) => p.authorUserId)).toEqual([null, null, "u1", "u1"]);
  });

  it("takes a typed name for an id no imported post carries yet", async () => {
    const s = store();
    await expect(
      linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 99, username: " Newcomer " })
    ).resolves.toMatchObject({ username: "Newcomer", relinked: { threads: 0, posts: 0 } });
  });

  it("refuses an unknown id without a typed name, and an id another account holds", async () => {
    await expect(
      linkOldForumAccount(store().db, { userId: "u1", xenforoUserId: 99 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const taken = store({
      users: [
        { id: "u1", forumUserId: null, createdAt: new Date(0) },
        { id: "u2", forumUserId: 77, createdAt: new Date(0) },
      ],
    });
    await expect(
      linkOldForumAccount(taken.db, { userId: "u1", xenforoUserId: 77 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(taken.user.update).not.toHaveBeenCalled();
  });
});

describe("unlinkOldForumAccount", () => {
  it("hands the imported content back to the old name and leaves native content alone", async () => {
    const s = store();
    await linkOldForumAccount(s.db, { userId: "u1", xenforoUserId: 77 });
    await expect(unlinkOldForumAccount(s.db, "u1")).resolves.toEqual({
      released: { threads: 1, posts: 2 },
    });
    expect(s.threads.map((t) => t.authorUserId)).toEqual([null, null, "u1"]);
    expect(s.posts.map((p) => p.authorUserId)).toEqual([null, null, "u1", null]);
    expect(s.user.update).toHaveBeenLastCalledWith({
      where: { id: "u1" },
      data: { forumUserId: null, forumUsername: null, lastForumSync: null },
    });
  });
});
