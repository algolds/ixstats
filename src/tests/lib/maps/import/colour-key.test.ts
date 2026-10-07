/** @jest-environment node */
import { matchColourKey, parseColourKey } from "~/lib/maps/import/colour-key";
import { checkNationName, suggestNations, autoMatchNations } from "~/lib/maps/import/nation-names";

describe("parseColourKey", () => {
  it("reads a CSV with a header, either column order and several colours per nation", () => {
    const key = parseColourKey(
      ["colour,nation", "#FF0000,Aurelia", "Borealis,#00ff00", "Aurelia,#ee0000,#dd0000", "#abc,Cyrene"].join("\n")
    );
    expect(key.problems).toEqual([]);
    expect(key.entries).toEqual([
      { hex: "#ff0000", nation: "Aurelia" },
      { hex: "#00ff00", nation: "Borealis" },
      { hex: "#ee0000", nation: "Aurelia" },
      { hex: "#dd0000", nation: "Aurelia" },
      { hex: "#aabbcc", nation: "Cyrene" },
    ]);
  });

  it("reports bad rows and a colour given to two nations (the first wins)", () => {
    const key = parseColourKey("#ff0000,Aurelia\nnot a colour,Nobody\n#ff0000,Borealis");
    expect(key.entries).toEqual([{ hex: "#ff0000", nation: "Aurelia" }]);
    expect(key.problems).toHaveLength(2);
    expect(key.problems[1]).toMatch(/already Aurelia/);
  });

  it("reads the JSON shapes", () => {
    expect(parseColourKey('{"#ff0000": "Aurelia"}').entries).toEqual([{ hex: "#ff0000", nation: "Aurelia" }]);
    expect(parseColourKey('{"Aurelia": ["#ff0000", "#ee0000"]}').entries).toHaveLength(2);
    expect(
      parseColourKey('[{"color": "#00ff00", "name": "Borealis"}, {"nation": "Cyrene", "colours": ["#0000ff"]}]').entries
    ).toEqual([
      { hex: "#00ff00", nation: "Borealis" },
      { hex: "#0000ff", nation: "Cyrene" },
    ]);
    expect(parseColourKey("[oops").problems[0]).toMatch(/JSON/);
  });
});

describe("matchColourKey", () => {
  it("pre-fills palette colours from the nearest key colour within the tolerance", () => {
    const { assignments, unusedKeyColours } = matchColourKey(
      ["#fe0101", "#00ff00", "#123456"],
      [
        { hex: "#ff0000", nation: "Aurelia" },
        { hex: "#00ff00", nation: "Borealis" },
        { hex: "#ffff00", nation: "Cyrene" },
      ]
    );
    expect(assignments).toEqual({ "#fe0101": "Aurelia", "#00ff00": "Borealis" });
    expect(unusedKeyColours).toEqual([{ hex: "#ffff00", nation: "Cyrene" }]);
  });
});

describe("nation names", () => {
  const candidates = [
    { name: "Kíziáuke", countryId: "c1" },
    { name: "Aurelian Empire" },
    { name: "Borealis", countryId: "c2" },
  ];

  it("matches case-, accent- and punctuation-blind, preferring the realm's country", () => {
    expect(checkNationName("kiziauke", candidates)).toEqual({ status: "matched", name: "Kíziáuke", countryId: "c1" });
    expect(autoMatchNations(["BOREALIS", "Nowhere"], candidates)).toEqual({ BOREALIS: "Borealis", Nowhere: null });
  });

  it("suggests close names for an unknown one instead of guessing", () => {
    const check = checkNationName("Aurelia Empire", candidates);
    expect(check.status).toBe("new");
    expect(check.status === "new" && check.suggestions[0]?.name).toBe("Aurelian Empire");
    expect(suggestNations("zzz", candidates)).toEqual([]);
    expect(checkNationName("  ", candidates)).toEqual({ status: "empty" });
  });
});
