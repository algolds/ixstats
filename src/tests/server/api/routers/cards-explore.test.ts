/** @jest-environment node */
/** cards.explore*: thin routers over the Explore module, for signed-in players. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/hub/explore", () => {
  const actual =
    jest.requireActual<typeof import("~/lib/cards/hub/explore")>("~/lib/cards/hub/explore");
  return {
    ...actual,
    exploreGrid: jest.fn(async () => ({ faces: [], total: 0, nextCursor: null })),
    exploreShelves: jest.fn(async () => []),
    exploreRegions: jest.fn(async () => ["The Pacific"]),
  };
});

import { createCallerFactory } from "~/server/api/trpc";
import { cardsExploreRouter } from "~/server/api/routers/cards/explore";
import { exploreGrid, exploreRegions, exploreShelves } from "~/lib/cards/hub/explore";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsExploreRouter);

beforeEach(() => jest.clearAllMocks());

describe("cards.explore", () => {
  it("passes the viewer to the grid and the shelves, and lists regions", async () => {
    const db = createMockPrisma();
    const caller = createCaller(
      createMockRouterContext({
        db,
        auth: { userId: "c" },
        user: { id: "db_me", clerkUserId: "c" },
      }) as never
    );
    await caller.exploreGrid({ owned: "missing" });
    expect(exploreGrid).toHaveBeenCalledWith(
      db,
      "db_me",
      expect.objectContaining({ owned: "missing", limit: 48 })
    );
    await caller.exploreShelves();
    expect(exploreShelves).toHaveBeenCalledWith(db, "db_me");
    await expect(caller.exploreRegions()).resolves.toEqual(["The Pacific"]);
    expect(exploreRegions).toHaveBeenCalledWith(db, undefined);
  });

  it("passes a trimmed region search through, and refuses one over 100 characters", async () => {
    const db = createMockPrisma();
    const caller = createCaller(
      createMockRouterContext({
        db,
        auth: { userId: "c" },
        user: { id: "db_me", clerkUserId: "c" },
      }) as never
    );
    await caller.exploreRegions({ search: "  pacific " });
    expect(exploreRegions).toHaveBeenCalledWith(db, "pacific");
    await expect(caller.exploreRegions({ search: "x".repeat(101) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses a grid query outside the schema", async () => {
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await expect(caller.exploreGrid({ limit: 500 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses signed-out callers", async () => {
    const caller = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    await expect(caller.exploreShelves()).rejects.toThrow(/Authentication required/);
    await expect(caller.exploreGrid({})).rejects.toThrow(/Authentication required/);
    await expect(caller.exploreRegions()).rejects.toThrow(/Authentication required/);
    expect(exploreShelves).not.toHaveBeenCalled();
    expect(exploreGrid).not.toHaveBeenCalled();
    expect(exploreRegions).not.toHaveBeenCalled();
  });
});
