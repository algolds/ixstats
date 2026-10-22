/** @jest-environment node */
/**
 * Vault bonuses are paid once, through the real ledger on the in-memory Prisma. The 5,000 IxC new-player bonus is an
 * IxnayID bonus: once per account at sign-up (or on first Vault open for older accounts), with no country, and never to
 * an account the country path or a pre-key row already paid. A once-per-nation bonus is keyed on its nation, so a
 * second account importing it is not paid but a second nation is. A bonus inside a caller's transaction pays once per
 * source and user. The achievement bonus scales by rarity and the NationStates deck bonus is capped.
 *
 * Folds grant-bonus-tx, the grantBonus cases of vault-exploit-races and the bonus amounts of vault-service.
 */
import {
  achievementBonus,
  grantBonus,
  grantBonusTx,
  grantNewPlayerBonus,
  NEW_PLAYER_BONUS_SOURCE,
  nsImportBonus,
  resetNewPlayerBonusMemo,
  VAULT_BONUS_DEFAULTS,
} from "~/lib/vault/vault-bonus";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addPlayer, clearEconomyCaches, ledgerOf, type Player } from "~/tests/helpers/money-world";

let db: MemoryPrisma;
let mo: Player;
let sue: Player;

const bonusRows = async (player: Player, source: string) =>
  (await ledgerOf(db as never, player.id)).filter(
    (row) => row.source === source && row.type === "EARN_BONUS"
  );

beforeEach(async () => {
  clearEconomyCaches();
  resetNewPlayerBonusMemo();
  db = createMemoryPrisma();
  mo = await addPlayer(db as never, "mo");
  sue = await addPlayer(db as never, "sue");
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("the new-player bonus", () => {
  it("pays 5,000 IxC once, with no country, however often it is asked after (Vault opens, a restart)", async () => {
    await expect(grantNewPlayerBonus(db, mo.id, "account_created")).resolves.toMatchObject({
      granted: true,
      amount: 5000,
    });
    await grantNewPlayerBonus(db, mo.clerkUserId, "vault_opened");
    resetNewPlayerBonusMemo();
    await expect(grantNewPlayerBonus(db, mo.id, "vault_opened")).resolves.toMatchObject({
      granted: false,
    });
    expect(await bonusRows(mo, NEW_PLAYER_BONUS_SOURCE)).toEqual([
      expect.objectContaining({ credits: 5000, balanceAfter: 5000 }),
    ]);
  });

  it("pays nothing to an account the country path, or a row from before keys, already paid", async () => {
    await expect(
      grantBonus(db, mo.clerkUserId, NEW_PLAYER_BONUS_SOURCE, 5000, { oneTime: true })
    ).resolves.toMatchObject({ granted: true });
    await expect(grantNewPlayerBonus(db, mo.clerkUserId, "vault_opened")).resolves.toMatchObject({
      granted: false,
      reason: "already_granted",
    });
    const vault = await db.myVault.findUniqueOrThrow({ where: { userId: sue.id } });
    await db.vaultTransaction.create({
      data: {
        vaultId: vault.id,
        credits: 5000,
        balanceAfter: 5000,
        type: "EARN_BONUS",
        source: NEW_PLAYER_BONUS_SOURCE,
      },
    });
    await expect(grantNewPlayerBonus(db, sue.id, "vault_opened")).resolves.toMatchObject({
      granted: false,
    });
    expect(await bonusRows(mo, NEW_PLAYER_BONUS_SOURCE)).toHaveLength(1);
    expect(await bonusRows(sue, NEW_PLAYER_BONUS_SOURCE)).toHaveLength(1);
  });

  it("tries again after a grant the ledger refused, instead of remembering it", async () => {
    await db.systemConfig.create({ data: { key: "vault_isMaintenanceMode", value: "true" } });
    clearEconomyCaches();
    await expect(grantNewPlayerBonus(db, mo.id, "account_created")).resolves.toMatchObject({
      granted: false,
    });
    await db.systemConfig.update({
      where: { key: "vault_isMaintenanceMode" },
      data: { value: "false" },
    });
    clearEconomyCaches();
    await expect(grantNewPlayerBonus(db, mo.id, "vault_opened")).resolves.toMatchObject({
      granted: true,
    });
  });

  it("never throws", async () => {
    jest.spyOn(db.user, "findFirst").mockRejectedValue(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(grantNewPlayerBonus(db, mo.id, "account_created")).resolves.toEqual({
      granted: false,
      amount: 0,
      reason: "error",
    });
  });
});

describe("keyed bonuses", () => {
  it("pays a once-per-nation bonus once for the nation, whichever account asks, and again for a second nation", async () => {
    const deck = (player: Player, nation: string) =>
      grantBonus(db, player.id, "bonus:ns_deck_import", 50, {
        onceKey: `bonus:ns_deck_import:${nation}`,
      });
    await expect(deck(mo, "testlandia")).resolves.toMatchObject({ granted: true, amount: 50 });
    await expect(deck(sue, "testlandia")).resolves.toMatchObject({
      granted: false,
      reason: "already_granted",
    });
    await expect(deck(mo, "second_nation")).resolves.toMatchObject({ granted: true });
    expect(await bonusRows(mo, "bonus:ns_deck_import")).toHaveLength(2);
    expect(await bonusRows(sue, "bonus:ns_deck_import")).toEqual([]);
  });

  it("pays inside the caller's transaction once per source and user, and nothing to an unknown user", async () => {
    const pay = (who: string) =>
      db.$transaction((tx) => grantBonusTx(tx, who, "bonus:loreward:e1", 500, { entryId: "e1" }));
    await expect(pay(mo.clerkUserId)).resolves.toBe(true);
    await expect(pay(mo.id)).resolves.toBe(false);
    await expect(pay("nobody")).resolves.toBe(false);
    expect(
      await db.vaultTransaction.findMany({
        where: { source: "bonus:loreward:e1" },
        select: { credits: true, idempotencyKey: true },
      })
    ).toEqual([{ credits: 500, idempotencyKey: `bonus:loreward:e1:${mo.id}` }]);
  });
});

describe("bonus amounts", () => {
  it.each([
    ["Common", 100],
    ["EPIC", 1000],
    ["legendary", 2500],
    ["a rarity it does not know", 100],
  ])("pays an achievement of %s rarity %d IxC", (rarity, amount) => {
    expect(achievementBonus(VAULT_BONUS_DEFAULTS, rarity)).toBe(amount);
  });

  it.each([
    [0, 0],
    [10, 500],
    [1000, 5000],
  ])("pays a NationStates deck of %d cards %d IxC", (cards, amount) => {
    expect(nsImportBonus(VAULT_BONUS_DEFAULTS, cards)).toBe(amount);
  });
});
