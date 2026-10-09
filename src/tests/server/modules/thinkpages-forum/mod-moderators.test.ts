/** @jest-environment node */
import { Prisma } from "@prisma/client";
import {
  listCategoryModerators,
  resolveMember,
  setCategoryModerator,
} from "~/server/modules/thinkpages-forum";
import {
  admin,
  at,
  categories,
  eurthMod,
  generalMod,
  member,
  realms,
  USER_ROLE,
} from "~/tests/helpers/forum-mod-fixtures";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const people: Row[] = [
  { id: "u_a", clerkUserId: "admin", role: { name: "admin", level: 10 }, handle: "boss" },
  {
    id: "u_m",
    clerkUserId: "member",
    role: USER_ROLE,
    handle: "alice",
    wikiUsername: "Alice of Eurth",
    email: "alice@example.com",
  },
  { id: "u_w", clerkUserId: "wiki", role: USER_ROLE, handle: null, wikiUsername: "Bob_Smith" },
  { id: "u_d1", clerkUserId: "d1", role: USER_ROLE, handle: null, wikiUsername: "Twin" },
  { id: "u_d2", clerkUserId: "d2", role: USER_ROLE, handle: null, wikiUsername: "Twin" },
];
const categoryModerators: Row[] = [
  { id: "cm1", categoryId: "cat_general", userId: "u_gen", grantedBy: "u_a", createdAt: at(1) },
  { id: "cm2", categoryId: "cat_general", userId: "u_m", grantedBy: "u_a", createdAt: at(2) },
  { id: "cm3", categoryId: "r_eurth_hub", userId: "u_w", grantedBy: "u_a", createdAt: at(3) },
];
const storeWith = () => forumStore({ categories, realms, users: people, categoryModerators });
type Store = ReturnType<typeof storeWith>;
const rowsOf = (store: Store, categoryId: string) =>
  store.state.categoryModerators.filter((r) => r.categoryId === categoryId).map((r) => r.userId);

describe("resolveMember", () => {
  it.each([
    ["a handle", "alice", { id: "u_m", name: "alice" }],
    ["a handle in any case, with @ and spaces", "  @Alice ", { id: "u_m", name: "alice" }],
    ["a wiki username, exactly", "Bob_Smith", { id: "u_w", name: "Bob_Smith" }],
  ])("finds a member by %s", async (_case, handle, expected) => {
    const store = storeWith();
    expect(await resolveMember(store.db as never, eurthMod, { handle })).toEqual(expected);
  });

  it("returns only the id and a public name, never a Clerk id or email", async () => {
    const store = storeWith();
    const found = await resolveMember(store.db as never, admin, { handle: "Alice of Eurth" });
    expect(found).toEqual({ id: "u_m", name: "Alice of Eurth" });
    expect(Object.keys(found!).sort()).toEqual(["id", "name"]);
    for (const call of [
      ...store.db.user.findUnique.mock.calls,
      ...store.db.user.findMany.mock.calls,
    ]) {
      expect(call[0]).toMatchObject({ select: { id: true } });
      expect(call[0].select).not.toHaveProperty("clerkUserId");
      expect(call[0].select).not.toHaveProperty("email");
    }
  });

  it.each([
    ["an unknown name", "nobody"],
    ["a wiki username in the wrong case", "bob_smith"],
    ["a blank query", "   "],
    ["a wiki username two accounts share", "Twin"],
  ])("returns null for %s", async (_case, handle) => {
    const store = storeWith();
    expect(await resolveMember(store.db as never, generalMod, { handle })).toBeNull();
  });

  it.each([
    ["a member", member],
    ["a signed-out viewer", null],
  ] as const)("refuses %s (FORBIDDEN)", async (_case, viewer) => {
    const store = storeWith();
    await expect(
      resolveMember(store.db as never, viewer, { handle: "alice" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("listCategoryModerators", () => {
  it("lists a category's moderators with public names for a site admin", async () => {
    const store = storeWith();
    expect(await listCategoryModerators(store.db as never, admin, { key: "general" })).toEqual([
      { userId: "u_gen", name: "Member", grantedBy: "u_a", createdAt: at(1) },
      { userId: "u_m", name: "alice", grantedBy: "u_a", createdAt: at(2) },
    ]);
  });

  it("lists them for the category's own moderators and the realm's moderators", async () => {
    const store = storeWith();
    expect(
      await listCategoryModerators(store.db as never, generalMod, { key: "general" })
    ).toHaveLength(2);
    expect(
      await listCategoryModerators(store.db as never, eurthMod, { key: "hub", realm: "eurth" })
    ).toEqual([{ userId: "u_w", name: "Bob_Smith", grantedBy: "u_a", createdAt: at(3) }]);
  });

  it.each([
    ["a member", member, { key: "general" }],
    ["a realm moderator on a sitewide category", eurthMod, { key: "general" }],
  ] as const)("refuses %s (FORBIDDEN)", async (_case, viewer, locator) => {
    const store = storeWith();
    await expect(listCategoryModerators(store.db as never, viewer, locator)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("is NOT_FOUND for an unknown category", async () => {
    const store = storeWith();
    await expect(
      listCategoryModerators(store.db as never, admin, { key: "nope" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("setCategoryModerator", () => {
  it("grants: creates the row with its granter and logs moderator.grant in the same transaction", async () => {
    const store = storeWith();
    await setCategoryModerator(store.db as never, admin, {
      locator: { key: "side-games" },
      userId: "u_w",
      grant: true,
    });
    expect(store.state.categoryModerators).toContainEqual(
      expect.objectContaining({ categoryId: "cat_side", userId: "u_w", grantedBy: "u_a" })
    );
    expect(store.tx.forumCategoryModerator.create).toHaveBeenCalledTimes(1);
    expect(store.logs).toEqual([
      expect.objectContaining({
        actorId: "u_a",
        action: "moderator.grant",
        targetType: "user",
        targetId: "u_w",
        scope: "category",
        scopeId: "cat_side",
      }),
    ]);
    expect(detailOf(store.logs[0])).toEqual({ categoryId: "cat_side" });
    expect(store.db.forumModLog.create).not.toHaveBeenCalled();
  });

  it("logs a realm category's grant at the realm's scope", async () => {
    const store = storeWith();
    await setCategoryModerator(store.db as never, admin, {
      locator: { key: "hub", realm: "eurth" },
      userId: "u_m",
      grant: true,
    });
    expect(rowsOf(store, "r_eurth_hub")).toEqual(["u_w", "u_m"]);
    expect(store.logs[0]).toMatchObject({ scope: "realm", scopeId: "r_eurth" });
  });

  it("revokes: deletes the row and logs moderator.revoke in the same transaction", async () => {
    const store = storeWith();
    await setCategoryModerator(store.db as never, admin, {
      locator: { key: "general" },
      userId: "u_m",
      grant: false,
    });
    expect(rowsOf(store, "cat_general")).toEqual(["u_gen"]);
    expect(store.tx.forumCategoryModerator.deleteMany).toHaveBeenCalledWith({
      where: { categoryId: "cat_general", userId: "u_m" },
    });
    expect(store.logs).toEqual([
      expect.objectContaining({
        action: "moderator.revoke",
        targetId: "u_m",
        scopeId: "cat_general",
      }),
    ]);
  });

  it("refuses a second grant (CONFLICT) with nothing logged", async () => {
    const store = storeWith();
    await expect(
      setCategoryModerator(store.db as never, admin, {
        locator: { key: "general" },
        userId: "u_m",
        grant: true,
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "They already moderate this category." });
    expect(rowsOf(store, "cat_general")).toEqual(["u_gen", "u_m"]);
    expect(store.logs).toEqual([]);
  });

  it("maps a racing duplicate grant (unique violation) to CONFLICT", async () => {
    const store = storeWith();
    store.tx.forumCategoryModerator.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    await expect(
      setCategoryModerator(store.db as never, admin, {
        locator: { key: "side-games" },
        userId: "u_w",
        grant: true,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.logs).toEqual([]);
  });

  it("refuses revoking someone who doesn't moderate the category (CONFLICT) with nothing logged", async () => {
    const store = storeWith();
    await expect(
      setCategoryModerator(store.db as never, admin, {
        locator: { key: "side-games" },
        userId: "u_m",
        grant: false,
      })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "They don't moderate this category." });
    expect(store.logs).toEqual([]);
  });

  it.each([
    ["a realm founder, in their own realm", eurthMod, { key: "hub", realm: "eurth" }],
    ["a category moderator, in their own category", generalMod, { key: "general" }],
    ["a member", member, { key: "general" }],
    ["a signed-out viewer", null, { key: "general" }],
  ] as const)("refuses %s (FORBIDDEN, M19)", async (_case, viewer, locator) => {
    const store = storeWith();
    await expect(
      setCategoryModerator(store.db as never, viewer, { locator, userId: "u_w", grant: true })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only site admins appoint category moderators.",
    });
    expect(store.db.$transaction).not.toHaveBeenCalled();
  });

  it("is NOT_FOUND for an unknown member or category", async () => {
    const store = storeWith();
    await expect(
      setCategoryModerator(store.db as never, admin, {
        locator: { key: "general" },
        userId: "u_nobody",
        grant: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Member not found." });
    await expect(
      setCategoryModerator(store.db as never, admin, {
        locator: { key: "nope" },
        userId: "u_w",
        grant: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.db.$transaction).not.toHaveBeenCalled();
  });
});
