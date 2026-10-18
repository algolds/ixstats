/** @jest-environment node */
/**
 * The Lore Archive's stash source. searchLoreArchive: a signed-out caller gets nothing, a signed-in one only their own
 * stashes (with forum threads they can no longer read left out, I5), and a lookup error falls back to an empty result.
 * fetchLoreMetadata: only the caller's own stash item is read; anyone else's, or any while signed out, is not found.
 */
jest.mock("~/server/db", () => ({ db: {}, isDatabaseReadOnly: false }));

import { loreCardsWikiRouter } from "~/server/api/routers/lore-cards/wiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
};
const savedIn = { id: "s1", name: "Reading", color: "#123456" };

const stashRow = (pageTitle: string, note: string | null) => ({
  id: `i_${pageTitle}`,
  stashId: savedIn.id,
  pageTitle,
  pageSlug: pageTitle,
  note,
  savedAt: new Date("2026-10-01T00:00:00Z"),
  stash: savedIn,
  annotations: [],
});

/** A stash database holding the rows, plus what building the member's forum viewer reads (they moderate nothing). */
const stashDb = (rows: ReturnType<typeof stashRow>[], threads: object[] = []) => ({
  stashItem: { findMany: jest.fn(async () => rows) },
  stash: { findMany: jest.fn(async () => [{ ...savedIn, _count: { items: rows.length } }]) },
  forumThread: { findMany: jest.fn(async () => threads) },
  realm: { findMany: jest.fn(async () => []) },
  realmOfficer: { findMany: jest.fn(async () => []) },
  forumCategoryModerator: { findMany: jest.fn(async () => []) },
});

const search = (db: object, signedIn: boolean) =>
  loreCardsWikiRouter
    .createCaller(
      createMockRouterContext({
        db,
        auth: signedIn ? { userId: "clerk_1" } : null,
        user: signedIn ? member : null,
      }) as never
    )
    .searchLoreArchive({ source: "stash", query: "" });

describe("loreCards.searchLoreArchive stash source", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it("returns empty items and stashes when the stash lookup rejects", async () => {
    const db = {
      stashItem: { findMany: jest.fn().mockRejectedValue(new Error("db down")) },
      stash: { findMany: jest.fn().mockRejectedValue(new Error("db down")) },
    };
    const ctx = createMockRouterContext({
      db,
      auth: { userId: "clerk_1" },
      user: { id: "u1", clerkUserId: "clerk_1" },
    });
    const caller = loreCardsWikiRouter.createCaller(ctx as never);

    await expect(caller.searchLoreArchive({ source: "stash", query: "" })).resolves.toEqual({
      items: [],
      stashes: [],
    });
  });

  it("gives a signed-out caller no stash items and no stashes, without reading any", async () => {
    const db = stashDb([stashRow("Someone_elses_page", "a private note")]);

    await expect(search(db, false)).resolves.toEqual({ items: [], stashes: [] });
    expect(db.stashItem.findMany).not.toHaveBeenCalled();
    expect(db.stash.findMany).not.toHaveBeenCalled();
  });

  it("searches only the signed-in caller's own stashes, across their linked ids", async () => {
    const db = stashDb([stashRow("Main_Page", "a wiki note")]);

    const result = await search(db, true);

    const owned = { userId: { in: ["u1", "clerk_1"] } };
    expect(db.stashItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ stash: owned }) })
    );
    expect(db.stash.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: owned }));
    expect(result.items.map((i) => [i.title, i.snippet])).toEqual([["Main_Page", "a wiki note"]]);
    expect(result.stashes).toEqual([{ ...savedIn, count: 1 }]);
  });

  it("leaves out forum threads the caller can no longer read, and shows a readable one's current title", async () => {
    const db = stashDb(
      [
        stashRow("Main_Page", "a wiki note"),
        stashRow("thinkpages:thread:t1", "Title when stashed"),
        stashRow("thinkpages:thread:gone", "A deleted thread"),
        stashRow("forum:thread:7", "A bridge-era thread"),
      ],
      [
        {
          id: "t1",
          title: "Current title",
          authorUserId: null,
          hidden: false,
          category: { id: "cat_general", scope: "site", realmId: null, visibility: "public" },
          advertRealm: null,
        },
      ]
    );

    const result = await search(db, true);

    expect(result.items.map((i) => [i.title, i.snippet])).toEqual([
      ["Main_Page", "a wiki note"],
      ["thinkpages:thread:t1", "Current title"],
    ]);
  });
});

describe("loreCards.fetchLoreMetadata stash source", () => {
  const items = [
    { id: "item-mine", note: "My note", stash: { name: "Mine", userId: "u1" }, annotations: [] },
    {
      id: "item-theirs",
      note: "Their private note",
      stash: { name: "Theirs", userId: "u2" },
      annotations: [],
    },
  ];
  type Where = { id: string; stash?: { userId: { in: string[] } } };
  /** Honours the id and, when given, the owner filter, whichever lookup the procedure uses. */
  const stashItemDb = () => {
    const lookup = jest.fn(
      async ({ where }: { where: Where }) =>
        items.find(
          (i) =>
            i.id === where.id && (!where.stash || where.stash.userId.in.includes(i.stash.userId))
        ) ?? null
    );
    return { stashItem: { findUnique: lookup, findFirst: lookup }, lookup };
  };

  const metadata = (db: object, signedIn: boolean, stashItemId: string) =>
    loreCardsWikiRouter
      .createCaller(
        createMockRouterContext({
          db,
          auth: signedIn ? { userId: "clerk_1" } : null,
          user: signedIn ? member : null,
        }) as never
      )
      .fetchLoreMetadata({ source: "stash", pageTitle: "Rome", stashItemId });

  it("reads the caller's own stash item", async () => {
    const result = await metadata(stashItemDb(), true, "item-mine");

    expect(result).toMatchObject({ excerpt: "My note", subcategory: "Mine" });
  });

  it("answers another user's item as not found", async () => {
    const notFound = await metadata(stashItemDb(), true, "item-missing");

    const result = await metadata(stashItemDb(), true, "item-theirs");

    expect(result).toEqual(notFound);
    expect(result.excerpt).not.toContain("Their private note");
  });

  it("answers a signed-out caller as not found, without reading the item", async () => {
    const notFound = await metadata(stashItemDb(), true, "item-missing");
    const db = stashItemDb();

    const result = await metadata(db, false, "item-mine");

    expect(result).toEqual(notFound);
    expect(db.lookup).not.toHaveBeenCalled();
  });
});
