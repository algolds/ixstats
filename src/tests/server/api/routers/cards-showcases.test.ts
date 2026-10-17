/** @jest-environment node */
/** cards showcase procedures: the caller acts on their own showcases; others' are read through the passport switch. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/hub/showcases", () => {
  const actual = jest.requireActual<typeof import("~/lib/cards/hub/showcases")>(
    "~/lib/cards/hub/showcases"
  );
  return {
    ...actual,
    listMyShowcases: jest.fn(async () => []),
    getShowcase: jest.fn(async () => null),
    myDisplay: jest.fn(async () => ({ showcase: null, faces: [] })),
    createShowcase: jest.fn(async () => ({ id: "s1" })),
    updateShowcase: jest.fn(async () => undefined),
    deleteShowcase: jest.fn(async () => undefined),
    addToShowcase: jest.fn(async () => ({ added: 1 })),
    removeFromShowcase: jest.fn(async () => undefined),
    pinShowcase: jest.fn(async () => undefined),
  };
});
jest.mock("~/server/api/routers/cards/_passport", () => ({
  vaultVisible: jest.fn(async () => true),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsShowcasesRouter } from "~/server/api/routers/cards/showcases";
import {
  addToShowcase,
  createShowcase,
  deleteShowcase,
  getShowcase,
  listMyShowcases,
  myDisplay,
  pinShowcase,
  removeFromShowcase,
  updateShowcase,
} from "~/lib/cards/hub/showcases";
import { vaultVisible } from "~/server/api/routers/cards/_passport";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsShowcasesRouter);
const callerFor = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({
      db,
      user: { id: "db_me", clerkUserId: "c" },
      rateLimitIdentifier: `me_${Math.random()}`,
    }) as never
  );

beforeEach(() => jest.clearAllMocks());

describe("cards showcases router", () => {
  it("reads a showcase with the passport switch", async () => {
    const db = createMockPrisma();
    await callerFor(db).getShowcase({ showcaseId: "s1" });
    expect(getShowcase).toHaveBeenCalledWith(db, "db_me", "s1", { vaultVisible });
  });

  it("adds copies as the caller, and refuses an empty pick", async () => {
    const db = createMockPrisma();
    await callerFor(db).addToShowcase({ showcaseId: "s1", ownershipIds: ["o1"] });
    expect(addToShowcase).toHaveBeenCalledWith(db, "db_me", "s1", ["o1"]);
    await expect(
      callerFor().addToShowcase({ showcaseId: "s1", ownershipIds: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(addToShowcase).toHaveBeenCalledTimes(1);
  });

  it("lists the caller's showcases and display", async () => {
    const db = createMockPrisma();
    await expect(callerFor(db).listMyShowcases()).resolves.toEqual([]);
    expect(listMyShowcases).toHaveBeenCalledWith(db, "db_me");
    await expect(callerFor(db).getMyDisplay()).resolves.toEqual({ showcase: null, faces: [] });
    expect(myDisplay).toHaveBeenCalledWith(db, "db_me");
  });

  it("creates, deletes and removes copies as the caller", async () => {
    const db = createMockPrisma();
    await expect(callerFor(db).createShowcase({ name: "Best" })).resolves.toEqual({ id: "s1" });
    expect(createShowcase).toHaveBeenCalledWith(db, "db_me", { name: "Best", isPublic: false });
    await callerFor(db).deleteShowcase({ showcaseId: "s1" });
    expect(deleteShowcase).toHaveBeenCalledWith(db, "db_me", "s1");
    await callerFor(db).removeFromShowcase({ showcaseId: "s1", ownershipId: "o1" });
    expect(removeFromShowcase).toHaveBeenCalledWith(db, "db_me", "s1", "o1");
  });

  it("edits and pins as the caller", async () => {
    const db = createMockPrisma();
    await callerFor(db).updateShowcase({ showcaseId: "s1", name: " Best ", isPublic: true });
    expect(updateShowcase).toHaveBeenCalledWith(db, "db_me", "s1", {
      name: "Best",
      isPublic: true,
    });
    await callerFor(db).pinShowcase({ showcaseId: "s1", pinned: true });
    expect(pinShowcase).toHaveBeenCalledWith(db, "db_me", "s1", true);
  });

  it("refuses signed-out callers", async () => {
    const caller = createCaller(createMockRouterContext({ auth: null, user: null }) as never);
    await expect(caller.listMyShowcases()).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    await expect(caller.getShowcase({ showcaseId: "s1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    expect(getShowcase).not.toHaveBeenCalled();
  });
});
