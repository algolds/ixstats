import type { PrismaClient } from "@prisma/client";
import { getTransactionHistory } from "~/lib/vault/vault-ledger";

function makeDb() {
  const findMany = jest.fn().mockResolvedValue([]);
  const db = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: "u1" }) },
    myVault: { upsert: jest.fn().mockResolvedValue({ id: "v1", userId: "u1" }) },
    vaultTransaction: { findMany },
  } as unknown as PrismaClient;
  return { db, findMany };
}

describe("getTransactionHistory direction", () => {
  it.each([
    ["earned" as const, { gt: 0 }],
    ["spent" as const, { lt: 0 }],
  ])("filters %s rows by the sign of credits", async (direction, credits) => {
    const { db, findMany } = makeDb();
    await getTransactionHistory("u1", db, 25, 0, undefined, direction);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ vaultId: "v1", credits });
  });

  it("combines direction with type", async () => {
    const { db, findMany } = makeDb();
    await getTransactionHistory("u1", db, 25, 0, "EARN_BONUS", "earned");
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      vaultId: "v1",
      type: "EARN_BONUS",
      credits: { gt: 0 },
    });
  });

  it("filters nothing by sign without a direction", async () => {
    const { db, findMany } = makeDb();
    await getTransactionHistory("u1", db);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ vaultId: "v1" });
  });
});
