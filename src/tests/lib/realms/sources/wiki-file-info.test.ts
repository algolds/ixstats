/** @jest-environment node */
import { withBasePath } from "~/lib/base-path";
import {
  asFileTitle,
  attributionLine,
  ImageInfoResponseSchema,
  metadataText,
  parseImageInfo,
  proxiedFileUrl,
  type ImageInfoResponse,
} from "~/lib/realms/sources/wiki-file-info";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
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
          {
            title: "File:A.png",
            imageinfo: [{ url: "https://evil.example/A.png", width: 1, height: 1, size: 1 }],
          },
          {
            title: "File:B.png",
            imageinfo: [{ url: "http://iiwiki.com/images/B.png", width: 1, height: 1, size: 1 }],
          },
          {
            title: "File:C.png",
            imageinfo: [
              { url: "https://iiwiki.com.evil.example/C.png", width: 1, height: 1, size: 1 },
            ],
          },
        ],
      },
    });
    expect(foreign.size).toBe(0);
    // AltHistory's files live on its CDN, which is allowed for it (and only for it).
    const cdn = {
      query: {
        pages: [
          {
            title: "File:D.png",
            imageinfo: [
              {
                url: "https://static.wikia.nocookie.net/althistory/images/D.png",
                width: 1,
                height: 1,
                size: 1,
              },
            ],
          },
        ],
      },
    };
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
    expect(
      proxiedFileUrl("althistory", "https://static.wikia.nocookie.net/x/X.png", "File:X y.png")
    ).toBe(withBasePath("/api/mediawiki/althistory/wiki/Special:FilePath/X_y.png"));
  });

  it("spells file titles the way MediaWiki does", () => {
    expect(asFileTitle("eurth_map.png")).toBe("File:Eurth map.png");
    expect(asFileTitle("Image:Eurth map.png")).toBe("File:Eurth map.png");
    expect(asFileTitle("File:Eurth map.png")).toBe("File:Eurth map.png");
    expect(
      attributionLine("iiwiki", "File:M.png", { attribution: null, artist: "A", licence: null })
    ).toBe("M.png by A, via IIWiki");
  });
});

describe("card source wikis", () => {
  const file = (url: string, extmetadata: object | []) => ({
    query: {
      pages: [
        { title: "File:X.png", imageinfo: [{ url, width: 1, height: 1, size: 1, extmetadata }] },
      ],
    },
  });

  it("reads `extmetadata: []` (IxWiki, Fandom) as a file with no licence", () => {
    const data = ImageInfoResponseSchema.parse(
      file("https://static.wikia.nocookie.net/althistory/images/a/ab/X.png/revision/latest", [])
    );
    expect(parseImageInfo("althistory", data).get("File:X.png")?.licence).toBeNull();
  });

  it("reads a local file's DateTime and ObjectName alone as no licence", () => {
    const data = ImageInfoResponseSchema.parse(
      file(`${mediaWikiOrigin()}/images/1/16/X.png`, {
        DateTime: { value: "2016-06-24T13:38:33Z", source: "mediawiki-metadata", hidden: "" },
        ObjectName: { value: "X", source: "mediawiki-metadata" },
      })
    );
    expect(parseImageInfo("ixwiki", data).get("File:X.png")).toMatchObject({
      licence: null,
      artist: null,
    });
  });

  it("reads IxWiki files from IxWiki's own host and Commons files from its upload CDN only", () => {
    const ixwiki = ImageInfoResponseSchema.parse(
      file(`${mediaWikiOrigin()}/images/1/16/X.png`, [])
    );
    expect(parseImageInfo("ixwiki", ixwiki).get("File:X.png")?.attribution).toContain("IxWiki");
    const elsewhere = ImageInfoResponseSchema.parse(file("https://example.com/X.png", {}));
    expect(parseImageInfo("commons", elsewhere).size).toBe(0);
    expect(parseImageInfo("ixwiki", elsewhere).size).toBe(0);
  });

  it("gives an IxWiki file no thumbnail (the media proxy path is the sister wikis')", () => {
    const ixwiki = ImageInfoResponseSchema.parse({
      query: {
        pages: [
          {
            title: "File:X.png",
            imageinfo: [
              {
                url: `${mediaWikiOrigin()}/images/1/16/X.png`,
                thumburl: `${mediaWikiOrigin()}/images/thumb/1/16/X.png/320px-X.png`,
                width: 1,
                height: 1,
                size: 1,
              },
            ],
          },
        ],
      },
    });
    expect(parseImageInfo("ixwiki", ixwiki).get("File:X.png")?.thumbUrl).toBeNull();
  });

  it("reads IxWiki's Commons files (InstantCommons: missing but known), credited to Commons, without the tracking query", () => {
    const data = ImageInfoResponseSchema.parse({
      query: {
        pages: [
          {
            title: "File:Ban Huahat07.jpg",
            missing: true,
            known: true,
            imagerepository: "wikimediacommons",
            imageinfo: [
              {
                url: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Ban_Huahat07.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
                thumburl:
                  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Ban_Huahat07.jpg/320px-Ban_Huahat07.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Ban_Huahat07.jpg",
                width: 1,
                height: 1,
                size: 1,
                extmetadata: {
                  LicenseShortName: { value: "CC BY-SA 3.0", source: "commons-desc-page" },
                },
              },
            ],
          },
          {
            title: "File:Gone.png",
            missing: true,
            imageinfo: [
              { url: "https://upload.wikimedia.org/x/Gone.png", width: 1, height: 1, size: 1 },
            ],
          },
        ],
      },
    });
    const files = parseImageInfo("ixwiki", data);
    expect(files.get("File:Ban Huahat07.jpg")).toMatchObject({
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Ban_Huahat07.jpg",
      licence: "CC BY-SA 3.0",
      thumbUrl: withBasePath("/api/mediawiki/commons/wiki/Special:FilePath/Ban_Huahat07.jpg"),
      attribution: "Ban Huahat07.jpg, CC BY-SA 3.0, via Commons",
    });
    // A file with no page that no repository knows is still left out.
    expect(files.has("File:Gone.png")).toBe(false);
  });

  it("keeps a query that is not tracking (Fandom's cache buster)", () => {
    const data = ImageInfoResponseSchema.parse(
      file(
        "https://static.wikia.nocookie.net/althistory/images/a/ab/X.png/revision/latest?cb=20200405180536&utm_medium=x",
        []
      )
    );
    expect(parseImageInfo("althistory", data).get("File:X.png")?.url).toBe(
      "https://static.wikia.nocookie.net/althistory/images/a/ab/X.png/revision/latest?cb=20200405180536"
    );
  });
});
