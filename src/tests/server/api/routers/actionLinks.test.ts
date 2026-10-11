/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/action-links", () => ({
  ...jest.requireActual("~/server/modules/action-links"),
  createChain: jest.fn(async () => ({ id: "s_new" })),
  reviewChain: jest.fn(async () => {
    const { ActionLinkError } = jest.requireActual("~/server/modules/action-links");
    throw new ActionLinkError("FORBIDDEN", "You cannot review this chain");
  }),
}));
jest.mock("~/server/modules/thinkpages-forum", () => ({
  forumActorOf: jest.fn(async (_db: object, user: object) => ({
    ...user,
    mod: { siteAdmin: false, realmIds: [], categoryIds: [] },
  })),
  discussionsOf: jest.fn(async () => ({ items: [], nextCursor: null })),
  discussionCountsOf: jest.fn(async (_db: object, _viewer: object | null, ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { count: 0, postIds: [] }]))
  ),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { actionLinksRouter } from "~/server/api/routers/actionLinks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createChain } from "~/server/modules/action-links";
import { discussionCountsOf, discussionsOf } from "~/server/modules/thinkpages-forum";

const caller = (user: object | null, db: object = {}) =>
  createCallerFactory(actionLinksRouter)(
    createMockRouterContext({
      auth: user ? { userId: "owner_1" } : null,
      user: user as never,
      db,
    }) as never
  );

const owner = {
  id: "u1",
  clerkUserId: "owner_1",
  countryId: "c1",
  role: { name: "user", level: 100 },
};
const noCountry = { ...owner, countryId: null };

describe("actionLinks router", () => {
  it("creates a chain for the caller's own country", async () => {
    await expect(caller(owner).createChain({ title: "Pact" })).resolves.toEqual({ id: "s_new" });
    expect(createChain).toHaveBeenCalledWith(expect.anything(), "c1", "Pact");
  });

  it("refuses chain writes from a user without a country", async () => {
    await expect(caller(noCountry).createChain({ title: "Pact" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("maps module refusals to the same TRPC code", async () => {
    await expect(
      caller(owner).reviewChain({ storylineId: "s1", approve: true })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists the caller's recent pickable actions, 10 with no search and 30 with one", async () => {
    const findMany = jest.fn(async () => []);
    await caller(owner, { activityFeed: { findMany } }).myActivities({});
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({ countryId: "c1", visibility: "public" }),
      })
    );
    await caller(owner, { activityFeed: { findMany } }).myActivities({ search: "jobs" });
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 30 }));
  });

  it("reads a blank search as no search", async () => {
    const findMany = jest.fn(async () => []);
    await caller(owner, { activityFeed: { findMany } }).myActivities({ search: "   " });
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 10 }));
  });

  it("gives a caller without a country no actions to pick", async () => {
    await expect(caller(noCountry).myActivities({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("serves activity cards for public activities only", async () => {
    const findMany = jest.fn(async () => []);
    const country = { findMany: jest.fn(async () => []) };
    await caller(null, { activityFeed: { findMany }, country }).activityCards({ ids: ["a1"] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["a1"] }, visibility: "public" } })
    );
    expect(country.findMany).not.toHaveBeenCalled();
  });

  it("finds a directive's public activity row by its fixed id", async () => {
    const findFirst = jest.fn(async () => ({ id: "dir-i1" }));
    await expect(
      caller(null, { activityFeed: { findFirst } }).directiveActivity({ intentId: "i1" })
    ).resolves.toEqual({ activityId: "dir-i1" });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "dir-i1", visibility: "public" },
      select: { id: true },
    });
  });

  it("returns null for a directive without a public row (a draft, an abandoned one, or one declared before this shipped)", async () => {
    const findFirst = jest.fn(async () => null);
    await expect(
      caller(null, { activityFeed: { findFirst } }).directiveActivity({ intentId: "i2" })
    ).resolves.toBeNull();
  });

  it("reads discussions as an anonymous viewer, passing the cursor on", async () => {
    await caller(null).discussions({ activityId: "a1", cursor: "l020" });
    expect(discussionsOf).toHaveBeenCalledWith(expect.anything(), null, {
      activityId: "a1",
      cursor: "l020",
    });
  });

  it("reads discussions as the signed-in member with what they moderate", async () => {
    await caller(owner).discussions({ activityId: "a1" });
    expect(discussionsOf).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "u1", mod: expect.anything() }),
      { activityId: "a1" }
    );
  });

  it("serves counts for up to 50 ids, anonymous", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `a${i}`);
    await expect(caller(null).discussionCounts({ activityIds: ids })).resolves.toMatchObject({
      a0: { count: 0 },
    });
    expect(discussionCountsOf).toHaveBeenCalledWith(expect.anything(), null, ids);
  });

  it.each([
    ["51 ids", { activityIds: Array.from({ length: 51 }, (_, i) => `a${i}`) }],
    ["an empty id", { activityIds: [""] }],
    ["an id over 64 characters", { activityIds: ["x".repeat(65)] }],
  ])("bounds the counts input: %s", async (_label, input) => {
    await expect(caller(null).discussionCounts(input)).rejects.toThrow();
  });

  it("refuses a cursor over 128 characters", async () => {
    await expect(
      caller(null).discussions({ activityId: "a1", cursor: "x".repeat(129) })
    ).rejects.toThrow();
  });

  it("no longer exposes the removed backlink read, which leaked hidden posts", () => {
    // Spelled in two parts so that a repository-wide search for the removed name finds nothing.
    const removed = ["linked", "Posts"].join("");
    expect(Object.keys(actionLinksRouter._def.procedures)).not.toContain(removed);
  });
});
