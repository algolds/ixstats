/** @jest-environment node */
/** The bonus config cache: a write inside a transaction is cleared by its caller once the transaction commits. */
import { clearBonusConfigCache, getBonusConfig, setBonusConfig } from "~/lib/vault/vault-bonus";

it("a setter in a transaction leaves the cache to its caller, which clears it after the commit", async () => {
  const read = { systemConfig: { findMany: jest.fn().mockResolvedValue([]) } };
  clearBonusConfigCache();
  await getBonusConfig(read as never);
  await setBonusConfig({ systemConfig: { upsert: jest.fn() } } as never, "newPlayer", 4000);
  await getBonusConfig(read as never);
  expect(read.systemConfig.findMany).toHaveBeenCalledTimes(1);
  clearBonusConfigCache();
  await getBonusConfig(read as never);
  expect(read.systemConfig.findMany).toHaveBeenCalledTimes(2);
  const app = { systemConfig: { upsert: jest.fn() }, $transaction: jest.fn() };
  await setBonusConfig(app as never, "newPlayer", 4000);
  await getBonusConfig(read as never);
  expect(read.systemConfig.findMany).toHaveBeenCalledTimes(3);
});
