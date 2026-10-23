/** @jest-environment node */
/** A realm owner edits the categories of their own realm's lore cards, and nothing else. */
jest.mock("~/server/modules/cards/cards.categories", () => ({
  setCardCategory: jest.fn(async () => ({ changed: true })),
}));
import { setCardCategory } from "~/server/modules/cards/cards.categories";
import {
  listRealmCategoryCards,
  loadCategoryRealm,
  setRealmCardCategory,
} from "~/server/modules/cards/cards.realm-categories";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const founder = { id: "db_f", clerkUserId: "clerk_f", role: { name: "user", level: 100 } };
const admin = { id: "db_a", clerkUserId: "clerk_a", role: { name: "admin", level: 10 } };
const eurth = { id: "eurth", slug: "eurth", name: "Eurth", ownerId: "clerk_f", status: "active" };
const choice = { category: "HISTORY" as const, subcategory: "event" };

function dbFor(realm: object | null = eurth) {
  const db = createMockPrisma();
  db.realm.findUnique.mockResolvedValue(realm);
  db.card.count.mockResolvedValue(0);
  return db;
}

beforeEach(() => jest.clearAllMocks());

it("writes the founder's choice as the realm owner's, held to the realm's own cards", async () => {
  await setRealmCardCategory(dbFor() as never, founder, { slug: "eurth", cardId: "c1", choice });
  expect(jest.mocked(setCardCategory)).toHaveBeenCalledWith(expect.anything(), {
    cardId: "c1",
    realmId: "eurth",
    choice,
    source: "REALM_OWNER",
    editor: { dbId: "db_f", clerkId: "clerk_f" },
  });
});

it("writes a site admin's choice as the admin's", async () => {
  const result = await setRealmCardCategory(dbFor() as never, admin, {
    slug: "eurth",
    cardId: "c1",
    choice,
  });
  expect(result).toEqual({ changed: true });
  expect(jest.mocked(setCardCategory)).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      realmId: "eurth",
      source: "ADMIN",
      editor: { dbId: "db_a", clerkId: "clerk_a" },
    })
  );
});

it.each([
  ["a member who is not the founder", { ...eurth, ownerId: "clerk_other" }],
  ["the founder after handing the realm over", { ...eurth, ownerId: "clerk_new" }],
  ["an archived realm", { ...eurth, status: "archived" }],
])("refuses %s, and writes nothing", async (_, realm) => {
  await expect(
    setRealmCardCategory(dbFor(realm) as never, founder, { slug: "eurth", cardId: "c1", choice })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(jest.mocked(setCardCategory)).not.toHaveBeenCalled();
});

it("says why it refuses", async () => {
  await expect(
    loadCategoryRealm(dbFor(null) as never, founder, "nowhere", { write: false })
  ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Realm not found" });
  await expect(
    loadCategoryRealm(dbFor({ ...eurth, ownerId: "clerk_other" }) as never, founder, "eurth", {
      write: false,
    })
  ).rejects.toMatchObject({
    message: "Only the realm's founder and site admins edit its card categories",
  });
  await expect(
    loadCategoryRealm(dbFor({ ...eurth, status: "archived" }) as never, founder, "eurth", {
      write: true,
    })
  ).rejects.toMatchObject({
    message: "This realm is archived: its card categories can't be changed",
  });
});

it("finds the realm by its slug, and reads an archived realm's cards", async () => {
  const db = dbFor({ ...eurth, status: "archived" });
  await expect(loadCategoryRealm(db as never, founder, "eurth", { write: false })).resolves.toEqual(
    { id: "eurth", name: "Eurth" }
  );
  expect(db.realm.findUnique.mock.calls[0]![0].where).toEqual({ slug: "eurth" });
});

it("lists only the realm's lore cards, Uncategorised as no category", async () => {
  const db = dbFor();
  await listRealmCategoryCards(db as never, founder, {
    slug: "eurth",
    show: "uncategorised",
    offset: 0,
    limit: 50,
  });
  expect(db.card.findMany.mock.calls[0]![0].where).toMatchObject({
    realmId: "eurth",
    cardType: "LORE",
    category: null,
  });
});

it("lists the cards waiting for review by title, searched as typed, never a retired one", async () => {
  const db = dbFor();
  const rows = [
    { id: "c1", title: "Kiro", category: null, subcategory: null, categoryNeedsReview: true },
  ];
  db.card.findMany.mockResolvedValue(rows);
  db.card.count.mockResolvedValue(7);
  const result = await listRealmCategoryCards(db as never, founder, {
    slug: "eurth",
    search: " 50%_off ",
    show: "review",
    offset: 50,
    limit: 25,
  });
  expect(result).toEqual({ rows, total: 7 });
  const args = db.card.findMany.mock.calls[0]![0];
  const where = {
    realmId: "eurth",
    cardType: "LORE",
    categoryNeedsReview: true,
    isRetired: false,
    title: { contains: "50\\%\\_off", mode: "insensitive" },
  };
  expect(args).toEqual({
    where,
    orderBy: [{ title: "asc" }, { id: "asc" }],
    skip: 50,
    take: 25,
    select: {
      id: true,
      title: true,
      category: true,
      subcategory: true,
      categoryNeedsReview: true,
    },
  });
  expect(db.card.count.mock.calls[0]![0]).toEqual({ where });
});

it("lists every lore card of the realm for All, and ignores an empty search", async () => {
  const db = dbFor();
  await listRealmCategoryCards(db as never, founder, {
    slug: "eurth",
    search: "  ",
    show: "all",
    offset: 0,
    limit: 50,
  });
  expect(db.card.findMany.mock.calls[0]![0].where).toEqual({ realmId: "eurth", cardType: "LORE" });
});

it("refuses to list another founder's realm", async () => {
  const db = dbFor({ ...eurth, ownerId: "clerk_other" });
  await expect(
    listRealmCategoryCards(db as never, founder, {
      slug: "eurth",
      show: "all",
      offset: 0,
      limit: 50,
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(db.card.findMany).not.toHaveBeenCalled();
});
