/** @jest-environment node */
/** The Overview feed shows the audit rows' rarity, type, source and Economy field keys as the admin's labels. */
import { feedDetail } from "~/app/admin/cards/overview/feed-detail";

describe("feedDetail", () => {
  it.each([
    ["Rarity COMMON → ULTRA_RARE: a banner", "Rarity Common → Ultra rare: a banner"],
    [
      "Rarity table: althistory UNCOMMON 22, RARE 42, ULTRA_RARE 62, EPIC 82, LEGENDARY 97",
      "Rarity table: AltHistory Wiki Uncommon 22, Rare 42, Ultra rare 62, Epic 82, Legendary 97",
    ],
    ["Daily import: althistory on, 5 a day", "Daily import: AltHistory Wiki on, 5 a day"],
    ["Daily import: iiwiki off", "Daily import: IIWiki off"],
    [
      "Hid 2 cards matching realm eurth, type SPECIAL, rarity UNCOMMON, source commons: spam",
      "Hid 2 cards matching realm eurth, type Special, rarity Uncommon, source Wikimedia Commons: spam",
    ],
    [
      "Card values: floorRare 120, nsPremium 1.5",
      "Card values: Rare floor 120, NationStates bank value multiplier 1.5",
    ],
    [
      "Bonuses: enabled 0, nsPerCard 60",
      "Bonuses: Pay bonuses 0, NationStates import, per card 60",
    ],
    ["Market: auctionHouseRakePct 10", "Market: Market fee (%) 10"],
  ])("%s", (detail, shown) => {
    expect(feedDetail(detail)).toBe(shown);
  });

  it("leaves an admin's own words and unknown keys as written", () => {
    expect(feedDetail("Declined a suggestion: NS pages and type lists are not cards")).toBe(
      "Declined a suggestion: NS pages and type lists are not cards"
    );
    expect(feedDetail("Daily import: elsewhere on, 5 a day")).toBe(
      "Daily import: elsewhere on, 5 a day"
    );
    expect(feedDetail("Card values: someNewKey 3")).toBe("Card values: someNewKey 3");
  });
});
