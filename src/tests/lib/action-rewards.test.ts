/** @jest-environment node */
import {
  actionRewardKey,
  actionRewardLockKey,
  rewardLine,
  startOfUtcDay,
} from "~/lib/action-rewards";

describe("action reward names", () => {
  it("keys the payout by the action alone, whatever post links it", () => {
    expect(actionRewardKey("dir-abc")).toBe("forum_action:dir-abc");
  });

  it("locks per country", () => {
    expect(actionRewardLockKey("c1")).toBe("action-reward:c1");
  });
});

describe("startOfUtcDay", () => {
  it("is midnight UTC of the same day", () => {
    expect(startOfUtcDay(new Date("2026-10-17T23:59:59.999Z")).toISOString()).toBe(
      "2026-10-17T00:00:00.000Z"
    );
    expect(startOfUtcDay(new Date("2026-10-17T00:00:00.000Z")).toISOString()).toBe(
      "2026-10-17T00:00:00.000Z"
    );
  });
});

describe("rewardLine", () => {
  it("names the amount", () => {
    expect(rewardLine(5)).toBe("+5 IxC for posting your action");
  });

  it("rounds a fraction to two places", () => {
    expect(rewardLine(2.456)).toBe("+2.46 IxC for posting your action");
  });
});
