/** @jest-environment node */
/**
 * Templates: a preview never reaches the engine with an invocation that could break out, falls back to the in-process
 * compiler when the engine is down and degrades to empty HTML, never an error; TemplateData is read from the template's
 * own page (or its /doc), case-folded tags and wrongly shaped fields included, never from a deleted page.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: jest.fn() } },
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { getTemplatePreview } from "~/lib/wiki-os/templates/template-engine.server";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { transformImages } from "~/lib/wiki-os/transformers/html-transformer";
import { transformWikiLinks } from "~/lib/wiki-os/transformers/url-compat";
import { db } from "~/server/db";
import { extractTemplateDataJson, parseTemplateData, readTemplateData } from "~/lib/wiki-os/templates/template-data-reader";
import { type FetchGuard, installFetchGuard } from "~/tests/helpers/fetch-guard";

/** What the in-process compiler makes of the invocation `{{Quote box|text=hi}}`. */
const compiled = () =>
  transformWikiLinks(transformImages(parseWikitextToHtml("{{Quote box|text=hi}}", "ixwiki"), "ixwiki"));

let fetchSpy: jest.SpiedFunction<typeof fetch>;
beforeEach(() => {
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(Response.json({ parse: { text: "<p class=\"rendered\">engine</p>" } }));
});
afterEach(() => fetchSpy.mockRestore());

describe("getTemplatePreview", () => {
  it("falls back to the in-process compiler when the engine does not answer", async () => {
    fetchSpy.mockRejectedValue(new Error("engine down"));

    const html = await getTemplatePreview("Quote box", { text: "hi" });

    expect(html).not.toContain("engine");
    expect(html).toBe(compiled());
  });
  it("never calls the engine for an invocation that could break out", async () => {
    await expect(getTemplatePreview("Quote box", { text: "a}}b" })).resolves.toBe("Invalid parameter");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("TemplateData", () => {
  const findMany = (db.wikiArticle as unknown as { findMany: jest.Mock }).findMany;

  const DATA = {
    description: { en: "A quote box." },
    params: {
      text: { label: { en: "Text" }, description: "The quote.", required: true, type: "string" },
      author: { label: "Author", aliases: ["by"], suggested: true, default: "Anonymous" },
    },
    paramOrder: ["text", "author"],
    format: "block",
    sets: [{ label: "Attribution", params: ["author"] }],
  };
  const block = (data: unknown) => `<templatedata>\n${JSON.stringify(data)}\n</templatedata>`;

  let guard: FetchGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    guard = installFetchGuard();
    findMany.mockResolvedValue([]);
  });
  afterEach(() => guard.restore());

  describe("extractTemplateDataJson", () => {
    it("finds the block after a character whose lower case is longer than itself (\"İ\")", () => {
      // "İ".toLowerCase() is two UTF-16 units: offsets taken in a lower-cased copy would cut the JSON short.
      const text = `İİİİ intro <TemplateData>{"description":"after dotted capitals"}</TemplateData> İ`;

      expect(extractTemplateDataJson(text)).toBe('{"description":"after dotted capitals"}');
      expect(parseTemplateData("T", extractTemplateDataJson(text)!)?.description).toBe(
        "after dotted capitals"
      );
    });

    it("closes the block at its own closing tag in any case, and reads a second block independently", () => {
      expect(extractTemplateDataJson('<templatedata>{"a":1}</TEMPLATEDATA>x<templatedata>{"b":2}')).toBe(
        '{"a":1}'
      );
      expect(extractTemplateDataJson("<templatedata>{}")).toBeNull();
    });
  });

  describe("parseTemplateData", () => {
    it("reads a field of the wrong shape as absent instead of refusing the template", () => {
      const info = parseTemplateData("T", JSON.stringify({ params: { a: { required: "yes", aliases: 3 } }, format: 7 }));

      expect(info?.params.a).toMatchObject({ required: undefined, aliases: undefined });
      expect(info?.format).toBeUndefined();
    });
  });

  describe("readTemplateData", () => {
    it("falls back to the /doc subpage, where the convention keeps it", async () => {
      findMany.mockResolvedValue([
        { title: "Template:Navbox", wikitext: "{{{1}}}<noinclude>{{documentation}}</noinclude>" },
        { title: "Template:Navbox/doc", wikitext: block(DATA) },
      ]);

      const result = await readTemplateData(["Template:Navbox"]);

      expect(result.get("Navbox")?.description).toBe("A quote box.");
      expect(guard.calls()).toEqual([]);
    });
    it("leaves out a template with no TemplateData, a title that cannot be one, and a deleted page (the query names the published ones)", async () => {
      findMany.mockResolvedValue([{ title: "Template:Plain", wikitext: "just {{{1}}}" }]);

      const result = await readTemplateData(["Plain", "bad|title", "Missing"]);

      expect(result.size).toBe(0);
      expect(findMany.mock.calls[0]?.[0].where.status).toBe("PUBLISHED");
      expect(guard.calls()).toEqual([]);
    });
  });
});
