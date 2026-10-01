/** @jest-environment node */
// Plan 418 (B4): the template preview is rendered by MediaWiki as a private engine, through the render
// service's own non-persisting call (`action=parse&text=`): never `&page=`, never `templatedata`, never anything
// else. When the engine cannot answer, the in-process compiler does.
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { getTemplatePreview } from "~/lib/wiki-os/templates/template-engine.server";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { transformImages } from "~/lib/wiki-os/transformers/html-transformer";
import { transformWikiLinks } from "~/lib/wiki-os/transformers/url-compat";

/** What the in-process compiler makes of the invocation `{{Quote box|text=hi}}`. */
const compiled = () =>
  transformWikiLinks(transformImages(parseWikitextToHtml("{{Quote box|text=hi}}", "ixwiki"), "ixwiki"));

let fetchSpy: jest.SpiedFunction<typeof fetch>;
const sentBody = () => new URLSearchParams(String(fetchSpy.mock.calls[0]![1]!.body));

beforeEach(() => {
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(Response.json({ parse: { text: "<p class=\"rendered\">engine</p>" } }));
});
afterEach(() => fetchSpy.mockRestore());

describe("getTemplatePreview", () => {
  it("sends the invocation to the engine as text to parse, in one request", async () => {
    await expect(getTemplatePreview("Quote box", { text: "hi" })).resolves.toContain("engine");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![1]!.method).toBe("POST");
    const body = sentBody();
    expect(body.get("action")).toBe("parse");
    expect(body.get("text")).toBe("{{Quote box|text=hi}}");
    expect(body.get("title")).toBeTruthy();
    expect(body.has("page")).toBe(false);
    expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/\/api\.php$/);
  });

  it("uses the internal engine URL when one is configured (the configuration is read when it loads)", async () => {
    process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8080/api.php";
    try {
      await jest.isolateModulesAsync(async () => {
        const engine = await import("~/lib/wiki-os/templates/template-engine.server");
        await engine.getTemplatePreview("Quote box", { text: "hi" });
      });
      expect(String(fetchSpy.mock.calls[0]![0])).toBe("http://127.0.0.1:8080/api.php");
    } finally {
      delete process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
    }
  });

  it("falls back to the in-process compiler when the engine does not answer", async () => {
    fetchSpy.mockRejectedValue(new Error("engine down"));

    const html = await getTemplatePreview("Quote box", { text: "hi" });

    expect(html).not.toContain("engine");
    expect(html).toBe(compiled());
  });

  it("falls back to the in-process compiler when the engine answers with nothing", async () => {
    fetchSpy.mockResolvedValue(Response.json({ parse: {} }));

    expect(await getTemplatePreview("Quote box", { text: "hi" })).toBe(compiled());
  });

  it("never calls the engine for an invocation that could break out", async () => {
    await expect(getTemplatePreview("Quote box", { text: "a}}b" })).resolves.toBe("Invalid parameter");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
