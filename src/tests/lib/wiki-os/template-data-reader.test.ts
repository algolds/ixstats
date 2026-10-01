/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (B4/B6): a template's TemplateData is read from the `<templatedata>` block of its stored wikitext (or of
// its /doc subpage) in Postgres. MediaWiki's `action=templatedata` is only the admin sync's refresh.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { wikiArticle: { findMany: jest.fn() } },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import {
  extractTemplateDataJson,
  parseTemplateData,
  readTemplateData,
} from "~/lib/wiki-os/templates/template-data-reader";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

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
  it("takes the first block, whatever the case of its tags", () => {
    expect(extractTemplateDataJson("a<TemplateData>{ \"a\": 1 }</TEMPLATEDATA>b<templatedata>2</templatedata>")).toBe(
      '{ "a": 1 }'
    );
  });

  it("is null without a block, or with one that never closes", () => {
    expect(extractTemplateDataJson("{{Quote|x}} no data")).toBeNull();
    expect(extractTemplateDataJson("<templatedata>{}")).toBeNull();
  });

  it("reads 2 MB of hostile openers in linear time", () => {
    const hostile = "<templatedata>".repeat(140_000);
    const started = performance.now();
    expect(extractTemplateDataJson(hostile)).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("parseTemplateData", () => {
  it("reads TemplateData as the admin sync stores it: languages flattened, order and sets kept", () => {
    expect(parseTemplateData("Quote box", JSON.stringify(DATA))).toEqual({
      title: "Quote box",
      description: "A quote box.",
      params: {
        text: {
          label: "Text",
          description: "The quote.",
          type: "string",
          default: undefined,
          required: true,
          suggested: undefined,
          example: undefined,
          autovalue: undefined,
          aliases: undefined,
        },
        author: {
          label: "Author",
          description: undefined,
          type: undefined,
          default: "Anonymous",
          required: undefined,
          suggested: true,
          example: undefined,
          autovalue: undefined,
          aliases: ["by"],
        },
      },
      paramOrder: ["text", "author"],
      format: "block",
      sets: [{ label: "Attribution", params: ["author"] }],
    });
  });

  it("reads a field of the wrong shape as absent instead of refusing the template", () => {
    const info = parseTemplateData("T", JSON.stringify({ params: { a: { required: "yes", aliases: 3 } }, format: 7 }));

    expect(info?.params.a).toMatchObject({ required: undefined, aliases: undefined });
    expect(info?.format).toBeUndefined();
  });

  it("is null for text that is not JSON, or not an object", () => {
    expect(parseTemplateData("T", "{ nope")).toBeNull();
    expect(parseTemplateData("T", "[1, 2]")).toBeNull();
    expect(parseTemplateData("T", "null")).toBeNull();
  });
});

describe("readTemplateData", () => {
  it("reads the template's own page, never asking MediaWiki", async () => {
    findMany.mockResolvedValue([
      { title: "Template:Quote box", wikitext: `{{#if:x|y}}<noinclude>${block(DATA)}</noinclude>` },
    ]);

    const result = await readTemplateData(["Quote box"]);

    expect([...result.keys()]).toEqual(["Quote box"]);
    expect(result.get("Quote box")?.paramOrder).toEqual(["text", "author"]);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      source: "ixwiki",
      status: "PUBLISHED",
      title: { in: ["Template:Quote box", "Template:Quote box/doc"] },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("falls back to the /doc subpage, where the convention keeps it", async () => {
    findMany.mockResolvedValue([
      { title: "Template:Navbox", wikitext: "{{{1}}}<noinclude>{{documentation}}</noinclude>" },
      { title: "Template:Navbox/doc", wikitext: block(DATA) },
    ]);

    const result = await readTemplateData(["Template:Navbox"]);

    expect(result.get("Navbox")?.description).toBe("A quote box.");
    expect(guard.calls()).toEqual([]);
  });

  it("prefers the template's own block over its documentation's", async () => {
    findMany.mockResolvedValue([
      { title: "Template:Navbox", wikitext: block({ description: "own" }) },
      { title: "Template:Navbox/doc", wikitext: block({ description: "doc" }) },
    ]);

    expect((await readTemplateData(["Navbox"])).get("Navbox")?.description).toBe("own");
  });

  it("skips a template whose block is not valid and tries its documentation", async () => {
    findMany.mockResolvedValue([
      { title: "Template:Navbox", wikitext: "<templatedata>{ broken</templatedata>" },
      { title: "Template:Navbox/doc", wikitext: block({ description: "doc" }) },
    ]);

    expect((await readTemplateData(["Navbox"])).get("Navbox")?.description).toBe("doc");
  });

  it("leaves out a template with no TemplateData, a title that cannot be one, and a deleted page (the query names the published ones)", async () => {
    findMany.mockResolvedValue([{ title: "Template:Plain", wikitext: "just {{{1}}}" }]);

    const result = await readTemplateData(["Plain", "bad|title", "Missing"]);

    expect(result.size).toBe(0);
    expect(findMany.mock.calls[0]?.[0].where.status).toBe("PUBLISHED");
    expect(guard.calls()).toEqual([]);
  });

  it("asks nothing for no usable name", async () => {
    expect((await readTemplateData([])).size).toBe(0);
    expect((await readTemplateData(["a|b"])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
