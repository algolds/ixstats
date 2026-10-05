import { activitySourceLabel } from "~/lib/vault/activity-labels";

describe("activitySourceLabel", () => {
  it.each([
    ["bonus:new_player", "New player bonus"],
    ["bonus:loreward:abc123", "Loreward bonus"],
    ["DAILY_DIVIDEND", "Daily nation dividend"],
    ["DAILY_NATION_DIVIDEND", "Daily nation dividend"],
    ["DAILY_LOGIN", "Daily reward"],
    ["DAILY_LOGIN_CREDITS", "Daily reward"],
    ["P2P_TRADE", "Player trade"],
    ["auction_bid_reserve", "Auction bid reserved"],
    ["exploit_correction:repeat_one_time_bonus", "Balance correction"],
  ])("maps %s to %s", (source, label) => {
    expect(activitySourceLabel(source)).toBe(label);
  });

  it("keeps already readable sources", () => {
    expect(activitySourceLabel("Purchase item: Gold frame")).toBe("Purchase item: Gold frame");
  });

  it("sentence-cases unknown keys", () => {
    expect(activitySourceLabel("SOME_NEW_SOURCE")).toBe("Some new source");
    expect(activitySourceLabel("auction_bid_refund")).toBe("Auction bid refund");
    expect(activitySourceLabel("DAILY_NATION_DIVIDEND")).toBe("Daily nation dividend");
    expect(activitySourceLabel("bonus:spring_event")).toBe("Spring event bonus");
  });
});
