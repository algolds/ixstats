import { clearValuationCache, getValuationConfig, setValuationConfig } from "~/lib/cards/valuation";
describe("card-valuation", () => {
  test("a setter in a transaction leaves the cache to its caller, which clears it after the commit", async () => {
    const read = { systemConfig: { findMany: jest.fn().mockResolvedValue([]) } };
    clearValuationCache();
    await getValuationConfig(read as never);
    await setValuationConfig({ systemConfig: { upsert: jest.fn() } } as never, "floorRare", 120);
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(1);
    clearValuationCache();
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(2);
    const app = { systemConfig: { upsert: jest.fn() }, $transaction: jest.fn() };
    await setValuationConfig(app as never, "floorRare", 120);
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(3);
  });
});
