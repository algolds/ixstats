/** @jest-environment node */
/** What the back and the sheet say about a card: NS facts, the ownership trail, the art credit and pack odds. */
import { artCreditOf, type ArtLicenceFacts } from "~/lib/cards/face/art-credit";
import { trailLabel, trailParties } from "~/lib/cards/face/trail";
import { packOddsRows } from "~/lib/cards/pack-odds";
describe("trail", () => {
  it("reads no label off the object prototype", () => {
    expect(trailLabel("constructor")).toBe("Moved");
    expect(trailLabel("toString")).toBe("Moved");
  });
  it("calls a player with no name (hidden, or with neither a handle nor a nation) a player", () => {
    const hidden = { name: null };
    expect(trailParties({ from: hidden, to: { name: "@b" } })).toBe("a player to @b");
    expect(trailParties({ from: { name: "@a" }, to: hidden })).toBe("@a to a player");
    expect(trailParties({ from: null, to: hidden })).toBe("to a player");
    expect(trailParties({ from: hidden, to: null })).toBe("from a player");
  });
});

describe("artCreditOf", () => {
  const licence: ArtLicenceFacts = {
    fileTitle: "File:Flag of Caphiria.svg",
    artist: "Maxim",
    licence: "CC BY-SA 4.0",
    attribution: null,
    descriptionUrl: "https://ixwiki.com/wiki/File:Flag_of_Caphiria.svg",
  };

  it("prefers the recorded licence, building a line when there is no attribution", () => {
    expect(artCreditOf({ artworkCredit: "old", artLicence: licence })).toEqual({
      line: "Flag of Caphiria.svg by Maxim, CC BY-SA 4.0",
      licence: "CC BY-SA 4.0",
      sourceUrl: "https://ixwiki.com/wiki/File:Flag_of_Caphiria.svg",
    });
  });
});

describe("pack odds", () => {
  const pack = {
    commonOdds: 65,
    uncommonOdds: 25,
    rareOdds: 7,
    ultraRareOdds: 2,
    epicOdds: 0.9,
    legendaryOdds: 0.1,
  };
  it("scales odds that do not add up to 100, and has no rows when nothing can drop", () => {
    expect(
      packOddsRows({
        ...pack,
        commonOdds: 130,
        uncommonOdds: 50,
        rareOdds: 14,
        ultraRareOdds: 4,
        epicOdds: 1.8,
        legendaryOdds: 0.2,
      })[0]!.percent
    ).toBeCloseTo(65);
    expect(
      packOddsRows({
        commonOdds: 0,
        uncommonOdds: 0,
        rareOdds: 0,
        ultraRareOdds: 0,
        epicOdds: 0,
        legendaryOdds: -1,
      })
    ).toEqual([]);
  });

  it("ignores a negative odd rather than taking it off the total", () => {
    const rows = packOddsRows({ ...pack, legendaryOdds: -5 });
    expect(rows.map((r) => r.rarity)).not.toContain("LEGENDARY");
    expect(rows[0]!.percent).toBeCloseTo((65 / 99.9) * 100);
  });
});
