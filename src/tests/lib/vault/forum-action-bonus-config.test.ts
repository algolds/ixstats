/** @jest-environment node */
import { getBonusConfig, setBonusConfig, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";

jest.mock("~/lib/vault/vault-service", () => ({
  earnCreditsOnce: jest.fn(),
  vaultService: {},
}));

function fakeDb(rows: Array<{ key: string; value: string }> = []) {
  return {
    systemConfig: {
      findMany: jest.fn(async () => rows),
      upsert: jest.fn(async (_args: object) => ({})),
    },
  };
}

describe("forum action bonus config", () => {
  beforeEach(async () => {
    // setBonusConfig clears the module's cache.
    await setBonusConfig(fakeDb() as never, "enabled", 1);
  });

  it("defaults to 5 IxC and 3 rewarded actions per country per day", () => {
    expect(VAULT_BONUS_DEFAULTS.forumActionReward).toBe(5);
    expect(VAULT_BONUS_DEFAULTS.forumActionDailyCap).toBe(3);
  });

  it("reads both amounts from their vault_bonus_ keys", async () => {
    const db = fakeDb([
      { key: "vault_bonus_forum_action_reward", value: "8" },
      { key: "vault_bonus_forum_action_daily_cap", value: "2" },
    ]);
    const cfg = await getBonusConfig(db as never);
    expect(cfg.forumActionReward).toBe(8);
    expect(cfg.forumActionDailyCap).toBe(2);
  });

  it("ignores a value that is not a number and keeps the default", async () => {
    const db = fakeDb([{ key: "vault_bonus_forum_action_reward", value: "lots" }]);
    const cfg = await getBonusConfig(db as never);
    expect(cfg.forumActionReward).toBe(5);
  });

  it("writes each field under its own key", async () => {
    const db = fakeDb();
    await setBonusConfig(db as never, "forumActionReward", 7);
    await setBonusConfig(db as never, "forumActionDailyCap", 4);
    expect(db.systemConfig.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { key: "vault_bonus_forum_action_reward" } })
    );
    expect(db.systemConfig.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { key: "vault_bonus_forum_action_daily_cap" },
        update: { value: "4" },
      })
    );
  });
});
