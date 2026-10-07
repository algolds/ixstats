/** @jest-environment node */
import { withBasePath } from "~/lib/base-path";
import {
  asFileTitle,
  attributionLine,
  metadataText,
  parseImageInfo,
  proxiedFileUrl,
  type ImageInfoResponse,
} from "~/lib/realms/sources/wiki-file-info";
import { IIWIKI_FIXTURES } from "~/tests/helpers/iiwiki-fixtures";

describe("imageinfo parsing", () => {
  const files = parseImageInfo("iiwiki", IIWIKI_FIXTURES.imageinfo as ImageInfoResponse);

  it("reads URL, size, type, SHA-1 (lower-cased), description page, licence and author", () => {
    expect(files.get("File:Eurth political map 2024.png")).toEqual({
      fileTitle: "File:Eurth political map 2024.png",
      url: "https://iiwiki.com/images/3/3a/Eurth_political_map_2024.png",
      descriptionUrl: "https://iiwiki.com/wiki/File:Eurth_political_map_2024.png",
      thumbUrl: withBasePath(
        "/api/mediawiki/iiwiki/images/thumb/3/3a/Eurth_political_map_2024.png/320px-Eurth_political_map_2024.png"
      ),
      width: 8192,
      height: 4096,
      size: 9876543,
      mime: "image/png",
      sha1: "4f1c6a0e2b6d5c3a9e8f7d6c5b4a39281706f5e4",
      licence: "CC BY-SA 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      artist: "Cartographer Eurth",
      credit: "Own work",
      attribution: "Eurth political map 2024.png by Cartographer Eurth, CC BY-SA 4.0, via IIWiki",
    });
  });

  it("prefers the file's own Attribution field and falls back to UsageTerms for the licence", () => {
    expect(files.get("File:Eurth world map.svg")).toMatchObject({
      licence: "Creative Commons Attribution 3.0",
      attribution: "Eurth community map team",
    });
  });

  it("says plainly when a file states no licence or author", () => {
    expect(files.get("File:Eurth physical.jpg")).toMatchObject({
      licence: null,
      artist: null,
      attribution: "Eurth physical.jpg, via IIWiki",
    });
  });

  it("leaves out missing files", () => {
    expect(files.has("File:Rostervania locator.png")).toBe(false);
  });

  it("drops a file whose URL is not on the wiki or its CDN, or is not https", () => {
    const foreign = parseImageInfo("iiwiki", {
      query: {
        pages: [
          { title: "File:A.png", imageinfo: [{ url: "https://evil.example/A.png", width: 1, height: 1, size: 1 }] },
          { title: "File:B.png", imageinfo: [{ url: "http://iiwiki.com/images/B.png", width: 1, height: 1, size: 1 }] },
          { title: "File:C.png", imageinfo: [{ url: "https://iiwiki.com.evil.example/C.png", width: 1, height: 1, size: 1 }] },
        ],
      },
    });
    expect(foreign.size).toBe(0);
    // AltHistory's files live on its CDN, which is allowed for it (and only for it).
    const cdn = { query: { pages: [{ title: "File:D.png", imageinfo: [{ url: "https://static.wikia.nocookie.net/althistory/images/D.png", width: 1, height: 1, size: 1 }] }] } };
    expect(parseImageInfo("althistory", cdn).size).toBe(1);
    expect(parseImageInfo("iiwiki", cdn).size).toBe(0);
  });
});

describe("helpers", () => {
  it("strips HTML and entities from extmetadata values", () => {
    expect(metadataText('<a href="/wiki/User:X">X&nbsp;&amp;&nbsp;Y</a>')).toBe("X & Y");
    expect(metadataText("")).toBeNull();
    expect(metadataText(42)).toBeNull();
  });

  it("proxies the wiki's own /images/ paths and falls back to Special:FilePath", () => {
    expect(proxiedFileUrl("iiwiki", "https://iiwiki.com/images/a/ab/X.png", "File:X.png")).toBe(
      withBasePath("/api/mediawiki/iiwiki/images/a/ab/X.png")
    );
    expect(proxiedFileUrl("althistory", "https://static.wikia.nocookie.net/x/X.png", "File:X y.png")).toBe(
      withBasePath("/api/mediawiki/althistory/wiki/Special:FilePath/X_y.png")
    );
  });

  it("spells file titles the way MediaWiki does", () => {
    expect(asFileTitle("eurth_map.png")).toBe("File:Eurth map.png");
    expect(asFileTitle("Image:Eurth map.png")).toBe("File:Eurth map.png");
    expect(asFileTitle("File:Eurth map.png")).toBe("File:Eurth map.png");
    expect(attributionLine("iiwiki", "File:M.png", { attribution: null, artist: "A", licence: null })).toBe(
      "M.png by A, via IIWiki"
    );
  });
});
