/** @jest-environment node */
/** What the back and the sheet say about a card: NS facts, the ownership trail, the art credit and pack odds. */
import { artCreditOf, type ArtLicenceFacts } from "~/lib/cards/face/art-credit";
import { nsProvenanceOf } from "~/lib/cards/face/ns-provenance";
import { trailLabel, trailParties } from "~/lib/cards/face/trail";
import { MINT_SOURCES } from "~/lib/cards/mint";
import { formatOdds, packOddsRows } from "~/lib/cards/pack-odds";

describe("nsProvenanceOf", () => {
  it("reads the nation, season, region and category, and links the card on NationStates", () => {
    expect(
      nsProvenanceOf({
        title: "Testlandia",
        nsCardId: 42,
        nsSeason: 3,
        metadata: {
          nsData: {
            name: "Testlandia Prime",
            region: "The Pacific",
            category: "Mother Knows Best State",
          },
        },
      })
    ).toEqual({
      nation: "Testlandia Prime",
      season: 3,
      region: "The Pacific",
      category: "Mother Knows Best State",
      cardUrl: "https://www.nationstates.net/page=deck/card=42/season=3",
      nationUrl: "https://www.nationstates.net/nation=testlandia_prime",
    });
  });

  it("falls back to the card's own fields when the metadata is missing or malformed", () => {
    expect(
      nsProvenanceOf({ title: "Nowhere", nsCardId: null, nsSeason: null, metadata: "junk" })
    ).toEqual({
      nation: "Nowhere",
      season: null,
      region: null,
      category: null,
      cardUrl: null,
      nationUrl: "https://www.nationstates.net/nation=nowhere",
    });
  });

  it("reads the id and season from the stored facts when the columns are empty", () => {
    const provenance = nsProvenanceOf({
      title: "Testlandia",
      nsCardId: null,
      nsSeason: null,
      metadata: { nsData: { id: "42", season: "2" } },
    });
    expect(provenance.season).toBe(2);
    expect(provenance.cardUrl).toBe("https://www.nationstates.net/page=deck/card=42/season=2");
  });

  it("links no card page without a positive id and season", () => {
    for (const nsData of [
      { id: "0", season: "2" },
      { id: "42", season: "-1" },
      { id: "x", season: "2" },
      { id: "42abc", season: "2" },
      { id: "42", season: "1.5" },
    ]) {
      expect(
        nsProvenanceOf({ title: "T", nsCardId: null, nsSeason: null, metadata: { nsData } }).cardUrl
      ).toBeNull();
    }
    expect(
      nsProvenanceOf({ title: "T", nsCardId: 42, nsSeason: null, metadata: null }).cardUrl
    ).toBeNull();
  });

  it("reads only whole numbers as the id and season", () => {
    const provenance = (nsData: Record<string, string>) =>
      nsProvenanceOf({ title: "T", nsCardId: null, nsSeason: null, metadata: { nsData } });
    expect(provenance({ id: "42abc", season: "2" }).cardUrl).toBeNull();
    expect(provenance({ id: "42", season: "1.5" }).season).toBeNull();
    expect(provenance({ id: "42", season: "3abc" }).season).toBeNull();
    expect(provenance({ id: "42", season: "3" }).season).toBe(3);
  });

  it("encodes the nation in its link", () => {
    expect(
      nsProvenanceOf({ title: "Côte & Co", nsCardId: null, nsSeason: null, metadata: null })
        .nationUrl
    ).toBe("https://www.nationstates.net/nation=c%C3%B4te_%26_co");
  });
});

describe("trail", () => {
  it("names known moves and falls back for new ones", () => {
    expect(trailLabel("PACK_OPEN")).toBe("Pulled from a pack");
    expect(trailLabel("AUCTION_BUYOUT")).toBe("Bought at auction");
    expect(trailLabel("SOMETHING_NEW")).toBe("Moved");
  });

  it("names the actions the writers record", () => {
    expect(trailLabel("NS_DECK_IMPORT")).toBe("Imported from NationStates");
    expect(trailLabel("REISSUE")).toBe("Granted again");
    expect(trailLabel("REASSIGN")).toBe("Reassigned by staff");
    expect(trailLabel("ADMIN")).toBe("Granted by staff");
    for (const source of MINT_SOURCES) expect(trailLabel(source)).not.toBe("Moved");
  });

  it("reads no label off the object prototype", () => {
    expect(trailLabel("constructor")).toBe("Moved");
    expect(trailLabel("toString")).toBe("Moved");
  });

  it("names each side as the server names them: a handle, or a nation", () => {
    const a = { name: "@a" };
    const b = { name: "Caphiria" };
    expect(trailParties({ from: a, to: b })).toBe("@a to Caphiria");
    expect(trailParties({ from: null, to: b })).toBe("to Caphiria");
    expect(trailParties({ from: a, to: null })).toBe("from @a");
    expect(trailParties({ from: null, to: null })).toBeNull();
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

  it("uses the recorded attribution as the line when there is one", () => {
    expect(
      artCreditOf({
        artworkCredit: null,
        artLicence: { ...licence, attribution: " Maxim, CC BY-SA " },
      })
    ).toEqual({
      line: "Maxim, CC BY-SA",
      licence: "CC BY-SA 4.0",
      sourceUrl: licence.descriptionUrl,
    });
  });

  it("builds the line from whatever the licence names", () => {
    const line = (facts: Partial<ArtLicenceFacts>) =>
      artCreditOf({ artworkCredit: null, artLicence: { ...licence, ...facts } })?.line;
    expect(line({ artist: null })).toBe("Flag of Caphiria.svg, CC BY-SA 4.0");
    expect(line({ fileTitle: null })).toBe("Maxim, CC BY-SA 4.0");
    expect(line({ licence: null })).toBe("Flag of Caphiria.svg by Maxim");
  });

  it("links only a web page", () => {
    expect(
      artCreditOf({
        artworkCredit: null,
        artLicence: { ...licence, descriptionUrl: "javascript:alert(1)" },
      })?.sourceUrl
    ).toBeNull();
    expect(
      artCreditOf({ artworkCredit: null, artLicence: { ...licence, descriptionUrl: null } })
        ?.sourceUrl
    ).toBeNull();
  });

  it("uses the stored credit line otherwise, and nothing when there is none", () => {
    expect(artCreditOf({ artworkCredit: " Photo: Jo ", artLicence: null })).toEqual({
      line: "Photo: Jo",
      licence: null,
      sourceUrl: null,
    });
    expect(
      artCreditOf({
        artworkCredit: " Photo: Jo ",
        artLicence: {
          fileTitle: null,
          licence: null,
          artist: null,
          attribution: "  ",
          descriptionUrl: null,
        },
      })?.line
    ).toBe("Photo: Jo");
    expect(
      artCreditOf({
        artworkCredit: null,
        artLicence: {
          fileTitle: null,
          licence: null,
          artist: null,
          attribution: null,
          descriptionUrl: "javascript:x",
        },
      })
    ).toBeNull();
    expect(artCreditOf({ artworkCredit: "   ", artLicence: null })).toBeNull();
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

  it("lists each rarity's share, rarest last, leaving out rarities the pack never gives", () => {
    const rows = packOddsRows({ ...pack, epicOdds: 0 });
    expect(rows.map((r) => r.rarity)).toEqual([
      "COMMON",
      "UNCOMMON",
      "RARE",
      "ULTRA_RARE",
      "LEGENDARY",
    ]);
    expect(rows[3]!.label).toBe("Ultra Rare");
    expect(rows.reduce((sum, r) => sum + r.percent, 0)).toBeCloseTo(100);
  });

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

  it("formats shares for reading", () => {
    expect(formatOdds(65)).toBe("65%");
    expect(formatOdds(10.4)).toBe("10%");
    expect(formatOdds(9.96)).toBe("10%");
    expect(formatOdds(2.46)).toBe("2.5%");
    expect(formatOdds(0.1)).toBe("0.1%");
    expect(formatOdds(0.04)).toBe("under 0.1%");
  });
});
