import { describe, expect, it } from "@jest/globals";
import {
  localImageFileName,
  parseWikiImageRef,
  planImageLocalization,
} from "~/lib/flags/wiki-image-ref";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

describe("parseWikiImageRef", () => {
  it("reads a Special:FilePath URL on the media proxy", () => {
    expect(
      parseWikiImageRef("/api/mediawiki/iiwiki/wiki/Special:FilePath/Flag_of_Euandria.png")
    ).toEqual({ source: "iiwiki", fileName: "Flag of Euandria.png" });
  });

  it("decodes an encoded file name and drops a File: prefix", () => {
    expect(
      parseWikiImageRef(
        "/api/mediawiki/iiwiki/wiki/Special:FilePath/File%3AFlag%20of%20Mit%C5%8D.svg"
      )
    ).toEqual({ source: "iiwiki", fileName: "Flag of Mitō.svg" });
  });

  it("reads a proxied /images/ path, and a thumbnail's original", () => {
    expect(parseWikiImageRef("/api/mediawiki/althistory/images/a/ab/Flag.png")).toEqual({
      source: "althistory",
      fileName: "Flag.png",
    });
    expect(
      parseWikiImageRef("/api/mediawiki/iiwiki/images/thumb/e/ea/Flag_of_X.png/320px-Flag_of_X.png")
    ).toEqual({ source: "iiwiki", fileName: "Flag of X.png" });
  });

  it("reads https URLs on IxWiki, a sister wiki and its upload CDN", () => {
    expect(parseWikiImageRef(`${mediaWikiOrigin()}/images/9/9a/KiravianCoA.png`)).toEqual({
      source: "ixwiki",
      fileName: "KiravianCoA.png",
    });
    expect(parseWikiImageRef("https://iiwiki.com/wiki/Special:FilePath/Arms_of_X.svg")).toEqual({
      source: "iiwiki",
      fileName: "Arms of X.svg",
    });
    expect(
      parseWikiImageRef(
        "https://static.wikia.nocookie.net/althistory/images/a/ab/Flag_Y.svg/revision/latest?cb=1"
      )
    ).toEqual({ source: "althistory", fileName: "Flag Y.svg" });
  });

  it("refuses anything that is not a wiki file it can name", () => {
    for (const value of [
      null,
      "",
      "/flags/caphiria.png",
      "/images/uploads/uploaded_1_a.png",
      "https://evil.example/images/a/ab/X.png",
      "http://iiwiki.com/images/a/ab/X.png",
      "/api/mediawiki/commons/wiki/Special:FilePath/X.png",
      "/api/mediawiki/iiwiki/wiki/Special:FilePath/",
      "/api/mediawiki/iiwiki/wiki/Main_Page",
      "/api/mediawiki/iiwiki/images/a/ab/",
    ]) {
      expect(parseWikiImageRef(value)).toBeNull();
    }
  });
});

describe("localImageFileName", () => {
  it("names a flag <realm>--<country>.<ext> and arms <realm>--<country>--arms.<ext>", () => {
    expect(localImageFileName("eurth", "tagmatium", "flag", "png")).toBe("eurth--tagmatium.png");
    expect(localImageFileName("eurth", "tagmatium", "coatOfArms", "jpg")).toBe(
      "eurth--tagmatium--arms.jpg"
    );
  });

  it("folds slugs to [a-z0-9-] with single hyphens, so the -- separator stays unambiguous", () => {
    expect(localImageFileName("Eurth", "Côte--d'Or", "flag", "svg")).toBe("eurth--cote-d-or.svg");
  });

  it("refuses an empty slug", () => {
    expect(localImageFileName("eurth", "--", "flag", "png")).toBeNull();
  });
});

describe("planImageLocalization", () => {
  it("makes a task per wiki image and says why the rest are skipped", () => {
    const plan = planImageLocalization([
      {
        id: "a",
        slug: "dniester",
        flag: "/api/mediawiki/iiwiki/wiki/Special:FilePath/Republicdniesterflag.png",
        coatOfArms: "/flags/eurth--dniester--arms.png",
      },
      { id: "b", slug: "llalta", flag: null, coatOfArms: "/images/uploads/x.png" },
    ]);
    expect(plan.tasks).toEqual([
      {
        countryId: "a",
        countrySlug: "dniester",
        field: "flag",
        current: "/api/mediawiki/iiwiki/wiki/Special:FilePath/Republicdniesterflag.png",
        ref: { source: "iiwiki", fileName: "Republicdniesterflag.png" },
      },
    ]);
    expect(plan.skipped).toEqual([
      { countrySlug: "dniester", field: "coatOfArms", reason: "local" },
      { countrySlug: "llalta", field: "coatOfArms", reason: "not a wiki file" },
    ]);
  });
});
