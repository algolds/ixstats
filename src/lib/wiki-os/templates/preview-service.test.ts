import { renderTemplateCached, cacheKey, isKnownInfoboxFamily } from "./preview-service";

jest.mock("./template-registry", () => ({
  getTemplatePreview: jest.fn(),
}));

jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    on: jest.fn(),
  })),
}));

import { getTemplatePreview } from "./template-registry";

const mockRender = getTemplatePreview as jest.MockedFunction<typeof getTemplatePreview>;

beforeEach(() => {
  mockRender.mockReset();
  // REDIS_URL unset in test env → memory-only path
  delete process.env.REDIS_URL;
  delete process.env.REDIS_ENABLED;
});

describe("preview-service", () => {
  it("cache miss renders via network and reports cached:false", async () => {
    mockRender.mockResolvedValue("<p>render</p>");
    const result = await renderTemplateCached("Quote box", { text: "hi" });
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(result.html).toBe("<p>render</p>");
    expect(result.cached).toBe(false);
  });

  it("second identical call is served from cache", async () => {
    mockRender.mockResolvedValue("<p>render2</p>");
    await renderTemplateCached("Navbox", { group: "a" });
    const second = await renderTemplateCached("Navbox", { group: "a" });
    expect(second.cached).toBe(true);
    expect(second.html).toBe("<p>render2</p>");
    expect(mockRender).toHaveBeenCalledTimes(1);
  });

  it("param order does not change the cache key", () => {
    expect(cacheKey("T", { a: "1", b: "2" })).toBe(cacheKey("T", { b: "2", a: "1" }));
    expect(cacheKey("T", { a: "1" })).not.toBe(cacheKey("T", { a: "2" }));
  });

  it("network failure degrades to empty html without throwing", async () => {
    mockRender.mockRejectedValue(new Error("down"));
    const result = await renderTemplateCached("Whatever", {});
    expect(result.html).toBe("");
    expect(result.cached).toBe(false);
  });

  it("classifies infobox families for the component tier", () => {
    expect(isKnownInfoboxFamily("Infobox country")).toBe(true);
    expect(isKnownInfoboxFamily("infobox-settlement")).toBe(true);
    expect(isKnownInfoboxFamily("Quote box")).toBe(false);
  });
});
