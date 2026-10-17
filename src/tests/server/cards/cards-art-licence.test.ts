/** @jest-environment node */
/** Licence capture from real response shapes (Phase 2 spike, 2026-10-15). */
import { z } from "zod";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { captureArtLicence, wikiQueryFor } from "~/server/modules/cards/cards.art-licence";
import { json } from "~/tests/helpers/iiwiki-fixtures";

type Fixture = Record<string, object>;

/** A WikiQuery answering from fixtures by `prop`, recording every call. */
function fakeQuery(byProp: Fixture): { query: WikiQuery; calls: string[] } {
  const calls: string[] = [];
  const query: WikiQuery = async (params, schema) => {
    calls.push(params.prop ?? "");
    return schema.parse(byProp[params.prop ?? ""] ?? { query: { pages: [] } });
  };
  return { query, calls };
}

const imageinfo = (title: string, url: string, extmetadata: object | []) => ({
  query: {
    pages: [
      {
        title,
        imageinfo: [
          {
            url,
            descriptionurl: `https://example.org/wiki/${title}`,
            width: 10,
            height: 10,
            size: 100,
            mime: "image/png",
            sha1: "ab",
            extmetadata,
          },
        ],
      },
    ],
  },
});

const filePage = (title: string, content: string, categories: string[] = []) => ({
  query: {
    pages: [
      {
        title,
        categories: categories.map((name) => ({ title: name })),
        revisions: [{ slots: { main: { content } } }],
      },
    ],
  },
});

/** A local file's extmetadata on IxWiki and AltHistory: no licence keys, only what MediaWiki itself knows. */
const LOCAL_ONLY = {
  DateTime: { value: "2016-06-24T13:38:33Z", source: "mediawiki-metadata", hidden: "" },
  ObjectName: { value: "Theodora-CYG-GoN", source: "mediawiki-metadata" },
};

describe("captureArtLicence", () => {
  it("reads a Commons file's licence and author from extmetadata", async () => {
    const { query, calls } = fakeQuery({
      imageinfo: imageinfo(
        "File:Flag of Ireland.svg",
        "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg",
        {
          LicenseShortName: { value: "Public domain" },
          Artist: { value: "Éire" },
        }
      ),
    });
    const licence = await captureArtLicence(query, "commons", "Flag_of_Ireland.svg");
    expect(licence).toMatchObject({ status: "OPEN", licence: "Public domain", artist: "Éire" });
    expect(licence?.attribution).toContain("Éire");
    expect(calls).toEqual(["imageinfo"]);
  });

  it("stores a Commons file's URL without the tracking query", async () => {
    const { query } = fakeQuery({
      imageinfo: imageinfo(
        "File:Flag of Ireland.svg",
        "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original",
        { LicenseShortName: { value: "Public domain" } }
      ),
    });
    expect(await captureArtLicence(query, "commons", "Flag_of_Ireland.svg")).toEqual({
      fileTitle: "File:Flag of Ireland.svg",
      fileUrl: "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg",
      descriptionUrl: "https://example.org/wiki/File:Flag%20of%20Ireland.svg",
      licence: "Public domain",
      licenceUrl: null,
      artist: null,
      attribution: "Flag of Ireland.svg, Public domain, via Commons",
      status: "OPEN",
    });
  });

  it("reads an IxWiki page's Commons image (InstantCommons) with its Commons licence, in one request", async () => {
    const { query, calls } = fakeQuery({
      imageinfo: {
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
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:Ban_Huahat07.jpg",
                  width: 800,
                  height: 600,
                  size: 1234,
                  extmetadata: {
                    LicenseShortName: { value: "CC BY-SA 3.0", source: "commons-desc-page" },
                    UsageTerms: {
                      value: "Creative Commons Attribution-Share Alike 3.0",
                      source: "commons-desc-page",
                    },
                    Artist: {
                      value: '<a href="//commons.wikimedia.org/wiki/User:Ban">Ban</a>',
                      source: "commons-desc-page",
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    });
    expect(await captureArtLicence(query, "ixwiki", "Ban_Huahat07.jpg")).toMatchObject({
      fileUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Ban_Huahat07.jpg",
      descriptionUrl: "https://commons.wikimedia.org/wiki/File:Ban_Huahat07.jpg",
      licence: "CC BY-SA 3.0",
      artist: "Ban",
      attribution: "Ban Huahat07.jpg by Ban, CC BY-SA 3.0, via Commons",
      status: "OPEN",
    });
    expect(calls).toEqual(["imageinfo"]);
  });

  it("falls back to the File page when extmetadata is an empty array, and a fair-use file is unknown", async () => {
    const title = "File:Theodora-CYG-GoN.jpg";
    const { query, calls } = fakeQuery({
      imageinfo: imageinfo(
        title,
        "https://static.wikia.nocookie.net/althistory/images/8/8c/Theodora-CYG-GoN.jpg/revision/latest?cb=1",
        []
      ),
      "categories|revisions": filePage(title, "== Licensing ==\n{{Fairuse}}\n[[Category:People]]", [
        "Category:Fair use files",
        "Category:People",
      ]),
    });
    const licence = await captureArtLicence(query, "althistory", "Theodora-CYG-GoN.jpg");
    expect(licence).toMatchObject({ status: "UNKNOWN", licence: null });
    expect(calls).toEqual(["imageinfo", "categories|revisions"]);
  });

  it("finds a restricted licence template on the File page", async () => {
    const title = "File:Elm.png";
    const { query } = fakeQuery({
      imageinfo: imageinfo(
        title,
        "https://static.wikia.nocookie.net/althistory/images/a/ab/Elm.png/revision/latest",
        []
      ),
      "categories|revisions": filePage(title, "{{cc-by-nc-sa-3.0}}"),
    });
    expect(await captureArtLicence(query, "althistory", "Elm.png")).toMatchObject({
      status: "RESTRICTED",
      licence: "cc-by-nc-sa-3.0",
    });
  });

  it("reads a local file with only DateTime and ObjectName as unlicensed, and takes a licence category", async () => {
    const title = "File:Theodora-CYG-GoN.jpg";
    const { query, calls } = fakeQuery({
      imageinfo: imageinfo(
        title,
        `${mediaWikiOrigin()}/images/8/8c/Theodora-CYG-GoN.jpg`,
        LOCAL_ONLY
      ),
      "categories|revisions": filePage(title, "A portrait.", [
        "Category:People",
        "Category:CC-BY-SA-4.0",
      ]),
    });
    expect(await captureArtLicence(query, "ixwiki", "Theodora-CYG-GoN.jpg")).toMatchObject({
      status: "OPEN",
      licence: "CC-BY-SA-4.0",
      attribution: "Theodora-CYG-GoN.jpg, CC-BY-SA-4.0, via IxWiki",
    });
    expect(calls).toEqual(["imageinfo", "categories|revisions"]);
  });

  it("keeps an unreadable extmetadata licence when the File page says nothing either", async () => {
    const title = "File:Seal.png";
    const { query } = fakeQuery({
      imageinfo: imageinfo(title, "https://iiwiki.com/images/a/ab/Seal.png", {
        LicenseShortName: { value: "Copyrighted, used with permission" },
      }),
    });
    expect(await captureArtLicence(query, "iiwiki", "Seal.png")).toMatchObject({
      status: "UNKNOWN",
      licence: "Copyrighted, used with permission",
    });
  });

  it("is null when the wiki has no such file", async () => {
    const { query } = fakeQuery({});
    expect(await captureArtLicence(query, "althistory", "Missing.png")).toBeNull();
  });
});

describe("wikiQueryFor", () => {
  const Pages = z.object({
    query: z.object({ pages: z.array(z.object({ title: z.string() })) }).optional(),
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("reads the source wiki's own api.php as IxStats-Builder, up to its request cap", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => json({ query: { pages: [] } }));
    const query = wikiQueryFor("commons", 1);

    await query({ prop: "imageinfo", titles: "File:X.png" }, Pages);
    await expect(query({ prop: "imageinfo", titles: "File:Y.png" }, Pages)).rejects.toThrow(
      "discovery cap"
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/);
    expect(init?.headers).toMatchObject({ "User-Agent": "IxStats-Builder" });
  });

  it("allows twenty requests by default", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    jest.spyOn(globalThis, "fetch").mockImplementation(async () => json({ query: { pages: [] } }));
    const query = wikiQueryFor("althistory");

    const settled = Promise.allSettled(
      Array.from({ length: 21 }, () => query({ prop: "info" }, Pages))
    );
    await jest.advanceTimersByTimeAsync(60_000);
    const results = await settled;

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(20);
    expect(results[20]).toMatchObject({ status: "rejected" });
  });
});
