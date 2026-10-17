/** @jest-environment node */
/** Card art licences (licensing drafts §2.5(c)): NC and ND block an import, free licences are open, the rest unknown. */
import {
  classifyLicence,
  commonsCardTitle,
  fileNameFromArtworkUrl,
  licenceTemplates,
} from "~/lib/cards/art-licence";
import type { CardWikiSource } from "~/lib/cards/card-sources";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

describe("classifyLicence", () => {
  it.each([
    ["CC BY-NC-SA 4.0", "RESTRICTED"],
    ["cc-by-nd-3.0", "RESTRICTED"],
    ["Creative Commons Attribution-NonCommercial 2.0", "RESTRICTED"],
    ["Attribution-NoDerivs 3.0 Unported", "RESTRICTED"],
    ["Creative Commons Attribution-Share Alike 3.0", "OPEN"],
    ["CC BY-SA 4.0", "OPEN"],
    ["cc-by-sa-3.0", "OPEN"],
    ["CC0", "OPEN"],
    ["Public domain", "OPEN"],
    ["PD-self", "OPEN"],
    ["GNU Free Documentation License", "OPEN"],
    ["GFDL", "OPEN"],
    ["Free Art License", "OPEN"],
    ["Fairuse", "UNKNOWN"],
    ["Fair use files", "UNKNOWN"],
    ["All rights reserved", "UNKNOWN"],
    ["and", "UNKNOWN"],
  ])("%s is %s", (text, status) => {
    expect(classifyLicence([text])).toBe(status);
  });

  it("is unknown with nothing to read, and restricted wins over open", () => {
    expect(classifyLicence([null, undefined, "  "])).toBe("UNKNOWN");
    expect(classifyLicence([])).toBe("UNKNOWN");
    expect(classifyLicence(["CC BY-SA 4.0", "CC BY-NC 4.0"])).toBe("RESTRICTED");
    expect(classifyLicence(["Fairuse", "CC BY-SA 4.0"])).toBe("OPEN");
  });
});

describe("licenceTemplates", () => {
  it("reads every template name and its one-token positional parameters on a File page", () => {
    expect(
      licenceTemplates("== Licensing ==\n{{Fairuse}}\n{{self|cc-by-sa-4.0}}\n[[Category:People]]")
    ).toEqual(["Fairuse", "self", "cc-by-sa-4.0"]);
    expect(licenceTemplates("{{ PD-old | }}")).toEqual(["PD-old"]);
    expect(licenceTemplates("{{self|GFDL|PD-self}}")).toEqual(["self", "GFDL", "PD-self"]);
    expect(licenceTemplates("")).toEqual([]);
  });

  it("never reads named parameters or free text", () => {
    expect(licenceTemplates("{{Information|description=PD scan|author=NC}}")).toEqual([
      "Information",
    ]);
    expect(licenceTemplates("{{en|PD scan}}")).toEqual(["en"]);
    expect(licenceTemplates("{{Fairuse|Logo of ND Corp}}")).toEqual(["Fairuse"]);
  });
});

describe("fileNameFromArtworkUrl", () => {
  const FANDOM = "static.wikia.nocookie.net/althistory/images";

  it.each<[string, CardWikiSource, string]>([
    [
      `https://${FANDOM}/d/df/0A3512348.jpeg/revision/latest?cb=20190116171422`,
      "althistory",
      "0A3512348.jpeg",
    ],
    [
      `https://${FANDOM}/5/5c/Cristiano_Ronaldo_2018_%28cropped%29.jpg/revision/latest?cb=1`,
      "althistory",
      "Cristiano_Ronaldo_2018_(cropped).jpg",
    ],
    [
      "https://vignette.wikia.nocookie.net/althistory/images/a/ab/Elm.png/revision/latest?cb=1",
      "althistory",
      "Elm.png",
    ],
    [
      "https://img1.wikia.nocookie.net/__cb20120101/althistory/images/a/ab/Elm.png",
      "althistory",
      "Elm.png",
    ],
    ["https://images.wikia.com/althistory/images/a/ab/Elm.png", "althistory", "Elm.png"],
    ["https://althistory.fandom.com/images/a/ab/Elm.png", "althistory", "Elm.png"],
    [
      "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg?utm_source=commons.wikimedia.org",
      "commons",
      "Flag_of_Ireland.svg",
    ],
    [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Flag_of_Ireland.svg/320px-Flag_of_Ireland.svg.png",
      "commons",
      "Flag_of_Ireland.svg",
    ],
    // IxWiki shows Commons files through InstantCommons.
    [
      "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg",
      "ixwiki",
      "Flag_of_Ireland.svg",
    ],
    [
      `${mediaWikiOrigin()}/images/1/16/%22HMPH%21%22_Original.png`,
      "ixwiki",
      '"HMPH!"_Original.png',
    ],
    ["https://iiwiki.com/images/thumb/a/ab/Elm.png/300px-Elm.png", "iiwiki", "Elm.png"],
    ["/api/wiki/file/Caphiria_flag.svg", "ixwiki", "Caphiria_flag.svg"],
    ["https://iiwiki.com/images/a/ab/100%25_Bad.png", "iiwiki", "100%_Bad.png"],
    ["https://iiwiki.com/images/a/ab/Broken%E0%A4%A.png", "iiwiki", "Broken%E0%A4%A.png"],
  ])("%s names %s's %s", (url, source, name) => {
    expect(fileNameFromArtworkUrl(url, source)).toBe(name);
  });

  it.each<[string, CardWikiSource]>([
    // Another host's art never names a source wiki's same-named file.
    ["https://evil.example/images/a/ab/X.png", "iiwiki"],
    ["https://evil.example/images/a/ab/X.png", "ixwiki"],
    ["https://iiwiki.com.evil.example/images/a/ab/X.png", "iiwiki"],
    ["https://iiwiki.com/images/a/ab/X.png", "althistory"],
    [`${mediaWikiOrigin()}/images/1/16/X.png`, "iiwiki"],
    ["https://upload.wikimedia.org/wikipedia/commons/4/45/X.svg", "iiwiki"],
    ["https://upload.wikimedia.org/wikipedia/en/4/45/X.svg", "commons"],
    // Another Fandom wiki's file (and AltHistory's German wiki is another wiki).
    ["https://static.wikia.nocookie.net/starwars/images/a/ab/X.png", "althistory"],
    [
      "https://static.wikia.nocookie.net/althistory/de/images/a/ab/X.png/revision/latest",
      "althistory",
    ],
    [`https://${FANDOM}/a/ab/X.png/revision/latest`, "iiwiki"],
    ["/api/wiki/file/X.svg", "commons"],
    ["/images/cards/lore-placeholder.svg", "ixwiki"],
    ["ftp://iiwiki.com/images/a/ab/X.png", "iiwiki"],
    ["https://www.nationstates.net/images/cards/s3/ab.jpg", "ixwiki"],
    ["not a url", "ixwiki"],
  ])("%s names no %s file", (url, source) => {
    expect(fileNameFromArtworkUrl(url, source)).toBeNull();
  });

  it("is null without a URL", () => {
    expect(fileNameFromArtworkUrl(null, "ixwiki")).toBeNull();
    expect(fileNameFromArtworkUrl(undefined, "ixwiki")).toBeNull();
    expect(fileNameFromArtworkUrl("", "ixwiki")).toBeNull();
  });
});

describe("commonsCardTitle", () => {
  it("drops the namespace and extension and spaces the underscores", () => {
    expect(commonsCardTitle("File:Flag_of_Ireland.svg")).toBe("Flag of Ireland");
    expect(commonsCardTitle("Flag of the Holy See.png")).toBe("Flag of the Holy See");
    expect(commonsCardTitle("file:Coat of arms.JPEG")).toBe("Coat of arms");
    expect(commonsCardTitle("File:Map.tif")).toBe("Map.tif");
  });
});
