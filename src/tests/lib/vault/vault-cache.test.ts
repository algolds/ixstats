/** @jest-environment node */
/** The cached Vault stats and balances, dropped for players known by their `User.id`. */
jest.mock("~/lib/cache", () => ({
  globalCache: { delete: jest.fn().mockResolvedValue(undefined) },
}));

import { globalCache } from "~/lib/cache";
import { clearVaultCachesFor } from "~/lib/vault/vault-cache";

beforeEach(() => jest.clearAllMocks());

it("drops the stats and balance caches by database and Clerk id, reading each player once", async () => {
  const db = {
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: "u1", clerkUserId: "user_1" },
        { id: "u2", clerkUserId: null },
      ]),
    },
  };
  await clearVaultCachesFor(db as never, ["u1", "u2", "u1"]);
  expect(db.user.findMany).toHaveBeenCalledWith({
    where: { id: { in: ["u1", "u2"] } },
    select: { id: true, clerkUserId: true },
  });
  expect(
    jest
      .mocked(globalCache.delete)
      .mock.calls.map((c) => c[0])
      .sort()
  ).toEqual([
    "user_vault_balance:u1",
    "user_vault_balance:u2",
    "user_vault_balance:user_1",
    "user_vault_stats:u1",
    "user_vault_stats:u2",
  ]);
});
