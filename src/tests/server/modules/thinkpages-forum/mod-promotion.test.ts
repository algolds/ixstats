/** @jest-environment node */
/**
 * M9 (owner ruling): no moderator powers for a member with an active forum ban where they would apply or sitewide;
 * active warnings alone do not block.
 */
import { assertBoardGrantable, setCategoryModerator } from "~/server/modules/thinkpages-forum";
import { ban, days, NOW, warning } from "~/tests/helpers/forum-appeal-fixtures";
import { admin, categories, realms, USER_ROLE } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const users: Row[] = [
  { id: "u_a", clerkUserId: "admin", role: { name: "admin", level: 10 } },
  { id: "u_m", clerkUserId: "member", role: USER_ROLE },
];
const storeWith = (seed: { bans?: Row[]; warnings?: Row[] } = {}) =>
  forumStore({ categories, realms, users, categoryModerators: [], ...seed });

const REFUSED = {
  code: "BAD_REQUEST",
  message:
    "They have an active forum ban here or sitewide. Lift it before giving them moderator powers.",
};
const site = (extra: Row = {}) => ban("b1", { scope: "site", scopeId: null, ...extra });
const inRealm = (realmId: string) => ban("b1", { scope: "realm", scopeId: realmId });
const inCategory = (categoryId: string) => ban("b1", { scope: "category", scopeId: categoryId });

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("setCategoryModerator refuses a member banned there or sitewide (M9)", () => {
  const grant = (store: ReturnType<typeof storeWith>, key: string, realm?: string) =>
    setCategoryModerator(store.db as never, admin, {
      locator: { key, realm },
      userId: "u_m",
      grant: true,
    });

  it.each([
    ["a site ban", site(), "general", undefined],
    ["a ban in the category", inCategory("cat_general"), "general", undefined],
    ["a ban in the category's realm", inRealm("r_eurth"), "hub", "eurth"],
  ])("refuses with %s, writing nothing", async (_name, row, key, realm) => {
    const store = storeWith({ bans: [row] });
    await expect(grant(store, key, realm)).rejects.toMatchObject(REFUSED);
    expect(store.state.categoryModerators).toEqual([]);
    expect(store.logs).toEqual([]);
  });

  it("checks the bans inside the grant's transaction, under the member's lock (M9)", async () => {
    const store = storeWith();
    await grant(store, "general");
    const [strings, key] = store.tx.$executeRaw.mock.calls[0]!;
    expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(hashtext(?))");
    expect(key).toBe("forum-member:u_m");
    expect(store.db.$transaction).toHaveBeenCalledTimes(1);
    expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      store.tx.forumBan.findMany.mock.invocationCallOrder[0]!
    );
    expect(store.tx.forumBan.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      store.tx.forumCategoryModerator.create.mock.invocationCallOrder[0]!
    );
  });

  it("grants despite warnings, finished bans and bans elsewhere", async () => {
    const store = storeWith({
      warnings: [warning("w1", { points: 5 })],
      bans: [
        site({ liftedAt: days(-1) }),
        ban("b2", { scope: "site", scopeId: null, expiresAt: days(-1) }),
        inCategory("cat_side"),
        inRealm("r_aurora"),
      ],
    });
    await grant(store, "general");
    expect(store.state.categoryModerators).toEqual([
      expect.objectContaining({ categoryId: "cat_general", userId: "u_m" }),
    ]);
  });

  it("still lets a site admin remove a banned member's role", async () => {
    const store = forumStore({
      categories,
      realms,
      users,
      bans: [site()],
      categoryModerators: [
        { id: "cm1", categoryId: "cat_general", userId: "u_m", grantedBy: "u_a" },
      ],
    });
    await setCategoryModerator(store.db as never, admin, {
      locator: { key: "general" },
      userId: "u_m",
      grant: false,
    });
    expect(store.state.categoryModerators).toEqual([]);
  });
});

describe("assertBoardGrantable (M9, a realm's board power)", () => {
  it.each([
    ["a site ban", site()],
    ["a ban in the realm's section", inRealm("r_eurth")],
    ["a ban in one of the realm's categories", inCategory("r_eurth_character-threads")],
  ])("refuses a member with %s, found by Clerk id", async (_name, row) => {
    const store = storeWith({ bans: [row] });
    await expect(
      assertBoardGrantable(store.db as never, "r_eurth", "member")
    ).rejects.toMatchObject(REFUSED);
  });

  it("takes the member's lock (by their User.id) before reading their bans (M9)", async () => {
    const store = storeWith();
    await assertBoardGrantable(store.tx as never, "r_eurth", "member");
    const [, key] = store.tx.$executeRaw.mock.calls[0]!;
    expect(key).toBe("forum-member:u_m");
    expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      store.tx.forumBan.findFirst.mock.invocationCallOrder[0]!
    );
  });

  it("allows warnings, finished bans, bans elsewhere and players with no IxStats account", async () => {
    const store = storeWith({
      warnings: [warning("w1", { points: 5 })],
      bans: [site({ liftedAt: days(-1) }), inRealm("r_aurora"), inCategory("cat_general")],
    });
    await expect(
      assertBoardGrantable(store.db as never, "r_eurth", "member")
    ).resolves.toBeUndefined();
    await expect(
      assertBoardGrantable(store.db as never, "r_eurth", "nobody")
    ).resolves.toBeUndefined();
  });
});
