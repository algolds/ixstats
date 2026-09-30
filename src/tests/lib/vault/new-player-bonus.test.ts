/**
 * The 5,000 IxC new-player bonus is an IxnayID bonus: it is paid once per account at sign-up
 * (or on first Vault open for older accounts), needs no country, and the country builder /
 * realm-claim paths become no-ops once it is paid. The fake ledger below honours
 * idempotency keys the way `earnCreditsOnce` does.
 */

jest.mock("~/lib/vault/vault-service", () => ({
  earnCreditsOnce: jest.fn(),
  vaultService: { earnCredits: jest.fn() },
}));

import { earnCreditsOnce } from "~/lib/vault/vault-service";
import {
  grantBonus,
  grantNewPlayerBonus,
  NEW_PLAYER_BONUS_SOURCE,
  resetNewPlayerBonusMemo,
} from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const earnOnce = jest.mocked(earnCreditsOnce);
const USER_ID = "user_db_1";
const CLERK_ID = "clerk_1";

interface LedgerRow {
  userId: string;
  source: string;
  type: string;
  credits: number;
  idempotencyKey: string | null;
}

function setup(existing: LedgerRow[] = []) {
  const ledger: LedgerRow[] = [...existing];
  const db = createMockPrisma();
  db.systemConfig.findMany.mockResolvedValue([]);
  // A user with no country: nothing here depends on one
  db.user.findFirst.mockResolvedValue({ id: USER_ID });
  db.vaultTransaction.findFirst.mockImplementation(async ({ where }: any) => {
    const row = ledger.find(
      (r) => r.source === where.source && r.type === where.type && r.userId === where.vault.userId
    );
    return row ? { id: "tx" } : null;
  });
  earnOnce.mockImplementation(async (_db, input) => {
    if (ledger.some((r) => r.idempotencyKey === input.idempotencyKey)) {
      return { success: true, alreadyApplied: true, newBalance: 0 };
    }
    ledger.push({
      userId: input.userId,
      source: input.source,
      type: input.type,
      credits: input.amount,
      idempotencyKey: input.idempotencyKey,
    });
    return { success: true, alreadyApplied: false, newBalance: input.amount };
  });
  return { db, ledger };
}

beforeEach(() => {
  jest.clearAllMocks();
  resetNewPlayerBonusMemo();
});

describe("grantNewPlayerBonus", () => {
  it("pays 5,000 IxC through the ledger at account creation, with no country", async () => {
    const { db, ledger } = setup();

    const res = await grantNewPlayerBonus(db as never, USER_ID, "account_created");

    expect(res).toMatchObject({ granted: true, amount: 5000 });
    expect(earnOnce).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: USER_ID,
        amount: 5000,
        type: "EARN_BONUS",
        source: "bonus:new_player",
        idempotencyKey: `bonus:new_player:${USER_ID}`,
        metadata: { trigger: "account_created" },
      })
    );
    expect(ledger).toHaveLength(1);
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });

  it("makes the country builder / realm claim bonus a no-op afterwards", async () => {
    const { db, ledger } = setup();
    await grantNewPlayerBonus(db as never, USER_ID, "account_created");

    // What countries/management/create.ts and realms onNationAssigned call
    const countryPath = await grantBonus(db as never, CLERK_ID, NEW_PLAYER_BONUS_SOURCE, 5000, {
      oneTime: true,
      metadata: { countryId: "c1" },
    });

    expect(countryPath).toMatchObject({ granted: false, reason: "already_granted" });
    expect(ledger).toHaveLength(1);
  });

  it("does not pay a user who already received it via a country", async () => {
    // A bonus paid by the country path (or a legacy row written before idempotency keys)
    const { db, ledger } = setup([
      {
        userId: USER_ID,
        source: "bonus:new_player",
        type: "EARN_BONUS",
        credits: 5000,
        idempotencyKey: null,
      },
    ]);

    const res = await grantNewPlayerBonus(db as never, CLERK_ID, "vault_opened");

    expect(res.granted).toBe(false);
    expect(earnOnce).not.toHaveBeenCalled();
    expect(ledger).toHaveLength(1);
  });

  it("pays once however many times it is called (sign-up, then Vault opens)", async () => {
    const { db, ledger } = setup();

    await grantNewPlayerBonus(db as never, USER_ID, "account_created");
    await grantNewPlayerBonus(db as never, USER_ID, "vault_opened");
    resetNewPlayerBonusMemo(); // another process, or after a restart
    await grantNewPlayerBonus(db as never, USER_ID, "vault_opened");

    expect(ledger.filter((r) => r.source === "bonus:new_player")).toHaveLength(1);
  });

  it("skips the ledger read once this process knows the user was paid", async () => {
    const { db } = setup();
    await grantNewPlayerBonus(db as never, USER_ID, "account_created");
    const reads = db.user.findFirst.mock.calls.length;

    await grantNewPlayerBonus(db as never, USER_ID, "vault_opened");

    expect(db.user.findFirst.mock.calls.length).toBe(reads);
  });

  it("retries after a failed grant instead of remembering it", async () => {
    const { db } = setup();
    earnOnce.mockResolvedValueOnce({
      success: false,
      alreadyApplied: false,
      newBalance: 0,
      message: "maintenance",
    });

    const first = await grantNewPlayerBonus(db as never, USER_ID, "account_created");
    const second = await grantNewPlayerBonus(db as never, USER_ID, "vault_opened");

    expect(first.granted).toBe(false);
    expect(second.granted).toBe(true);
  });

  it("never throws", async () => {
    const { db } = setup();
    db.user.findFirst.mockRejectedValue(new Error("db down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(grantNewPlayerBonus(db as never, USER_ID, "account_created")).resolves.toEqual({
      granted: false,
      amount: 0,
      reason: "error",
    });
  });
});
