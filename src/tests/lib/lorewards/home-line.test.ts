import { lorewardsHomeLine } from "~/lib/lorewards/home-line";
import type { TrophyCardSummary } from "~/lib/lorewards/trophy-summary";

const card = {} as TrophyCardSummary;
const base = {
  wins: { daily: 0, weekly: 0, monthly: 0 },
  cards: [],
  wikiUsername: null,
  todayRank: null,
};

describe("lorewardsHomeLine", () => {
  it("points a player with no name, win or card to editing or claiming", () => {
    expect(lorewardsHomeLine(base)).toBe("Edit the wiki or claim an old IxWiki name");
  });

  it("shows held trophy cards even with no wiki name", () => {
    expect(lorewardsHomeLine({ ...base, cards: [card, card] })).toBe("0 wins · 2 trophy cards");
  });

  it("sums the wins and adds today's rank", () => {
    expect(
      lorewardsHomeLine({
        ...base,
        wikiUsername: "Kir",
        wins: { daily: 1, weekly: 0, monthly: 0 },
        todayRank: 3,
      })
    ).toBe("1 win · Today #3");
  });
});
