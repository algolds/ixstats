/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
//
// Plan 418 (B6): `wikios.getTemplateData` on a miss of the cached `wiki_templates` row reads the template's
// TemplateData block from its stored wikitext in Postgres. MediaWiki's `action=templatedata` is not asked.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiTemplate: { findUnique: jest.fn(), upsert: jest.fn() },
    wikiArticle: { findMany: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/templates/preview-service.server", () => ({
  __esModule: true,
  renderTemplateWithRedisCache: jest.fn(),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosTemplatesRouter } from "~/server/api/routers/wikios/templates";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiTemplate: { findUnique: jest.Mock; upsert: jest.Mock };
  wikiArticle: { findMany: jest.Mock };
};

const caller = () =>
  createCallerFactory(wikiosTemplatesRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );

const DATA = { description: "A quote box.", params: { text: { label: "Text", required: true } }, paramOrder: ["text"] };

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  mocked.wikiTemplate.findUnique.mockResolvedValue(null);
  mocked.wikiTemplate.upsert.mockResolvedValue({});
  mocked.wikiArticle.findMany.mockResolvedValue([]);
});
afterEach(() => guard.restore());

describe("wikios.getTemplateData", () => {
  it("on a cache miss reads the TemplateData block of the template's own wikitext, caches it and asks no wiki", async () => {
    mocked.wikiArticle.findMany.mockResolvedValue([
      {
        title: "Template:Zoning notice",
        wikitext: `{{{text}}}<noinclude><templatedata>${JSON.stringify(DATA)}</templatedata></noinclude>`,
      },
    ]);

    const result = await caller().getTemplateData({ title: "Template:Zoning notice" });

    expect(result).toMatchObject({
      name: "Zoning notice",
      description: "A quote box.",
      cached: false,
      templateData: { title: "Zoning notice", paramOrder: ["text"] },
    });
    expect(mocked.wikiTemplate.upsert).toHaveBeenCalledTimes(1);
    expect(guard.calls()).toEqual([]);
  });

  it("reads the /doc subpage when the template page holds none", async () => {
    mocked.wikiArticle.findMany.mockResolvedValue([
      { title: "Template:Zoning notice", wikitext: "{{{text}}}" },
      { title: "Template:Zoning notice/doc", wikitext: `<templatedata>${JSON.stringify(DATA)}</templatedata>` },
    ]);

    expect(await caller().getTemplateData({ title: "Zoning notice" })).toMatchObject({
      templateData: { description: "A quote box." },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("answers no TemplateData for a template that has none, caching nothing and asking no wiki", async () => {
    expect(await caller().getTemplateData({ title: "Plain template" })).toMatchObject({
      name: "Plain template",
      templateData: null,
      cached: false,
    });
    expect(mocked.wikiTemplate.upsert).not.toHaveBeenCalled();
    expect(guard.calls()).toEqual([]);
  });

  it("serves a cached row without reading anything else", async () => {
    mocked.wikiTemplate.findUnique.mockResolvedValue({
      name: "Zoning notice",
      description: "cached",
      category: "formatting",
      isCanonical: false,
      canonicalTarget: null,
      templateData: { params: {} },
    });

    expect(await caller().getTemplateData({ title: "Zoning notice" })).toMatchObject({
      description: "cached",
      cached: true,
    });
    expect(mocked.wikiArticle.findMany).not.toHaveBeenCalled();
    expect(guard.calls()).toEqual([]);
  });
});
