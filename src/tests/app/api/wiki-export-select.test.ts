/** @jest-environment node */
/**
 * Plan 404: the export reads an explicit column list, so the view bundle (`renderedView`) never
 * leaves the database and the raw HTML (`contentHtml`) is read only for the JSON export.
 */
import { NextRequest } from "next/server";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/cache/rate-limiter", () => ({ rateLimiter: { check: jest.fn() } }));
jest.mock("~/server/db", () => ({
  db: { wikiArticle: { findFirst: jest.fn() } },
}));

import { GET } from "~/app/api/wiki/export/route";
import { db } from "~/server/db";

const findFirst = db.wikiArticle.findFirst as jest.Mock;

const article = {
  title: "Aurelia",
  slug: "aurelia",
  source: "ixwiki",
  namespace: 0,
  status: "PUBLISHED",
  format: "WIKITEXT",
  summary: "A country.",
  wordCount: 120,
  readingTime: 1,
  wikitext: "'''Aurelia''' is a country.",
  contentHtml: "<p>Aurelia is a country.</p>",
};

const get = (query: string) =>
  GET(new NextRequest(`http://localhost:3000/api/wiki/export?slug=aurelia${query}`));

beforeEach(() => {
  jest.clearAllMocks();
  findFirst.mockResolvedValue(article);
});

describe("GET /api/wiki/export (markdown and JSON)", () => {
  it("reads an explicit column list, never the view bundle", async () => {
    await get("&format=markdown");
    await get("&format=json");

    for (const call of findFirst.mock.calls) {
      const { select } = call[0];
      expect(select).toBeDefined();
      expect(select).not.toHaveProperty("renderedView");
      expect(select).toMatchObject({ title: true, slug: true, wikitext: true });
    }
  });

  it("reads the raw HTML only for the JSON export", async () => {
    await get("&format=markdown");
    expect(findFirst.mock.calls[0]?.[0].select.contentHtml).toBe(false);

    await get("&format=json");
    expect(findFirst.mock.calls[1]?.[0].select.contentHtml).toBe(true);
  });

  it("still exports the wikitext as Markdown and the article as JSON", async () => {
    const markdown = await get("");
    expect(await markdown.text()).toContain("'''Aurelia''' is a country.");

    const json = await (await get("&format=json")).json();
    expect(json).toMatchObject({
      title: "Aurelia",
      wikitext: "'''Aurelia''' is a country.",
      contentHtml: "<p>Aurelia is a country.</p>",
    });
  });

  it("answers 404 for a missing article", async () => {
    findFirst.mockResolvedValue(null);

    expect((await get("")).status).toBe(404);
  });
});
