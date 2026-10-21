/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario, on PostgreSQL: the edit-save-render flow against the real schema (SCENARIOS_DATABASE_URL, a `_scenarios`
 * scratch database; skipped without it). What only a database decides: the row lock (`FOR NO KEY UPDATE`) that makes
 * two saves of one page take turns, the advisory creation lock of a title nobody has created yet, the `lock_timeout`
 * that turns a long wait into a retryable PageBusyError, and the render's sets written under foreign keys. MediaWiki's
 * render is a stand-in; every row is written under this run's own prefix and deleted afterwards.
 */
jest.mock("~/server/db", () => {
  const scenario = jest.requireActual("~/tests/helpers/scenario-db");
  return {
    __esModule: true,
    db: process.env.SCENARIOS_DATABASE_URL ? scenario.scenarioDb() : {},
    isDatabaseReadOnly: false,
  };
});
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn(), createMany: jest.fn().mockResolvedValue([]) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  renderArticleViaMediaWiki: jest.fn(),
}));

import type { PrismaClient } from "@prisma/client";
import { db } from "~/server/db";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { NativeSearchService } from "~/lib/wiki-os/core/native-search-service";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { PageBusyError } from "~/lib/wiki-os/core/page-busy-error";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { describeWithDb, prefix, scenarioDb } from "~/tests/helpers/scenario-db";

const client = db as unknown as PrismaClient;
let p = "";
const title = (name: string) => `${p}${name}`.replace(/^./, (first) => first.toUpperCase());

const save = (name: string, wikitext: string, expectedHeadRef?: string | null) =>
  ArticleRepository.saveArticle({ slug: title(name), title: title(name), wikitext, expectedHeadRef });

const revisions = (name: string) =>
  client.wikiRevision.findMany({
    where: { article: { source: "ixwiki", title: title(name) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, parentRevisionId: true, wikitext: true },
  });

/** Waits until every render this test queued has stored its view. */
async function rendered(name: string): Promise<void> {
  for (let tries = 0; tries < 100; tries++) {
    const row = await client.wikiArticle.findFirst({ where: { title: title(name) }, select: { htmlSyncedAt: true } });
    if (row?.htmlSyncedAt) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`no render of ${title(name)}`);
}

const outcome = (results: PromiseSettledResult<unknown>[]) =>
  results
    .map((result) =>
      result.status === "fulfilled" ? "saved" : result.reason instanceof EditConflictError ? "conflict" : String(result.reason)
    )
    .sort();

describeWithDb("edit, save and render on PostgreSQL", () => {
  beforeEach(() => {
    p = prefix();
    jest.mocked(renderArticleViaMediaWiki).mockImplementation(async (wikitext: string) => ({
      html: `<div class="mw-parser-output"><p>${wikitext}</p></div>`,
      metadata: {
        links: [],
        templates: [{ ns: 10, title: "Template:Flag" }],
        images: [],
        categories: [{ name: `${p}Kingdoms`, sortKey: null, hidden: false }],
        displayTitle: null,
        properties: {},
      },
    }));
  });

  afterEach(async () => {
    // let the queued renders finish before their rows go
    await new Promise((resolve) => setTimeout(resolve, 100));
    await client.wikiMirrorJob.deleteMany({ where: { title: { startsWith: title("") } } });
    await client.wikiArticle.deleteMany({ where: { title: { startsWith: title("") } } });
    await client.wikiCategory.deleteMany({ where: { name: { startsWith: title("") } } });
  });

  afterAll(async () => {
    await client.$disconnect?.();
  });

  it("creates a page once when two editors create it at the same moment: the creation lock", async () => {
    const results = await Promise.allSettled([save("Caphiria", "first"), save("Caphiria", "second")]);
    // both believed the page new: the one that got the lock second finds the page the first made
    const [a, b] = await Promise.allSettled([save("Vesperia", "first", null), save("Vesperia", "second", null)]);

    expect(outcome(results)).toEqual(["saved", "saved"]); // no base: the last write wins, one after the other
    expect((await revisions("Caphiria")).map((r) => r.parentRevisionId === null)).toEqual([true, false]);
    expect(outcome([a, b])).toEqual(["conflict", "saved"]);
    expect(await revisions("Vesperia")).toHaveLength(1);
  });

  it("lets exactly one of two saves on the same base land; the other conflicts with the winner's text", async () => {
    const created = await save("Caphiria", "r1 text", null);
    const base = created.revisionId as string;

    const results = await Promise.allSettled([save("Caphiria", "edit A", base), save("Caphiria", "edit B", base)]);

    expect(outcome(results)).toEqual(["conflict", "saved"]);
    const winner = results.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<{ revisionId: string }>;
    const loser = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    const rows = await revisions("Caphiria");
    expect(rows.map((r) => r.parentRevisionId)).toEqual([null, base]);
    expect((loser.reason as EditConflictError).conflict).toEqual({
      currentWikitext: rows[1]!.wikitext,
      currentRevisionRef: winner.value.revisionId,
    });
  });

  it("chains saves that make no check one on top of the other, never two on one parent", async () => {
    await save("Caphiria", "r1", null);
    await Promise.all([save("Caphiria", "a"), save("Caphiria", "b"), save("Caphiria", "c")]);

    const rows = await revisions("Caphiria");
    expect(rows.map((r) => r.parentRevisionId)).toEqual([null, ...rows.slice(0, -1).map((r) => r.id)]);
  });

  it("gives up as busy, not broken, when another writer holds the page longer than lock_timeout", async () => {
    await save("Caphiria", "r1", null);
    const holder = scenarioDb();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    const holding = holder.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM wiki_articles WHERE "source" = 'ixwiki' AND "title" = ${title("Caphiria")} FOR NO KEY UPDATE`;
        locked();
        await held;
      },
      { timeout: 30_000 }
    );
    await isLocked;

    const started = Date.now();
    await expect(save("Caphiria", "waited too long")).rejects.toBeInstanceOf(PageBusyError);
    expect(Date.now() - started).toBeGreaterThanOrEqual(9_000);

    release();
    await holding;
    await holder.$disconnect();
    expect((await revisions("Caphiria")).map((r) => r.wikitext)).toEqual(["r1"]);
  }, 40_000);

  it("renders the saved text, stores the render's sets under their foreign keys, and finds the page by search", async () => {
    await save("Caphiria", `The empire of ${title("Caphiria")} rules.\n[[Category:Kingdoms]]`, null);
    await rendered("Caphiria");

    const view = await ArticleRepository.findArticleForView(title("Caphiria"));
    expect(view).toMatchObject({ title: title("Caphiria"), categories: [title("Kingdoms")] });
    const article = await client.wikiArticle.findFirstOrThrow({
      where: { title: title("Caphiria") },
      select: { id: true, templateLinks: { select: { templateTitle: true } } },
    });
    expect(article.templateLinks).toEqual([{ templateTitle: "Template:Flag" }]);
    expect(await client.wikiMirrorJob.count({ where: { title: title("Caphiria"), kind: "revision" } })).toBe(1);

    // the title typeahead (on this database without pg_trgm, through its title-only fallback query)
    const found = await NativeSearchService.spotlightSearch(title("Caph"));
    expect(found.map((result) => result.title)).toEqual([title("Caphiria")]);
  });
});
