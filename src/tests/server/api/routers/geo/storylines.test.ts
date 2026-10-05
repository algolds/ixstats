/** @jest-environment node */
/**
 * AT-14: a country's owner creates, renames and deletes storylines and puts their own story pins
 * into them; no one can touch another country's storylines, and a pin can only join a storyline
 * of its own country.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/map-update-bus", () => ({ broadcastMapUpdate: jest.fn() }));
jest.mock("~/lib/maps/geo-validation", () => ({
  validatePointContainment: jest.fn().mockResolvedValue(undefined),
  checkNameUniqueness: jest.fn().mockResolvedValue(undefined),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { geoFeaturesStorylinesRouter } from "~/server/api/routers/geo/features/storylines";
import { geoFeaturesStoryPinsRouter } from "~/server/api/routers/geo/features/storyPins";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const COUNTRY = { id: "c1", name: "Aurelia", slug: "aurelia", flag: null };
const owner = {
  id: "u_owner",
  clerkUserId: "owner_1",
  countryId: "c1",
  role: { name: "user", level: 100 },
  country: COUNTRY,
};
const admin = {
  id: "u_admin",
  clerkUserId: "admin_1",
  countryId: null,
  role: { name: "admin", level: 10 },
  country: null,
};
type Who = typeof owner | typeof admin;

/** Storyline "s1" and pin "p1" belong to c1; anything else is not found for c1. */
function setup() {
  const inC1 = (id: string, mine: string) => (where: { id: string; countryId?: string }) =>
    where.id === mine && (where.countryId === undefined || where.countryId === "c1")
      ? { id: mine, countryId: "c1" }
      : null;
  return {
    user: {
      findUnique: jest.fn(async () => ({ id: "u_owner", countryId: "c1", role: { name: "user" } })),
    },
    country: { findUnique: jest.fn(async () => ({ id: "c1" })) },
    storyline: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; countryId?: string } }) =>
        inC1("s", "s1")(where)
      ),
      findMany: jest.fn(async () => [{ id: "s1", title: "Founding", pins: [] }]),
      create: jest.fn(async ({ data }: { data: { title: string } }) => ({
        id: "s_new",
        title: data.title,
      })),
      update: jest.fn(async () => ({ id: "s1", title: "Renamed" })),
      delete: jest.fn(async (_args: object) => ({})),
    },
    storyPin: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; countryId?: string } }) =>
        inC1("p", "p1")(where)
      ),
      findMany: jest.fn(async () => [{ id: "p2", title: "Loose pin", ixTimeYear: null }]),
      aggregate: jest.fn(async (_args: object) => ({ _max: { storylineOrder: 2 } })),
      update: jest.fn(async (_args: object) => ({})),
      updateMany: jest.fn(async (_args: object) => ({ count: 1 })),
      create: jest.fn(async () => ({ id: "p_new", title: "New" })),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
}

function ctx(db: unknown, user: Who) {
  return createMockRouterContext({
    db,
    auth: { userId: user.clerkUserId },
    user,
    rateLimitIdentifier: `${user.clerkUserId}_${Math.random()}`,
  }) as never;
}

const storylines = (db: unknown, user: Who = owner) =>
  createCallerFactory(geoFeaturesStorylinesRouter)(ctx(db, user));
const pins = (db: unknown, user: Who = owner) =>
  createCallerFactory(geoFeaturesStoryPinsRouter)(ctx(db, user));

describe("storylines (AT-14)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("the owner creates a storyline in their own country", async () => {
    const db = setup();
    const res = await storylines(db).createStoryline({
      countryId: "c1",
      title: "  Founding Wars ",
      color: "#aa3300",
    });
    expect(res).toEqual({ id: "s_new", title: "Founding Wars" });
    expect(db.storyline.create).toHaveBeenCalledWith({
      data: { countryId: "c1", title: "Founding Wars", description: null, color: "#aa3300" },
    });
    expect(broadcastMapUpdate).toHaveBeenCalledWith("storyPin", "c1");
  });

  it("rejects a storyline in another country and a bad colour", async () => {
    const db = setup();
    await expect(
      storylines(db).createStoryline({ countryId: "c2", title: "Theirs" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      storylines(db).createStoryline({ countryId: "c1", title: "X", color: "red" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.storyline.create).not.toHaveBeenCalled();
  });

  it("updates only a storyline of the country", async () => {
    const db = setup();
    await storylines(db).updateStoryline({
      countryId: "c1",
      storylineId: "s1",
      title: "Renamed",
      color: null,
    });
    expect(db.storyline.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { title: "Renamed", color: null },
    });

    await expect(
      storylines(db).updateStoryline({ countryId: "c1", storylineId: "s_other", title: "No" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.storyline.update).toHaveBeenCalledTimes(1);
  });

  it("deleting a storyline keeps its pins, out of any storyline", async () => {
    const db = setup();
    await storylines(db).deleteStoryline({ countryId: "c1", storylineId: "s1" });
    expect(db.storyPin.updateMany).toHaveBeenCalledWith({
      where: { storylineId: "s1" },
      data: { storylineId: null, storylineOrder: null },
    });
    expect(db.storyline.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(db.$transaction).toHaveBeenCalled();
  });

  it("adds a pin after the storyline's last one, or at the given order", async () => {
    const db = setup();
    const res = await storylines(db).addPinToStoryline({
      countryId: "c1",
      storylineId: "s1",
      pinId: "p1",
    });
    expect(res.order).toBe(3);
    expect(db.storyPin.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { storylineId: "s1", storylineOrder: 3 },
    });

    await storylines(db).addPinToStoryline({
      countryId: "c1",
      storylineId: "s1",
      pinId: "p1",
      order: 0,
    });
    expect(db.storyPin.update).toHaveBeenLastCalledWith({
      where: { id: "p1" },
      data: { storylineId: "s1", storylineOrder: 0 },
    });
  });

  it("will not add another country's pin or use another country's storyline", async () => {
    const db = setup();
    await expect(
      storylines(db).addPinToStoryline({ countryId: "c1", storylineId: "s1", pinId: "p_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      storylines(db).addPinToStoryline({ countryId: "c1", storylineId: "s_other", pinId: "p1" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      storylines(db).addPinToStoryline({ countryId: "c2", storylineId: "s1", pinId: "p1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.storyPin.update).not.toHaveBeenCalled();
  });

  it("removes a pin from its storyline", async () => {
    const db = setup();
    await storylines(db).removePinFromStoryline({ countryId: "c1", pinId: "p1" });
    expect(db.storyPin.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { storylineId: null, storylineOrder: null },
    });
  });

  it("lists the country's storylines and loose pins for the owner and admins only", async () => {
    const db = setup();
    const res = await storylines(db).getCountryStorylines({ countryId: "c1" });
    expect(res.storylines).toHaveLength(1);
    expect(res.unassignedPins).toEqual([{ id: "p2", title: "Loose pin", ixTimeYear: null }]);
    await expect(
      storylines(db, admin).getCountryStorylines({ countryId: "c1" })
    ).resolves.toBeDefined();
    await expect(storylines(db).getCountryStorylines({ countryId: "c2" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("an admin may edit any country's storylines", async () => {
    const db = setup();
    await expect(
      storylines(db, admin).createStoryline({ countryId: "c1", title: "Admin" })
    ).resolves.toBeDefined();
  });

  it("createStoryPin and updateStoryPin refuse a storyline of another country", async () => {
    const db = setup();
    const base = {
      countryId: "c1",
      title: "Battle",
      content: "It happened",
      category: "battle" as const,
      coordinates: [1, 2] as [number, number],
    };
    await expect(
      pins(db).createStoryPin({ ...base, storylineId: "s_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.storyPin.create).not.toHaveBeenCalled();

    await pins(db).createStoryPin({ ...base, storylineId: "s1", storylineOrder: 0 });
    expect(db.storyPin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ storylineId: "s1", storylineOrder: 0 }),
      })
    );

    await expect(
      pins(db).updateStoryPin({ countryId: "c1", pinId: "p1", storylineId: "s_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.storyPin.update).not.toHaveBeenCalled();
  });
});
