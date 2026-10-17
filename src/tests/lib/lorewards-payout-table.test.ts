/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import { LOREWARD_PAYOUTS, lorewardBonusKey } from "~/lib/vault/vault-bonus";

describe("the Loreward payout table", () => {
  it("pays winners more than runner-ups, by contest", () => {
    expect(LOREWARD_PAYOUTS).toEqual({
      daily: { winner: 500, "runner-up": 150 },
      weekly: { winner: 1500, "runner-up": 400 },
      monthly: { winner: 4000, "runner-up": 1000 },
    });
  });

  it("keeps the legacy winner key and gives the runner-up its own", () => {
    expect(lorewardBonusKey("e1", "winner")).toBe("bonus:loreward:e1");
    expect(lorewardBonusKey("e1", "runner-up")).toBe("bonus:loreward:e1:runner-up");
  });
});
