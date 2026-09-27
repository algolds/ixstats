/** @jest-environment node */
/**
 * Trade expiry (plan 330): trades get a real-time `expiresAt` (trading/offers.ts), so the
 * cutoff must be real time too. Comparing against IxTime (~16 years ahead) expired every trade.
 */
import { processExpiredTrades } from "~/lib/economy/trade-expiry-cron";

interface FindManyArgs {
  where: { expiresAt: { lt: Date } };
}
const mockFindMany = jest.fn<Promise<never[]>, [FindManyArgs]>();

jest.mock("~/server/db", () => ({
  get db() {
    return { tradeOffer: { findMany: mockFindMany } };
  },
}));

describe("processExpiredTrades", () => {
  beforeEach(() => {
    mockFindMany.mockReset().mockResolvedValue([]);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses a real-time expiry cutoff", async () => {
    await processExpiredTrades();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const cutoff = mockFindMany.mock.calls[0][0].where.expiresAt.lt;
    expect(Math.abs(cutoff.getTime() - Date.now())).toBeLessThan(5_000);
  });
});
