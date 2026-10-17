/** @jest-environment node */
/** Card art licences (licensing drafts §2.5(c)): NC and ND block an import, free licences are open, the rest unknown. */
import {
  classifyLicence,
  commonsCardTitle,
  fileNameFromArtworkUrl,
  licenceTemplates,
} from "~/lib/cards/art-licence";

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
  it("reads every template name and parameter on a File page", () => {
    expect(
      licenceTemplates("== Licensing ==\n{{Fairuse}}\n{{self|cc-by-sa-4.0}}\n[[Category:People]]")
    ).toEqual(["Fairuse", "self", "cc-by-sa-4.0"]);
    expect(licenceTemplates("{{ PD-old | }}")).toEqual(["PD-old"]);
    expect(licenceTemplates("")).toEqual([]);
  });
});

describe("fileNameFromArtworkUrl", () => {
  it.each([
    [
      "https://static.wikia.nocookie.net/althistory/images/d/df/0A3512348.jpeg/revision/latest?cb=20190116171422",
      "0A3512348.jpeg",
    ],
    [
      "https://static.wikia.nocookie.net/althistory/images/5/5c/Cristiano_Ronaldo_2018_%28cropped%29.jpg/revision/latest?cb=1",
      "Cristiano_Ronaldo_2018_(cropped).jpg",
    ],
    [
      "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg?utm_source=commons.wikimedia.org",
      "Flag_of_Ireland.svg",
    ],
    [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Flag_of_Ireland.svg/320px-Flag_of_Ireland.svg.png",
      "Flag_of_Ireland.svg",
    ],
    ["https://ixwiki.com/images/1/16/%22HMPH%21%22_Original.png", '"HMPH!"_Original.png'],
    ["https://iiwiki.com/images/thumb/a/ab/Elm.png/300px-Elm.png", "Elm.png"],
    ["/api/wiki/file/Caphiria_flag.svg", "Caphiria_flag.svg"],
    ["https://iiwiki.com/images/a/ab/100%25_Bad.png", "100%_Bad.png"],
    ["https://iiwiki.com/images/a/ab/Broken%E0%A4%A.png", "Broken%E0%A4%A.png"],
  ])("%s names %s", (url, name) => {
    expect(fileNameFromArtworkUrl(url)).toBe(name);
  });

  it("is null for art that names no wiki file", () => {
    expect(
      fileNameFromArtworkUrl("https://www.nationstates.net/images/cards/s3/ab.jpg")
    ).toBeNull();
    expect(fileNameFromArtworkUrl(null)).toBeNull();
    expect(fileNameFromArtworkUrl(undefined)).toBeNull();
    expect(fileNameFromArtworkUrl("")).toBeNull();
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
