/** @jest-environment node */
/**
 * The template preview's Redis key (preview-service.server.ts) names the template as MediaWiki does: the first
 * letter upper-cased and underscores read as spaces, every other letter's case kept ("Infobox Country" and
 * "Infobox country" are two templates, so two previews), and the template's latest revision in WikiOS, so an edit
 * to the template is a new key and the 24-hour preview of the old text is never served after it. A template whose
 * revision cannot be read is rendered and not cached.
 */
const store = new Map<string, string>();
jest.mock("ioredis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => void store.set(key, value)),
  })),
}));
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({ getHeadRevisionRefs: jest.fn() }));
jest.mock("~/lib/wiki-os/templates/template-engine.server", () => ({
  getTemplatePreview: jest.fn(),
}));

import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { getTemplatePreview } from "~/lib/wiki-os/templates/template-engine.server";
import {
  previewCacheKey,
  renderTemplateWithRedisCache,
  templatePageTitle,
} from "~/lib/wiki-os/templates/preview-service.server";

const head = jest.mocked(getHeadRevisionRefs);
const render = jest.mocked(getTemplatePreview);
let revision = "rev-1";

beforeAll(() => {
  process.env.REDIS_URL = "redis://cache.invalid:6379";
  process.env.REDIS_ENABLED = "true";
});

beforeEach(() => {
  store.clear();
  revision = "rev-1";
  head.mockReset().mockImplementation(async () => ({ revisionRef: revision, revisionRefs: [] }));
  let renders = 0;
  render.mockReset().mockImplementation(async () => `<p>render ${++renders}</p>`);
});

describe("the template preview key", () => {
  it("is the template's MediaWiki title: first letter up, underscores as spaces, the rest as written", () => {
    expect(templatePageTitle("infobox_country")).toBe("Template:Infobox country");
    expect(templatePageTitle("Template:Infobox country ")).toBe("Template:Infobox country");
    expect(templatePageTitle("Infobox Country")).toBe("Template:Infobox Country");

    const params = { name: "Aurelia" };
    expect(previewCacheKey("infobox_country", params, "r")).toBe(
      previewCacheKey("Template:Infobox country", params, "r")
    );
    expect(previewCacheKey("Infobox Country", params, "r")).not.toBe(
      previewCacheKey("Infobox country", params, "r")
    );
    expect(previewCacheKey("Infobox country", params, "r1")).not.toBe(
      previewCacheKey("Infobox country", params, "r2")
    );
  });
});

describe("renderTemplateWithRedisCache", () => {
  it("serves the cached preview until the template is edited, then renders the new text", async () => {
    const params = { name: "Aurelia" };
    expect(await renderTemplateWithRedisCache("Infobox country", params)).toMatchObject({
      html: "<p>render 1</p>",
      cached: false,
    });
    expect(await renderTemplateWithRedisCache("infobox_country", params)).toMatchObject({
      html: "<p>render 1</p>",
      cached: true,
    });
    expect(head).toHaveBeenLastCalledWith("Template:Infobox country");

    revision = "rev-2";
    expect(await renderTemplateWithRedisCache("Infobox country", params)).toMatchObject({
      html: "<p>render 2</p>",
      cached: false,
    });
  });

  it("keeps two templates whose names differ only in case apart", async () => {
    await renderTemplateWithRedisCache("Infobox country", {});
    expect(await renderTemplateWithRedisCache("Infobox Country", {})).toMatchObject({
      html: "<p>render 2</p>",
      cached: false,
    });
  });

  it("does not cache a preview whose template revision cannot be read", async () => {
    head.mockRejectedValue(new Error("database down"));
    await renderTemplateWithRedisCache("Infobox country", {});
    expect(await renderTemplateWithRedisCache("Infobox country", {})).toMatchObject({
      html: "<p>render 2</p>",
      cached: false,
    });
    expect(store.size).toBe(0);
  });
});
