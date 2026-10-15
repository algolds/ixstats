import { formatDailyRewardWait, msUntilNextDailyReward } from "~/lib/vault/next-daily-reward";

const at = (iso: string) => new Date(iso);

describe("next daily reward", () => {
  it("counts to the coming UTC midnight", () => {
    expect(msUntilNextDailyReward(at("2026-10-14T18:00:00Z"))).toBe(6 * 3_600_000);
    expect(msUntilNextDailyReward(at("2026-10-14T00:00:00Z"))).toBe(24 * 3_600_000);
  });

  it("rounds hours up", () => {
    expect(formatDailyRewardWait(at("2026-10-14T17:30:00Z"))).toBe("7h");
    expect(formatDailyRewardWait(at("2026-10-14T18:00:00Z"))).toBe("6h");
  });

  it("switches to minutes in the last hour", () => {
    expect(formatDailyRewardWait(at("2026-10-14T23:30:00Z"))).toBe("30m");
    expect(formatDailyRewardWait(at("2026-10-14T23:59:59Z"))).toBe("1m");
  });
});
