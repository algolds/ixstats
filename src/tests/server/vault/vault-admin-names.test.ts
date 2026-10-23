/** @jest-environment node */
/**
 * The vault admin names a player by their nation, then their passport handle, then their Clerk id, and searches by
 * handle: an old wiki name is neither searched, sent nor shown (identity, plan A).
 */
import { createCallerFactory } from "~/server/api/trpc";
import { vaultAdminItemsRouter } from "~/server/api/routers/vault/admin/items";
import { vaultAdminUsersRouter } from "~/server/api/routers/vault/admin/users";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const asAdmin = (db: ReturnType<typeof createMockPrisma>) =>
  createMockRouterContext({
    db,
    auth: { userId: "clerk_admin" },
    user: { id: "db_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } },
  }) as never;

describe("vault.adminListVaults", () => {
  it("searches by handle and sends the handle, not a wiki name", async () => {
    const db = createMockPrisma();
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        clerkUserId: "clerk_u1",
        handle: "ruler",
        forumUsername: null,
        discordUsername: null,
        wikiUsername: "Wiki Ruler",
        country: null,
        vault: null,
      },
    ]);
    db.user.count.mockResolvedValue(1);
    const result = await createCallerFactory(vaultAdminUsersRouter)(asAdmin(db)).adminListVaults({
      search: "rul",
    });
    const [args] = db.user.findMany.mock.calls[0] as [{ where: { OR: object[] } }];
    expect(args.where.OR).toContainEqual({ handle: { contains: "rul", mode: "insensitive" } });
    expect(JSON.stringify(args.where)).not.toContain("wikiUsername");
    expect(result.users[0]).toMatchObject({ handle: "ruler" });
    expect(JSON.stringify(result)).not.toContain("Wiki Ruler");
  });
});

describe("vault.adminGetPurchaseLogs", () => {
  const tx = (user: object) => ({
    id: "t1",
    credits: -5,
    balanceAfter: 10,
    type: "SPEND_COSMETIC",
    source: "store",
    metadata: null,
    createdAt: new Date(0),
    vault: { user },
  });

  it("names the buyer by nation, then handle, then Clerk id", async () => {
    const db = createMockPrisma();
    db.vaultTransaction.findMany.mockResolvedValue([
      tx({
        id: "a",
        clerkUserId: "clerk_a",
        handle: "ruler",
        country: { name: "Urcea", flag: null },
      }),
      tx({ id: "b", clerkUserId: "clerk_b", handle: "ruler", country: null }),
      tx({ id: "c", clerkUserId: "clerk_c", handle: null, country: null }),
    ]);
    const logs = await createCallerFactory(vaultAdminItemsRouter)(
      asAdmin(db)
    ).adminGetPurchaseLogs();
    expect(logs.map((l) => l.user.displayName)).toEqual(["Urcea", "ruler", "clerk_c"]);
    const [args] = db.vaultTransaction.findMany.mock.calls[0] as [
      { include: { vault: { include: { user: { select: Record<string, boolean> } } } } },
    ];
    expect(args.include.vault.include.user.select).toMatchObject({ handle: true });
    expect(args.include.vault.include.user.select).not.toHaveProperty("wikiUsername");
  });
});
