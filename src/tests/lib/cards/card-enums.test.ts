/** @jest-environment node */
/** Cards refresh §2.1: the client mirror of the card enums, and the one rarity parser. */
import { CardFinish, CardRarity, CardType, parseCardRarity } from "~/lib/cards/enums";

describe("card enums", () => {
  it("has the refresh's six rarities, five types and four finishes, in order", () => {
    expect(Object.values(CardRarity)).toEqual([
      "COMMON",
      "UNCOMMON",
      "RARE",
      "ULTRA_RARE",
      "EPIC",
      "LEGENDARY",
    ]);
    expect(Object.values(CardType)).toEqual(["LORE", "NATION", "NS", "SPECIAL", "TROPHY"]);
    expect(Object.values(CardFinish)).toEqual(["STANDARD", "FOIL", "HOLO", "SERIALISED"]);
  });

  it("parses a rarity whatever its casing, hyphens or spaces, and nothing else", () => {
    expect(parseCardRarity("ultra-rare")).toBe("ULTRA_RARE");
    expect(parseCardRarity(" Ultra Rare ")).toBe("ULTRA_RARE");
    expect(parseCardRarity("legendary")).toBe("LEGENDARY");
    expect(parseCardRarity("toString")).toBeNull();
    expect(parseCardRarity("MYTHIC")).toBeNull();
    expect(parseCardRarity(null)).toBeNull();
  });
});
