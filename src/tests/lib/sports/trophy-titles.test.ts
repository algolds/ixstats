/** @jest-environment node */
import {
  seasonChampionsTitle,
  SPORTS_TROPHY_TITLE,
  worldCupChampionsTitle,
} from "~/lib/sports/trophy-titles";

describe("sports trophy titles", () => {
  it("builds the two championship titles, and the matcher knows both and nothing else", () => {
    expect(seasonChampionsTitle("Kiro Reds", 3)).toBe("Kiro Reds Season 3 Champions");
    expect(worldCupChampionsTitle("Caphiria", 12)).toBe("Caphiria World Cup Season 12 Champions");
    expect(SPORTS_TROPHY_TITLE.test(seasonChampionsTitle("Kiro Reds", 3))).toBe(true);
    expect(SPORTS_TROPHY_TITLE.test(worldCupChampionsTitle("Caphiria", 12))).toBe(true);
    expect(SPORTS_TROPHY_TITLE.test("Veteran")).toBe(false);
    expect(SPORTS_TROPHY_TITLE.test("Season 3 Champions")).toBe(false);
  });
});
