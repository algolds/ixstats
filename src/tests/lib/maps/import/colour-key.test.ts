/** @jest-environment node */
import { parseColourKey } from "~/lib/maps/import/colour-key";
import { checkNationName, autoMatchNations } from "~/lib/maps/import/nation-names";

describe("parseColourKey", () => {
  it("reports bad rows and a colour given to two nations (the first wins)", () => {
    const key = parseColourKey("#ff0000,Aurelia\nnot a colour,Nobody\n#ff0000,Borealis");
    expect(key.entries).toEqual([{ hex: "#ff0000", nation: "Aurelia" }]);
    expect(key.problems).toHaveLength(2);
    expect(key.problems[1]).toMatch(/already Aurelia/);
  });
});
describe("nation names", () => {
  const candidates = [
    { name: "Kíziáuke", countryId: "c1" },
    { name: "Aurelian Empire" },
    { name: "Borealis", countryId: "c2" },
  ];

  it("matches case-, accent- and punctuation-blind, preferring the realm's country", () => {
    expect(checkNationName("kiziauke", candidates)).toEqual({
      status: "matched",
      name: "Kíziáuke",
      countryId: "c1",
    });
    expect(autoMatchNations(["BOREALIS", "Nowhere"], candidates)).toEqual({
      BOREALIS: "Borealis",
      Nowhere: null,
    });
    // The editor's matcher drops state forms: "Republic of Borealis" is Borealis.
    expect(checkNationName("Republic of Borealis", candidates)).toEqual({
      status: "matched",
      name: "Borealis",
      countryId: "c2",
    });
  });
});
