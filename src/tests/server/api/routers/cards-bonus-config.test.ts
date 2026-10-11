/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (the hoisted jest.mock factories rely on the ambient global).
jest.mock("~/lib/cards/valuation", () => ({
  __esModule: true,
  JUNK_RATE_MAX: 1,
  getValuationConfig: jest.fn(),
  recomputeAllCardValues: jest.fn(),
  setValuationConfig: jest.fn(),
}));
jest.mock("~/lib/cards/general-settings", () => ({
  __esModule: true,
  getGeneralCardSettings: jest.fn(),
  setGeneralCardSetting: jest.fn(),
}));
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  earnCreditsOnce: jest.fn(),
  vaultService: {},
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsSettingsRouter } from "~/server/api/routers/cards/settings";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const admin = {
  id: "db_admin",
  clerkUserId: "admin_1",
  role: { name: "admin", level: 10 },
};

function caller() {
  const db = {
    systemConfig: {
      findMany: jest.fn(async () => []),
      upsert: jest.fn(async (_args: { where: { key: string } }) => ({})),
    },
  };
  const ctx = createMockRouterContext({ auth: { userId: "admin_1" }, user: admin, db });
  return { db, caller: createCallerFactory(cardsSettingsRouter)(ctx as never) };
}

describe("cards.setBonusConfig forum fields", () => {
  it("saves the forum reward and cap", async () => {
    const { db, caller: c } = caller();
    await c.setBonusConfig({ forumActionReward: 6, forumActionDailyCap: 2 });
    const keys = db.systemConfig.upsert.mock.calls.map(([args]) => args.where.key);
    expect(keys).toEqual(["vault_bonus_forum_action_reward", "vault_bonus_forum_action_daily_cap"]);
  });

  it.each([
    ["a negative reward", { forumActionReward: -1 }],
    ["a reward over 1,000", { forumActionReward: 1001 }],
    ["a fractional cap", { forumActionDailyCap: 2.5 }],
    ["a cap over 100", { forumActionDailyCap: 101 }],
  ])("refuses %s", async (_label, input) => {
    const { db, caller: c } = caller();
    await expect(c.setBonusConfig(input)).rejects.toThrow();
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  });
});
