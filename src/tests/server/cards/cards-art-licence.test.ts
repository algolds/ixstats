/** @jest-environment node */
/** Licence capture from real response shapes (Phase 2 spike, 2026-10-15). */
import { z } from "zod";
import type { WikiQuery } from "~/lib/realms/lore-import";
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
describe("captureArtLicence", () => {
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
  it("takes a restricted hint over an open one that comes first", async () => {
    const title = "File:Elm.png";
    const { query } = fakeQuery({
      imageinfo: imageinfo(title, "https://iiwiki.com/images/a/ab/Elm.png", []),
      "categories|revisions": filePage(title, "{{cc-by-nc-4.0}}", ["Category:CC-BY-SA-4.0"]),
    });
    expect(await captureArtLicence(query, "iiwiki", "Elm.png")).toMatchObject({
      status: "RESTRICTED",
      licence: "cc-by-nc-4.0",
    });
  });

  it("does not read a licence from a named parameter's free text", async () => {
    const title = "File:Map scan.png";
    const { query, calls } = fakeQuery({
      imageinfo: imageinfo(title, "https://iiwiki.com/images/a/ab/Map_scan.png", []),
      "categories|revisions": filePage(
        title,
        "{{Information|description=PD scan of a map|author=me}}"
      ),
    });
    expect(await captureArtLicence(query, "iiwiki", "Map_scan.png")).toMatchObject({
      status: "UNKNOWN",
      licence: null,
    });
    expect(calls).toEqual(["imageinfo", "categories|revisions"]);
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
});
