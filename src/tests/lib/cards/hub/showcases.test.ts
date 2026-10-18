/** @jest-environment node */
/** Free-form showcases (spec §2.2 Collections, §2.3 Sets): by copy, owner-only edits, public only by the owner's leave. */
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  addToShowcase,
  createShowcase,
  deleteShowcase,
  getShowcase,
  listMyShowcases,
  myDisplay,
  pinShowcase,
  removeFromShowcase,
  SHOWCASE_LIMITS,
  ShowcaseFieldsSchema,
  updateShowcase,
} from "~/lib/cards/hub/showcases";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const card = (id: string, isRetired = false) => ({
  id,
  title: id,
  rarity: "RARE",
  cardType: "LORE",
  artwork: `https://art/${id}.png`,
  isRetired,
  collectorNumber: 1,
  season: 1,
  nsSeason: null,
  realm,
});
const copy = (id: string, isRetired = false) => ({
  id: `o-${id}`,
  finish: "STANDARD",
  serialNumber: 1,
  level: 1,
  cards: card(id, isRetired),
});
const item = (id: string, isRetired = false) => ({
  id: `item-${id}`,
  cardOwnership: copy(id, isRetired),
});
/** The owner by passport handle (a wiki name; they have no stored handle), showing or hiding their Vault cards. */
const ownerShowing = (showsVault: boolean) => ({
  playersOf: jest.fn(async () => new Map([["owner", { handle: "Takatta Loa", showsVault }]])),
});
const visible = ownerShowing(true);
const hidden = ownerShowing(false);
const owned = (isPublic: boolean, items = 1) => ({ id: "s1", isPublic, _count: { items } });

describe("ShowcaseFieldsSchema", () => {
  it("trims, keeps the old collection bounds on the name and description, and starts private", () => {
    expect(ShowcaseFieldsSchema.parse({ name: "  Best  " })).toEqual({
      name: "Best",
      isPublic: false,
    });
    expect(ShowcaseFieldsSchema.safeParse({ name: " " }).success).toBe(false);
    const fits = { name: "x".repeat(100), description: "y".repeat(500) };
    expect(SHOWCASE_LIMITS).toMatchObject({ name: 100, description: 500 });
    expect(ShowcaseFieldsSchema.safeParse(fits).success).toBe(true);
    expect(ShowcaseFieldsSchema.safeParse({ ...fits, name: "x".repeat(101) }).success).toBe(false);
    expect(ShowcaseFieldsSchema.safeParse({ ...fits, description: "y".repeat(501) }).success).toBe(
      false
    );
  });
});

describe("listMyShowcases", () => {
  it("lists the player's showcases with a cover and marks only the latest public pin", async () => {
    const db = createMockPrisma();
    db.cardCollection.findMany.mockResolvedValue([
      {
        id: "s1",
        name: "A",
        description: null,
        isPublic: true,
        pinnedAt: new Date(2),
        _count: { items: 3 },
        items: [item("c1")],
      },
      {
        id: "s2",
        name: "B",
        description: null,
        isPublic: true,
        pinnedAt: new Date(1),
        _count: { items: 0 },
        items: [],
      },
      {
        id: "s3",
        name: "C",
        description: "Mine",
        isPublic: false,
        pinnedAt: new Date(3),
        _count: { items: 1 },
        items: [item("c2", true)],
      },
    ]);
    const list = await listMyShowcases(db as never, "u1");
    expect(list.map((s) => [s.id, s.pinned, s.itemCount, s.cover?.artwork ?? null])).toEqual([
      ["s1", true, 3, "https://art/c1.png"],
      ["s2", false, 0, null],
      ["s3", false, 1, null],
    ]);
    expect(db.cardCollection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      })
    );
  });

  it("marks none pinned when nothing is", async () => {
    const db = createMockPrisma();
    const unpinned = {
      name: "A",
      description: null,
      pinnedAt: null,
      _count: { items: 0 },
      items: [],
    };
    db.cardCollection.findMany.mockResolvedValue([
      { ...unpinned, id: "s1", isPublic: true },
      { ...unpinned, id: "s2", isPublic: false },
    ]);
    const list = await listMyShowcases(db as never, "u1");
    expect(list.map((s) => s.pinned)).toEqual([false, false]);
  });
});

describe("getShowcase", () => {
  beforeEach(() => jest.clearAllMocks());

  const row = {
    id: "s1",
    name: "A",
    description: "Mine",
    isPublic: true,
    pinnedAt: null,
    userId: "owner",
    items: [item("c1"), item("c2", true)],
  };

  it("shows a public showcase's art to anyone while its owner shows Vault cards, by their passport handle", async () => {
    const db = createMockPrisma();
    db.cardCollection.findUnique.mockResolvedValue(row);
    const view = await getShowcase(db as never, "me", "s1", visible);
    expect(view).toMatchObject({
      ownerHandle: "Takatta Loa",
      isOwner: false,
      pinned: false,
      items: [{ itemId: "item-c1", face: { artwork: "https://art/c1.png", silhouette: false } }],
    });
    expect(visible.playersOf).toHaveBeenCalledWith(["owner"]);
    expect(db.cardCollection.findUnique).toHaveBeenCalledWith({
      where: { id: "s1" },
      select: expect.objectContaining({
        items: expect.objectContaining({
          orderBy: { addedAt: "asc" },
          take: SHOWCASE_LIMITS.items,
        }),
      }),
    });
  });

  it("leaves another player's retired copies out, and shows its owner their placeholder faces", async () => {
    const db = createMockPrisma();
    db.cardCollection.findUnique.mockResolvedValue(row);
    const theirs = await getShowcase(db as never, "me", "s1", visible);
    expect(theirs!.items.map((i) => i.itemId)).toEqual(["item-c1"]);
    const mine = await getShowcase(db as never, "owner", "s1", hidden);
    expect(mine!.items).toMatchObject([
      { itemId: "item-c1", face: { artwork: "https://art/c1.png" } },
      { itemId: "item-c2", face: { artwork: null, isRetired: true } },
    ]);
  });

  it("hides a private showcase, and every showcase of an owner who hides Vault cards, from others", async () => {
    const db = createMockPrisma();
    db.cardCollection.findUnique.mockResolvedValue({ ...row, isPublic: false });
    await expect(getShowcase(db as never, "me", "s1", visible)).resolves.toBeNull();
    expect(visible.playersOf).not.toHaveBeenCalled();
    db.cardCollection.findUnique.mockResolvedValue(row);
    await expect(getShowcase(db as never, "me", "s1", hidden)).resolves.toBeNull();
    await expect(getShowcase(db as never, "owner", "s1", hidden)).resolves.toMatchObject({
      isOwner: true,
      ownerHandle: null,
    });
    db.cardCollection.findUnique.mockResolvedValue(null);
    await expect(getShowcase(db as never, "me", "s9", visible)).resolves.toBeNull();
  });

  it("hides a showcase whose owner is gone", async () => {
    const db = createMockPrisma();
    db.cardCollection.findUnique.mockResolvedValue(row);
    const gone = { playersOf: jest.fn(async () => new Map()) };
    await expect(getShowcase(db as never, "me", "s1", gone)).resolves.toBeNull();
  });

  it("never calls a private showcase pinned", async () => {
    const db = createMockPrisma();
    db.cardCollection.findUnique.mockResolvedValue({ ...row, pinnedAt: new Date(1) });
    await expect(getShowcase(db as never, "owner", "s1", hidden)).resolves.toMatchObject({
      pinned: true,
    });
    db.cardCollection.findUnique.mockResolvedValue({
      ...row,
      isPublic: false,
      pinnedAt: new Date(1),
    });
    await expect(getShowcase(db as never, "owner", "s1", hidden)).resolves.toMatchObject({
      pinned: false,
    });
  });
});

describe("editing", () => {
  it("caps how many showcases a player keeps", async () => {
    const db = createMockPrisma();
    db.cardCollection.count.mockResolvedValue(SHOWCASE_LIMITS.perPlayer);
    await expect(
      createShowcase(db as never, "u1", { name: "x", isPublic: false })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.cardCollection.create).not.toHaveBeenCalled();
  });

  it("creates a showcase for the player, an empty description as none", async () => {
    const db = createMockPrisma();
    db.cardCollection.count.mockResolvedValue(0);
    db.cardCollection.create.mockResolvedValue({ id: "s1" });
    await expect(
      createShowcase(db as never, "u1", { name: "Best", description: "", isPublic: true })
    ).resolves.toEqual({ id: "s1" });
    expect(db.cardCollection.create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "Best", description: null, isPublic: true },
      select: { id: true },
    });
  });

  it("edits only the player's own showcase", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(null);
    await expect(
      updateShowcase(db as never, "u1", "s9", { name: "x", isPublic: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteShowcase(db as never, "u1", "s9")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardCollection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s9", userId: "u1" } })
    );
    expect(db.cardCollection.update).not.toHaveBeenCalled();
    expect(db.cardCollection.delete).not.toHaveBeenCalled();
  });

  it("keeps a public showcase's pin, and unpins a showcase made private", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(true));
    await updateShowcase(db as never, "u1", "s1", { name: "A", description: "Hi", isPublic: true });
    expect(db.cardCollection.update).toHaveBeenLastCalledWith({
      where: { id: "s1" },
      data: { name: "A", description: "Hi", isPublic: true, updatedAt: expect.any(Date) },
    });
    await updateShowcase(db as never, "u1", "s1", { name: "A", isPublic: false });
    expect(db.cardCollection.update).toHaveBeenLastCalledWith({
      where: { id: "s1" },
      data: {
        name: "A",
        description: null,
        isPublic: false,
        pinnedAt: null,
        updatedAt: expect.any(Date),
      },
    });
  });

  it("deletes the player's own showcase", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false));
    await deleteShowcase(db as never, "u1", "s1");
    expect(db.cardCollection.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("adds only copies the player holds, once each, to a showcase they own", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false, 1));
    db.cardOwnership.findMany.mockResolvedValue([{ id: "o1" }, { id: "o2" }]);
    db.cardCollectionItem.createMany.mockResolvedValue({ count: 2 });
    await expect(addToShowcase(db as never, "u1", "s1", ["o1", "o2", "o1"])).resolves.toEqual({
      added: 2,
    });
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["o1", "o2"] }, ownerId: "u1" },
      select: { id: true },
    });
    expect(db.cardCollectionItem.createMany).toHaveBeenCalledWith({
      data: [
        { collectionId: "s1", cardOwnershipId: "o1" },
        { collectionId: "s1", cardOwnershipId: "o2" },
      ],
      skipDuplicates: true,
    });
    expect(db.cardCollection.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it("fills a showcase up to its limit", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false, SHOWCASE_LIMITS.items - 1));
    db.cardOwnership.findMany.mockResolvedValue([{ id: "o1" }]);
    db.cardCollectionItem.createMany.mockResolvedValue({ count: 1 });
    await expect(addToShowcase(db as never, "u1", "s1", ["o1"])).resolves.toEqual({ added: 1 });
  });

  it("refuses a copy that is not the player's, another player's showcase, and a full showcase", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false, 0));
    db.cardOwnership.findMany.mockResolvedValue([{ id: "o1" }]);
    await expect(addToShowcase(db as never, "u1", "s1", ["o1", "theirs"])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    db.cardCollection.findFirst.mockResolvedValue(owned(false, SHOWCASE_LIMITS.items));
    await expect(addToShowcase(db as never, "u1", "s1", ["o1"])).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    db.cardCollection.findFirst.mockResolvedValue(null);
    await expect(addToShowcase(db as never, "u1", "s9", ["o1"])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(removeFromShowcase(db as never, "u1", "s9", "o1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardCollectionItem.createMany).not.toHaveBeenCalled();
    expect(db.cardCollectionItem.deleteMany).not.toHaveBeenCalled();
  });

  it("removes a copy from the player's own showcase", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false));
    await removeFromShowcase(db as never, "u1", "s1", "o1");
    expect(db.cardCollectionItem.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: "s1", cardOwnershipId: "o1" },
    });
    expect(db.cardCollection.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { updatedAt: expect.any(Date) },
    });
  });
});

interface PinRow {
  id: string;
  userId: string;
  isPublic: boolean;
  pinnedAt: Date | null;
}
interface PinWhere {
  id?: string;
  userId?: string;
  isPublic?: boolean;
  pinnedAt?: { not: null };
}
const pinRow = (id: string, pinnedAt: Date | null, userId = "u1"): PinRow => ({
  id,
  userId,
  isPublic: true,
  pinnedAt,
});
const pinMatches = (row: PinRow, where: PinWhere) =>
  (where.id === undefined || row.id === where.id) &&
  (where.userId === undefined || row.userId === where.userId) &&
  (where.isPublic === undefined || row.isPublic === where.isPublic) &&
  (where.pinnedAt === undefined || row.pinnedAt !== null);

/** A mock whose `updateMany` edits `rows` in place, for the filters pinShowcase writes. */
function pinDb(rows: PinRow[]) {
  const db = createMockPrisma();
  db.cardCollection.updateMany.mockImplementation(
    async ({ where, data }: { where: PinWhere; data: { pinnedAt: Date | null } }) => {
      const hit = rows.filter((row) => pinMatches(row, where));
      for (const row of hit) row.pinnedAt = data.pinnedAt;
      return { count: hit.length };
    }
  );
  return db;
}

describe("pinShowcase", () => {
  it("pins one public showcase at a time", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({ ...owned(true), id: "s2" });
    db.cardCollection.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    await expect(pinShowcase(db as never, "u1", "s2", true)).resolves.toEqual({ pinned: true });
    expect(db.cardCollection.updateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: "u1", pinnedAt: { not: null } },
      data: { pinnedAt: null },
    });
    expect(db.cardCollection.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "s2", isPublic: true },
      data: { pinnedAt: expect.any(Date) },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("says the pin did not land when the showcase was made private meanwhile", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(true));
    db.cardCollection.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await expect(pinShowcase(db as never, "u1", "s1", true)).resolves.toEqual({ pinned: false });
  });

  it("unpins, a private showcase too, without pinning another", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false));
    db.cardCollection.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(pinShowcase(db as never, "u1", "s1", false)).resolves.toEqual({ pinned: false });
    expect(db.cardCollection.updateMany).toHaveBeenCalledTimes(1);
    expect(db.cardCollection.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", userId: "u1" },
      data: { pinnedAt: null },
    });
  });

  it("unpinning one showcase leaves another's pin alone, and pinning moves it", async () => {
    // An unpin from a stale screen: B looks pinned there, but A holds the pin now.
    const rows = [pinRow("A", new Date("2026-10-16")), pinRow("B", null), pinRow("X", null, "u2")];
    const db = pinDb(rows);
    db.cardCollection.findFirst.mockResolvedValue({ ...owned(true), id: "B" });
    await expect(pinShowcase(db as never, "u1", "B", false)).resolves.toEqual({ pinned: false });
    expect(rows.map((r) => r.pinnedAt !== null)).toEqual([true, false, false]);
    await expect(pinShowcase(db as never, "u1", "B", true)).resolves.toEqual({ pinned: true });
    expect(rows.map((r) => r.pinnedAt !== null)).toEqual([false, true, false]);
  });

  it("refuses to pin a private showcase, and another player's", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(owned(false));
    await expect(pinShowcase(db as never, "u1", "s1", true)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Make the showcase public before you pin it.",
    });
    db.cardCollection.findFirst.mockResolvedValue(null);
    await expect(pinShowcase(db as never, "u1", "s9", true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardCollection.updateMany).not.toHaveBeenCalled();
  });
});

describe("myDisplay", () => {
  it("returns the pinned showcase's copies as faces with their art", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({ id: "s1", name: "Best", items: [item("c1")] });
    await expect(myDisplay(db as never, "u1")).resolves.toMatchObject({
      showcase: { id: "s1", name: "Best" },
      faces: [
        {
          cardId: "c1",
          artwork: "https://art/c1.png",
          silhouette: false,
          copy: { ownershipId: "o-c1" },
        },
      ],
    });
  });

  it("falls back to the player's top copies when nothing is pinned", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(null);
    db.cardOwnership.findMany.mockResolvedValue([copy("c3")]);
    await expect(myDisplay(db as never, "u1")).resolves.toMatchObject({
      showcase: null,
      faces: [{ cardId: "c3", silhouette: false }],
    });
  });
});
