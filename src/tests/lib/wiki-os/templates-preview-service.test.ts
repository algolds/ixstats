/** @jest-environment node */
/**
 * The server's template preview: `canonicalPreviewInput` is order-insensitive, and `renderTemplateWithRedisCache`
 * renders through MediaWiki's engine call and never throws. (The browser keeps no render tier of its own: the
 * editor asks `wikios.getTemplatePreview`, see src/tests/architecture/browser-mediawiki.test.ts.)
 */
jest.mock("~/lib/wiki-os/templates/template-engine.server", () => ({
  getTemplatePreview: jest.fn(),
}));

import { getTemplatePreview } from "~/lib/wiki-os/templates/template-engine.server";
import {
  canonicalPreviewInput,
  renderTemplateWithRedisCache,
} from "~/lib/wiki-os/templates/preview-service.server";

const mockRender = getTemplatePreview as jest.MockedFunction<typeof getTemplatePreview>;

beforeEach(() => {
  mockRender.mockReset();
  // REDIS_URL unset in test env → no Redis tier
  delete process.env.REDIS_URL;
  delete process.env.REDIS_ENABLED;
});

describe("preview-service.server", () => {
  it("a render goes through the engine and reports cached:false", async () => {
    mockRender.mockResolvedValue("<p>render</p>");

    const result = await renderTemplateWithRedisCache("Quote box", { text: "hi" });

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockRender).toHaveBeenCalledWith("Quote box", { text: "hi" });
    expect(result).toEqual({ html: "<p>render</p>", source: "network", cached: false });
  });

  it("param order does not change the cache input", () => {
    expect(canonicalPreviewInput("T", { a: "1", b: "2" })).toBe(
      canonicalPreviewInput("T", { b: "2", a: "1" })
    );
    expect(canonicalPreviewInput("T", { a: "1" })).not.toBe(canonicalPreviewInput("T", { a: "2" }));
    expect(canonicalPreviewInput("Template:Quote box", {})).toBe(canonicalPreviewInput("quote box", {}));
  });

  it("an engine failure degrades to empty html without throwing", async () => {
    mockRender.mockRejectedValue(new Error("down"));

    expect(await renderTemplateWithRedisCache("Whatever", {})).toEqual({
      html: "",
      source: "network",
      cached: false,
    });
  });
});
