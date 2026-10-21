import { describe, expect, it } from "@jest/globals";
import {
  localImageFileName,
  parseWikiImageRef
} from "~/lib/flags/wiki-image-ref";
describe("parseWikiImageRef", () => {
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
