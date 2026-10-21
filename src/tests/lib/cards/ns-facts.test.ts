/** @jest-environment node */
/** Cards refresh §2.1: NS cards keep only facts, in metadata.nsData. */
import {
  nsBankValue,
  nsFactsFromApi,
  nsFactsOf,
  nsNationKey,
  pickNsFacts,
  withNsFacts,
} from "~/lib/cards/ns-facts";

describe("NS facts", () => {
  it("keeps only the fact keys, the first source holding a key winning", () => {
    expect(
      pickNsFacts(
        { region: "Abydos", govt: "Centrist Democracy" },
        { region: "Old", category: "Empire", market_value: "0.05", badge: "x" },
        { id: 2648803, season: "2" }
      )
    ).toEqual({
      region: "Abydos",
      category: "Empire",
      market_value: "0.05",
      id: "2648803",
      season: "2",
    });
    expect(pickNsFacts(null, "text", [1])).toEqual({});
  });

  it("reads facts and the bank value from metadata.nsData", () => {
    const metadata = { importedFrom: "region:x", nsData: { name: "Heku", market_value: "1.25" } };
    expect(nsFactsOf(metadata)).toEqual({ name: "Heku", market_value: "1.25" });
    expect(nsBankValue(metadata)).toBe(1.25);
    expect(nsBankValue({ nsData: { market_value: "n/a" } })).toBeNull();
    expect(nsBankValue(null)).toBeNull();
  });

  it("takes an NS API card's facts and drops the rest", () => {
    expect(
      nsFactsFromApi({
        id: "7",
        name: "Heku",
        season: "3",
        region: "",
        flag: "f.png",
        market_value: "0.10",
      })
    ).toEqual({ id: "7", name: "Heku", season: "3", flag: "f.png", market_value: "0.10" });
  });

  it("writes facts beside the other metadata keys", () => {
    expect(withNsFacts({ importedFrom: "a", nsData: { govt: "x" } }, { name: "Heku" })).toEqual({
      importedFrom: "a",
      nsData: { name: "Heku" },
    });
  });

  it("keys a nation as the once-per-nation bonus does", () => {
    expect(nsNationKey("  New   Heku ")).toBe("new_heku");
  });
});
