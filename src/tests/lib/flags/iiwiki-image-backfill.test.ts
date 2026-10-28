/** @jest-environment node */
import { planIiwikiImagePaths } from "~/lib/flags/iiwiki-image-backfill";
import { iiwikiStoredImagePath } from "~/lib/wiki-os/sister-media";

describe("iiwikiStoredImagePath", () => {
  it("stores an IIWiki file URL as its proxy path, without the base path", () => {
    expect(iiwikiStoredImagePath("https://iiwiki.com/images/a/ab/Flag_of_Vonein.png")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag_of_Vonein.png"
    );
    expect(iiwikiStoredImagePath("https://iiwiki.com/wiki/Special:FilePath/Flag.svg")).toBe(
      "/api/mediawiki/iiwiki/wiki/Special:FilePath/Flag.svg"
    );
    expect(iiwikiStoredImagePath("https://iiwiki.com/wiki/Vonein")).toBeNull();
    expect(iiwikiStoredImagePath("https://ixwiki.com/images/a/ab/Flag.png")).toBeNull();
  });
});

describe("planIiwikiImagePaths", () => {
  it("rewrites only IIWiki file URLs, reports IIWiki page links, and leaves everything else", () => {
    const { updates, skipped } = planIiwikiImagePaths([
      {
        id: "1",
        name: "Vonein",
        flag: "https://iiwiki.com/images/a/ab/Flag_of_Vonein.png",
        coatOfArms: "/flags/vonein.png",
      },
      { id: "2", name: "Krasoa", flag: null, coatOfArms: "https://iiwiki.com/wiki/Krasoa" },
      { id: "3", name: "Done", flag: "/api/mediawiki/iiwiki/images/a/ab/X.png", coatOfArms: null },
    ]);
    expect(updates).toEqual([
      {
        id: "1",
        name: "Vonein",
        data: { flag: "/api/mediawiki/iiwiki/images/a/ab/Flag_of_Vonein.png" },
      },
    ]);
    expect(skipped).toEqual([
      { name: "Krasoa", field: "coatOfArms", value: "https://iiwiki.com/wiki/Krasoa" },
    ]);
  });
});
