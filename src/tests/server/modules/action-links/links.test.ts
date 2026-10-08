/** @jest-environment node */
import {
  ActionLinkError,
  linkedPosts,
  syncPostActionLinks,
  validatePostActionTokens,
} from "~/server/modules/action-links";
import { MAX_ACTIONS_PER_POST } from "~/lib/action-links";

type Row = { id: string; countryId: string; visibility: string };

function fakeDb(activities: Row[]) {
  const tx = {
    postActionLink: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  return {
    tx,
    db: {
      activityFeed: {
        findMany: jest.fn(async ({ where }: { where: { id: { in: string[] }; countryId: string; visibility: string } }) =>
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
      postActionLink: {
        findMany: jest.fn(async () => [{ postSource: "native", postRef: "p1" }]),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    },
  };
}

const POST = { postSource: "native" as const, postRef: "p1", countryId: "c1" };

describe("syncPostActionLinks", () => {
  it("links the poster's own public actions", async () => {
    const { db, tx } = fakeDb([{ id: "a1", countryId: "c1", visibility: "public" }]);
    await expect(syncPostActionLinks(db as never, { ...POST, body: "[ixaction=a1]" })).resolves.toEqual(["a1"]);
    expect(tx.postActionLink.createMany).toHaveBeenCalledWith({
      data: [{ postSource: "native", postRef: "p1", activityId: "a1", countryId: "c1" }],
      skipDuplicates: true,
    });
  });

  it("rejects another country's action", async () => {
    const { db } = fakeDb([{ id: "a2", countryId: "c2", visibility: "public" }]);
    await expect(syncPostActionLinks(db as never, { ...POST, body: "[ixaction=a2]" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects a private action of the poster's own country", async () => {
    const { db } = fakeDb([{ id: "a3", countryId: "c1", visibility: "private" }]);
    await expect(syncPostActionLinks(db as never, { ...POST, body: "[ixaction=a3]" })).rejects.toBeInstanceOf(
      ActionLinkError
    );
  });

  it("rejects more than the per-post cap", async () => {
    const { db } = fakeDb([]);
    const body = Array.from({ length: MAX_ACTIONS_PER_POST + 1 }, (_, i) => `[ixaction=a${i}]`).join("");
    await expect(syncPostActionLinks(db as never, { ...POST, body })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("forbids links from a poster with no country", async () => {
    const { db } = fakeDb([]);
    await expect(
      syncPostActionLinks(db as never, { ...POST, countryId: null, body: "[ixaction=a1]" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps surviving links (and their chain membership) and only deletes removed ones", async () => {
    const { db, tx } = fakeDb([{ id: "a1", countryId: "c1", visibility: "public" }]);
    await syncPostActionLinks(db as never, { ...POST, body: "[ixaction=a1]" });
    expect(tx.postActionLink.deleteMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: "p1", activityId: { notIn: ["a1"] } },
    });
  });

  it("removes every link when the edit drops all tokens", async () => {
    const { db, tx } = fakeDb([]);
    await expect(syncPostActionLinks(db as never, { ...POST, body: "no tokens" })).resolves.toEqual([]);
    expect(tx.postActionLink.deleteMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: "p1", activityId: { notIn: [] } },
    });
    expect(tx.postActionLink.createMany).not.toHaveBeenCalled();
  });
});

describe("validatePostActionTokens", () => {
  it("returns the owned token ids without writing anything", async () => {
    const { db, tx } = fakeDb([{ id: "a1", countryId: "c1", visibility: "public" }]);
    await expect(validatePostActionTokens(db as never, { countryId: "c1", body: "[ixaction=a1]" })).resolves.toEqual([
      "a1",
    ]);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.postActionLink.createMany).not.toHaveBeenCalled();
  });

  it("skips the ownership query for a body with no tokens", async () => {
    const { db } = fakeDb([]);
    await expect(validatePostActionTokens(db as never, { countryId: null, body: "plain" })).resolves.toEqual([]);
    expect(db.activityFeed.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["another country's action", "c1", "[ixaction=a2]", "BAD_REQUEST"],
    ["a poster with no country", null, "[ixaction=a1]", "FORBIDDEN"],
  ])("refuses %s", async (_label, countryId, body, code) => {
    const { db } = fakeDb([{ id: "a2", countryId: "c2", visibility: "public" }]);
    await expect(validatePostActionTokens(db as never, { countryId, body })).rejects.toMatchObject({ code });
  });
});

describe("linkedPosts", () => {
  it("lists the posts discussing an activity", async () => {
    const { db } = fakeDb([]);
    await expect(linkedPosts(db as never, "a1")).resolves.toEqual([{ postSource: "native", postRef: "p1" }]);
  });
});
