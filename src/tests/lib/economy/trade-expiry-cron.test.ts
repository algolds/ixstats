/** @jest-environment node */
/**
 * Trade expiry (plan 330): trades get a real-time `expiresAt` (the trade service), so the cutoff must be real time
 * too. Comparing against IxTime (~16 years ahead) expired every trade. Only a trade still pending and expired is
 * ended, and only then are its proposer's own copies freed: a copy listed since then keeps its lock.
 */
import { processExpiredTrades } from "~/lib/economy/trade-expiry-cron";

interface FindManyArgs {
  where: { expiresAt: { lt: Date } };
  select: Record<string, boolean>;
}
const mockFindMany = jest.fn<Promise<object[]>, [FindManyArgs]>();
const tx = {
  tradeOffer: { updateMany: jest.fn() },
  cardOwnership: { updateMany: jest.fn() },
};
const mockTransaction = jest.fn(async (work: (t: typeof tx) => Promise<void>) => work(tx));

jest.mock("~/server/db", () => ({
  get db() {
    return { tradeOffer: { findMany: mockFindMany }, $transaction: mockTransaction };
  },
}));

/** Alice offered a1; Bob countered with b1, so Bob wrote the table and b1 is the locked card. */
const COUNTERED = {
  id: "t1",
  proposerId: "bob",
  initiatorId: "alice",
  initiatorCardIds: ["a1"],
  recipientCardIds: ["b1"],
};

describe("processExpiredTrades", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 1 });
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses a real-time expiry cutoff", async () => {
    await processExpiredTrades();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const cutoff = mockFindMany.mock.calls[0]![0].where.expiresAt.lt;
    expect(Math.abs(cutoff.getTime() - Date.now())).toBeLessThan(5_000);
  });

  it("expires a trade still pending and expired, then frees the proposer's own copies", async () => {
    mockFindMany.mockResolvedValue([COUNTERED]);
    const result = await processExpiredTrades();

    expect(mockFindMany.mock.calls[0]![0].select).toEqual({
      id: true,
      proposerId: true,
      initiatorId: true,
      initiatorCardIds: true,
      recipientCardIds: true,
    });
    const cutoff = mockFindMany.mock.calls[0]![0].where.expiresAt.lt;
    expect(tx.tradeOffer.updateMany).toHaveBeenCalledWith({
      where: { id: "t1", status: "PENDING", expiresAt: { lt: cutoff } },
      data: { status: "EXPIRED" },
    });
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b1"] }, ownerId: "bob" },
      data: { isLocked: false },
    });
    expect(tx.tradeOffer.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.cardOwnership.updateMany.mock.invocationCallOrder[0]!
    );
    expect(result).toMatchObject({ success: true, processed: 1, failed: 0 });
  });
  it("frees nothing for a trade that was accepted, cancelled or countered since it was read", async () => {
    mockFindMany.mockResolvedValue([COUNTERED]);
    tx.tradeOffer.updateMany.mockResolvedValue({ count: 0 });
    await processExpiredTrades();
    expect(tx.cardOwnership.updateMany).not.toHaveBeenCalled();
  });
});
