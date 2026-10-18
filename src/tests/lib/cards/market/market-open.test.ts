/** @jest-environment node */
/** The card market's one switch: auctions and listings close together, in maintenance or with the market switch off. */
import { assertMarketOpen } from "~/lib/cards/market/market-open";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";

const dbWith = (rows: Array<{ key: string; value: string }>) => ({
  systemConfig: { findMany: jest.fn(async () => rows) },
});

beforeEach(() => invalidateVaultConfigCache());

it("is open by default", async () => {
  await expect(assertMarketOpen(dbWith([]) as never)).resolves.toBeUndefined();
});

it("closes in maintenance, whatever the market switch says", async () => {
  await expect(
    assertMarketOpen(dbWith([{ key: "vault_isMaintenanceMode", value: "true" }]) as never)
  ).rejects.toMatchObject({
    code: "BAD_REQUEST",
    message: "Vault economy is currently in maintenance mode.",
  });
});

it("closes while the market switch is off", async () => {
  await expect(
    assertMarketOpen(dbWith([{ key: "vault_isAuctionsEnabled", value: "false" }]) as never)
  ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "The card market is closed right now." });
});
