/** @jest-environment node */
import { syncEditLinks, validateEditLinks } from "~/server/modules/thinkpages-forum/writes-links";
import type { ForumActor, WritesDb } from "~/server/modules/thinkpages-forum/writes";

type Activity = { id: string; countryId: string; visibility: string };

function fakeDb(activities: Activity[]) {
  const tx = {
    postActionLink: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createManyAndReturn: jest.fn(async (args: { data: Array<{ activityId: string }> }) =>
        args.data.map((d) => ({ activityId: d.activityId }))
      ),
    },
  };
  const db = {
    activityFeed: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: { id: { in: string[] }; countryId: string; visibility: string };
        }) =>
          activities
            .filter(
              (a) =>
                where.id.in.includes(a.id) &&
                a.countryId === where.countryId &&
                a.visibility === where.visibility
            )
            .map((a) => ({ id: a.id }))
      ),
    },
    $transaction: jest.fn(async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx)),
  };
  return { db: db as never as WritesDb, tx };
}

const AUTHOR = { id: "u1", countryId: "c1" } as never as ForumActor;
const POST = { id: "p1", authorUserId: "u1", plainText: "first draft [ixaction=dir-1]" };
const WITHDRAWN: Activity = { id: "dir-1", countryId: "c1", visibility: "private" };

describe("an author's edit of a post that already links an action", () => {
  it("accepts a token the post already had even when the action has gone private", async () => {
    const { db } = fakeDb([WITHDRAWN]);
    await expect(
      validateEditLinks(db, AUTHOR, POST, "fixed typo [ixaction=dir-1]")
    ).resolves.toBeUndefined();
  });

  it("still refuses a new token that is not one of the nation's public actions", async () => {
    const { db } = fakeDb([WITHDRAWN]);
    await expect(
      validateEditLinks(db, AUTHOR, POST, "fixed typo [ixaction=dir-1] [ixaction=dir-2]")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps the existing link when the sync runs after such an edit", async () => {
    const { db, tx } = fakeDb([WITHDRAWN]);
    await syncEditLinks(db, AUTHOR, POST, "fixed typo [ixaction=dir-1]");
    expect(tx.postActionLink.deleteMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: "p1", activityId: { notIn: ["dir-1"] } },
    });
    expect(tx.postActionLink.createManyAndReturn).not.toHaveBeenCalled();
  });

  it("links a new public token added in the same edit", async () => {
    const { db, tx } = fakeDb([WITHDRAWN, { id: "dir-2", countryId: "c1", visibility: "public" }]);
    await syncEditLinks(db, AUTHOR, POST, "[ixaction=dir-1] [ixaction=dir-2]");
    expect(tx.postActionLink.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ postSource: "native", postRef: "p1", activityId: "dir-2", countryId: "c1" }],
      })
    );
  });
});
