import { describe, it, expect } from "@jest/globals";
import { checkProductionRequired } from "../../../scripts/deployment/verify-environment";

const valid = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
  CLERK_SECRET_KEY: "sk_live_x",
  IXTIME_BOT_SECRET: "bot",
  CRON_SECRET: "c".repeat(32),
  WIKI_SYNC_WEBHOOK_SECRET: "w".repeat(32),
};

describe("verify-environment production requirements", () => {
  it("passes when every production secret src/env.ts requires is set", () => {
    expect(checkProductionRequired(valid)).toEqual([]);
  });

  it("fails on a missing webhook secret (the app refuses to boot without it)", () => {
    const { WIKI_SYNC_WEBHOOK_SECRET: _omit, ...env } = valid;
    expect(checkProductionRequired(env)).toEqual([
      "WIKI_SYNC_WEBHOOK_SECRET is required in production",
    ]);
  });

  it("fails on a cron secret shorter than 32 characters", () => {
    expect(checkProductionRequired({ ...valid, CRON_SECRET: "short" })).toEqual([
      "CRON_SECRET must be at least 32 characters in production",
    ]);
  });
});
