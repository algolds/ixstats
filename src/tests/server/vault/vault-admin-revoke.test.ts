/** @jest-environment node */
/**
 * An admin revoking a store item keeps the ledger whole: the purchase row stays (amount and balanceAfter untouched,
 * so the ledger still sums to the balance), marked revoked so it grants nothing; a zero-credit ADMIN_ADJUSTMENT row
 * names the revoke and the purchase it revoked; an equipped cosmetic comes off; nothing is refunded. The player no
 * longer owns the item, and the admin can grant it again.
 *
 * Regression: adminRevokeStoreItem hard-deleted the purchase's vault_transactions row (breaking the ledger-sums-to-
 * balance invariant and the audit trail) and left an equipped item on, which still read as owned.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { vaultAdminItemsRouter } from "~/server/api/routers/vault/admin/items";
import { countStorePurchases, isRevokedPurchase } from "~/lib/vault/store-purchases";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";

let db: MemoryPrisma;
const admin = () =>
  createCallerFactory(vaultAdminItemsRouter)(
    createMockRouterContext({
      db: db as never,
      auth: { userId: "clerk_admin" },
      user: { id: "db_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } },
    }) as never
  );

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  mockDb = db;
  await db.user.create({ data: { id: "kim", clerkUserId: "clerk_kim" } });
  await db.vaultStoreItem.create({
    data: { id: "halo", name: "Golden Halo", price: 300, category: "cosmetics" },
  });
  const vault = await db.myVault.create({
    data: { userId: "kim", credits: 700, equippedCosmetics: "halo,cape" },
  });
  await db.vaultTransaction.create({
    data: {
      id: "buy-halo",
      vaultId: vault.id,
      credits: -300,
      balanceAfter: 700,
      type: "SPEND_COSMETIC",
      source: "STORE",
      metadata: JSON.stringify({ itemId: "halo" }),
    },
  });
});
afterEach(() => jest.restoreAllMocks());

it("marks the purchase revoked, records the revoke, unequips the item and refunds nothing", async () => {
  await admin().adminRevokeStoreItem({ userId: "kim", itemId: "halo" });

  const rows = await db.vaultTransaction.findMany({ orderBy: { createdAt: "asc" } });
  expect(rows).toHaveLength(2);
  const [purchase, revoke] = rows;
  expect(purchase).toMatchObject({ id: "buy-halo", credits: -300, balanceAfter: 700 });
  expect(isRevokedPurchase(purchase!.metadata)).toBe(true);
  expect(JSON.parse(purchase!.metadata as string)).toMatchObject({
    itemId: "halo",
    revokedByUserId: "clerk_admin",
  });
  expect(revoke).toMatchObject({
    credits: 0,
    balanceAfter: 700,
    type: "ADMIN_ADJUSTMENT",
    source: "Admin Revoke: Golden Halo",
  });
  expect(JSON.parse(revoke!.metadata as string)).toEqual({
    revokedItemId: "halo",
    sourceTransactionIds: ["buy-halo"],
    adminUserId: "clerk_admin",
  });
  const vault = await db.myVault.findUniqueOrThrow({ where: { userId: "kim" } });
  expect(vault).toMatchObject({ credits: 700, equippedCosmetics: "cape" });
  // The ledger still sums to the balance it started from: 1,000 before the purchase
  expect(1000 + rows.reduce((sum, r) => sum + r.credits, 0)).toBe(vault.credits);

  expect(countStorePurchases(rows)).toEqual({});
  expect(await admin().adminGetPurchasedItems({ userId: "kim" })).toMatchObject({
    purchasedItemIds: [],
  });
  await expect(admin().adminRevokeStoreItem({ userId: "kim", itemId: "halo" })).rejects.toThrow(
    "User does not own this item"
  );
  await admin().adminGrantStoreItem({ userId: "kim", itemId: "halo" });
  expect(await admin().adminGetPurchasedItems({ userId: "kim" })).toMatchObject({
    purchasedItemIds: ["halo"],
  });
});
