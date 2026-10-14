import { createCallerFactory } from "~/server/api/trpc";
import { vaultStoreRouter } from "~/server/api/routers/vault/store";
import { vaultService } from "~/lib/vault/vault-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";

jest.mock("~/lib/vault/vault-service", () => ({
  vaultService: { getTransactionHistory: jest.fn() },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: { delete: jest.fn().mockResolvedValue(undefined) },
}));

const createCaller = createCallerFactory(vaultStoreRouter);
const history = jest.mocked(vaultService.getTransactionHistory);

const tx = (id: string, credits: number) => ({
  id,
  amount: credits,
  credits,
  balanceAfter: 100,
  type: "EARN_ACTIVE",
  source: "SOCIAL_POST",
  metadata: JSON.stringify({ a: 1 }),
  createdAt: new Date("2026-10-14T00:00:00.000Z"),
});

describe("vault.getTransactions direction", () => {
  const caller = () => createCaller(createMockRouterContext({ db: {} }) as never);

  beforeEach(() => history.mockReset());

  it.each([["earned" as const], ["spent" as const]])(
    "passes %s to the ledger",
    async (direction) => {
      history.mockResolvedValue([tx("a", 5)]);
      await caller().getTransactions({ limit: 25, offset: 50, direction });
      expect(history).toHaveBeenCalledWith(
        "test_user_clerk_id",
        expect.anything(),
        25,
        50,
        undefined,
        direction
      );
    }
  );

  it("passes no direction for the whole statement", async () => {
    history.mockResolvedValue([]);
    await caller().getTransactions({});
    expect(history.mock.calls[0]?.[5]).toBeUndefined();
  });

  it("returns the rows with their metadata and a paging flag", async () => {
    history.mockResolvedValue([tx("a", 5), tx("b", -3)]);
    const out = await caller().getTransactions({ limit: 2 });
    expect(out.hasMore).toBe(true);
    expect(out.transactions[0]?.metadata).toBe(JSON.stringify({ a: 1 }));
  });

  it("rejects an unknown direction", async () => {
    await expect(caller().getTransactions({ direction: "sideways" } as never)).rejects.toThrow();
  });
});
