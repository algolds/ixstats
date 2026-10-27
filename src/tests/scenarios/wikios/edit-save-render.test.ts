/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario: an autoconfirmed member opens Caphiria (head r1), edits it and saves on top of r1. The save stores a
 * revision, marks the view stale, writes one mirror job, tells the page's watchers and queues one render; the render
 * (MediaWiki's HTML is a stand-in) stores the view and the page's link, template and category sets; every reader then
 * gets the sanitized new body and the new categories, and the country and geo intro is the new text at once. The reader walks the history and opens each revision; a save on
 * the stale base is an edit conflict carrying the page as it is; a purge renders the page again without touching its
 * text. Real routers, ArticleRepository, render service, article view, link graph, categories, outbox and
 * notifications run over the in-memory WikiOS tables (Prisma mode).
 *
 * Folds:
 * - xml/save-article-sha1.test.ts: the stored revision's sha1 is mwSha1Base36 of what was stored; a lone surrogate is
 *   stored (article and revision) as U+FFFD and hashed as stored; the control characters XML cannot carry are
 *   stripped, while tab and CRLF survive.
 * - revision-ref-roundtrip.test.ts: every history `revid` (a row id and a stamped MediaWiki rev id alike) reads back
 *   that revision's own text and title; byte deltas are the history's; an unknown reference is null.
 * - purge-service.test.ts: purgeArticle nulls htmlSyncedAt without touching the text, evicts the title caches and
 *   queues exactly one render.
 * - revision-placeholder.test.ts, xml/deleted-revision-read.test.ts: a revision imported without its text (a synced one
 *   holding "", or "" with a size) and one whose text an administrator deleted read as unknown (null), never as an empty
 *   page; a native revision that really is empty reads as ""; a parked revision says so; a revision of another wiki is
 *   no IxWiki revision.
 * - wikios-edit-conflict.test.ts, wikios-get-wikitext.test.ts: a save under a lower-case spelling lands on the canonical
 *   title; the editor gets the head's every reference with the text, and the text alone when the head cannot be read.
 * - wikios-revert.test.ts (plan 402): a revert refuses a revision whose text was never imported, another page's, a parked
 *   one (an administrator too), and blanking (whitespace included) unless the caller is an administrator; a rollback
 *   restores the last other editor's text and is refused when every revision is the same editor's.
 * - title-cache-eviction.test.ts: the edit evicts the page from the bridge under every spelling a reader asked for, and
 *   nothing else; an eviction that cannot reach one cache still clears the others and never fails the save.
 */
jest.mock("~/server/db", () => {
  const fake = jest
    .requireActual("~/tests/helpers/fake-wiki-db")
    .createFakeWikiDb({ prisma: true });
  return { __esModule: true, fake, db: fake.db, isDatabaseReadOnly: true };
});
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  SYSTEM_OWNER_IDS: [],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
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
jest.mock("~/lib/wiki-os/services/title-cache-eviction", () => {
  const actual = jest.requireActual("~/lib/wiki-os/services/title-cache-eviction");
  return { __esModule: true, evictWikiTitleCaches: jest.fn(actual.evictWikiTitleCaches) };
});

import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { wikiosHistoryDiffRouter } from "~/server/api/routers/wikios/history-diff";
import {
  renderArticleViaMediaWiki,
  type RenderMetadata,
} from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { getArticleIntro, getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";
import { purgeArticle } from "~/lib/wiki-os/services/purge-service";
import { evictWikiTitleCaches } from "~/lib/wiki-os/services/title-cache-eviction";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { notificationAPI } from "~/lib/notifications/api";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { seedWikiosMode } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const member = () =>
  createMockRouterContext({
    auth: { userId: "clerk-member" },
    user: {
      id: "db-member",
      clerkUserId: "clerk-member",
      handle: "Member",
      role: { name: "user", level: 100 },
    },
  }) as never;
const signedOut = () => createMockRouterContext({ auth: null, user: null }) as never;
const editing = () => createCallerFactory(wikiosEditingRouter)(member());
const administrator = () =>
  createCallerFactory(wikiosEditingRouter)(
    createMockRouterContext({
      auth: { userId: "clerk-admin" },
      user: {
        id: "db-admin",
        clerkUserId: "clerk-admin",
        handle: "Admin",
        role: { name: "admin", level: 10 },
      },
    }) as never
  );
const reading = () => createCallerFactory(wikiosPageContentRouter)(signedOut());
const history = () => createCallerFactory(wikiosHistoryDiffRouter)(signedOut());

const V1 = "Caphiria is a kingdom.\n\n[[Category:Old]]";
const V2 = "'''Caphiria''' is an empire in [[Sarpedon]].\n{{Flag|CAP}}\n\n[[Category:Kingdoms]]";

/** MediaWiki's parse of `wikitext`: its HTML carries a script and a handler the sanitizer must take out. */
const parse = (wikitext: string): { html: string; metadata: RenderMetadata } => ({
  html: `<div class="mw-parser-output"><p onclick="steal()">${wikitext.split("\n")[0]}</p><script>steal()</script></div>`,
  metadata: {
    links: [{ ns: 0, title: "Sarpedon" }],
    templates: wikitext.includes("{{Flag") ? [{ ns: 10, title: "Template:Flag" }] : [],
    images: [],
    categories: [...wikitext.matchAll(/\[\[Category:([^\]]+)\]\]/g)].map((m) => ({
      name: m[1]!,
      sortKey: null,
      hidden: false,
    })),
    displayTitle: null,
    properties: {},
  },
});

const page = () => tables.wikiArticle.rows.find((row) => row.title === "Caphiria")!;
const revisionsOf = (id: string) => tables.wikiRevision.rows.filter((row) => row.articleId === id);
const categoriesOf = (id: string) =>
  tables.wikiCategoryMember.rows
    .filter((row) => row.articleId === id)
    .map(
      (row) => tables.wikiCategory.rows.find((category) => category.id === row.categoryId)?.name
    );
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const notices = () =>
  jest
    .mocked(notificationAPI.createMany)
    .mock.calls.flatMap(([inputs]) =>
      inputs.map((input) => `${input.userId} ${(input.metadata as { kind: string }).kind}`)
    );

const realFetch = global.fetch;
beforeAll(() => {
  // MediaWiki is never asked; the edge purge after a save is a request that fails quietly
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as never;
});
afterAll(() => {
  global.fetch = realFetch;
});

let r1: string;
let restoreMode: () => void = () => undefined;
afterEach(() => restoreMode());
beforeEach(async () => {
  fake.reset();
  // v1 with the protections marker the rights import writes (without it WikiOS takes no write)
  restoreMode = await seedWikiosMode(fake.db, "v1");
  wikiBridgeCache.clear();
  jest.clearAllMocks();
  jest
    .mocked(renderArticleViaMediaWiki)
    .mockImplementation(async (wikitext: string) => parse(wikitext));
  tables.user.seed(
    { id: "db-member", clerkUserId: "clerk-member" },
    { id: "db-watcher", clerkUserId: "clerk-watcher" }
  );
  const article = tables.wikiArticle.insert({
    title: "Caphiria",
    slug: "caphiria",
    wikitext: V1,
    htmlSyncedAt: new Date("2026-09-01T00:00:00Z"),
    renderedView: buildViewBundle("<p>Caphiria is a kingdom.</p>"),
  });
  r1 = tables.wikiRevision.insert({
    articleId: article.id,
    wikitext: V1,
    byteSize: V1.length,
    byteDelta: V1.length,
    mwRevId: 5001,
    author: "Founder",
  }).id;
  const old = tables.wikiCategory.insert({ name: "Old", slug: "old" });
  tables.wikiCategoryMember.seed({ articleId: article.id, categoryId: old.id });
  // the editor and another member watch the page: only the other one is told
  tables.wikiWatchlist.seed(
    { userId: "db-watcher", articleId: article.id },
    { userId: "db-member", articleId: article.id }
  );
});

describe("a member edits Caphiria and readers see the new page", () => {
  it("saves on top of r1, renders once, and serves the sanitized body with the render's categories", async () => {
    const loaded = await reading().getWikitext({ title: "Caphiria" });
    expect(loaded).toMatchObject({ wikitext: V1, revisionRef: "5001" });
    // the country and geo intros read the page through the bridge, which keeps what it read for 30 minutes
    await expect(getArticleIntro("Caphiria")).resolves.toMatchObject({
      text: "Caphiria is a kingdom.",
    });

    const saved = await editing().saveWikitext({
      title: "Caphiria",
      wikitext: V2,
      summary: "expand the lead",
      baseRevisionRef: loaded.revisionRef!,
    });
    expect(saved).toMatchObject({ success: true, title: "Caphiria" });

    // the revision is made on top of r1, keeps the summary, and the article's excerpt comes from the text
    const [, r2] = revisionsOf(page().id);
    expect(r2).toMatchObject({
      id: saved.success ? saved.revisionId : "",
      parentRevisionId: r1,
      summary: "expand the lead",
      author: "Member",
      sha1: mwSha1Base36(V2),
      byteDelta: Buffer.byteLength(V2) - V1.length,
    });
    expect(page().summary).toMatch(/^Caphiria is an empire in Sarpedon/);
    // one revision job, for the revision the save wrote
    expect(
      tables.wikiMirrorJob.rows.map((job) => `${job.kind} ${job.title} ${job.revisionId}`)
    ).toEqual([`revision Caphiria ${r2!.id}`]);

    await settle();
    // one render, of the new text; the watcher (not the editor) was told
    expect(jest.mocked(renderArticleViaMediaWiki).mock.calls).toEqual([[V2, "Caphiria"]]);
    expect(notices()).toEqual(["clerk-watcher edited"]);
    expect(page().htmlSyncedAt).toBeInstanceOf(Date);
    // the page's sets are the render's: the category the edit removed is gone
    expect(categoriesOf(page().id)).toEqual(["Kingdoms"]);
    expect(tables.wikiTemplateLink.rows.map((row) => row.templateTitle)).toEqual(["Template:Flag"]);
    expect(tables.wikiLink.rows.map((row) => [row.sourceArticleId, row.targetSlug])).toEqual([
      [page().id, "sarpedon"],
    ]);

    const view = await reading().getArticleHtml({ title: "Caphiria" });
    expect(view.contentHtml).toContain("Caphiria");
    expect(view.contentHtml).toContain("is an empire in");
    expect(view.contentHtml).not.toMatch(/<script|onclick/i);
    expect(view).toMatchObject({ title: "Caphiria", categories: ["Kingdoms"] });
    // and the intro is the new text at once, not the one the bridge held
    expect((await getArticleIntro("Caphiria"))?.text).toMatch(/^Caphiria is an empire in Sarpedon/);
  });

  it("answers a second save on the stale base with an edit conflict carrying the page as it is now", async () => {
    await editing().saveWikitext({ title: "Caphiria", wikitext: V2, baseRevisionRef: "5001" });
    const head = revisionsOf(page().id).at(-1)!;

    const second = await editing().saveWikitext({
      title: "Caphiria",
      wikitext: "My older idea",
      baseRevisionRef: "5001",
    });

    expect(second).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: V2,
      currentRevisionRef: head.id,
    });
    expect(revisionsOf(page().id)).toHaveLength(2);
    expect(page().wikitext).toBe(V2);
  });

  it("stores what XML can carry, and hashes what it stored", async () => {
    await editing().saveWikitext({
      title: "Caphiria",
      wikitext: "bad \uD800 and \uDC00 end",
      baseRevisionRef: "5001",
    });
    const surrogates = "bad � and � end";
    expect(page().wikitext).toBe(surrogates);
    expect(revisionsOf(page().id).at(-1)).toMatchObject({
      wikitext: surrogates,
      sha1: mwSha1Base36(surrogates),
      byteSize: Buffer.byteLength(surrogates, "utf8"),
    });

    const head = revisionsOf(page().id).at(-1)!.id;
    await editing().saveWikitext({
      title: "Caphiria",
      wikitext: "bo\u0001dy\u000B é￾\u0000\ttab\r\nend\u001F",
      baseRevisionRef: head,
    });
    const stripped = "body é\ttab\r\nend";
    expect(page().wikitext).toBe(stripped);
    expect(revisionsOf(page().id).at(-1)).toMatchObject({
      wikitext: stripped,
      sha1: mwSha1Base36(stripped),
      byteSize: Buffer.byteLength(stripped, "utf8"),
    });
  });

  it("lets the reader walk the history and open every revision by its revid", async () => {
    await editing().saveWikitext({ title: "Caphiria", wikitext: V2, baseRevisionRef: "5001" });
    await editing().saveWikitext({
      title: "Caphiria",
      wikitext: `${V2}\nMore.`,
      baseRevisionRef: revisionsOf(page().id).at(-1)!.id,
    });

    const listed = await history().getHistory({ title: "Caphiria" });
    const entries = listed.revisions;
    // newest first: two native edits (row ids) on top of the synced r1 (its MediaWiki rev id)
    expect(entries.map((entry) => entry.revid)).toEqual([
      ...revisionsOf(page().id)
        .slice(1)
        .map((row) => row.id)
        .reverse(),
      "5001",
    ]);
    expect(entries.map((entry) => entry.byteDelta)).toEqual([
      Buffer.byteLength("\nMore."),
      Buffer.byteLength(V2) - V1.length,
      V1.length,
    ]);

    const texts = [`${V2}\nMore.`, V2, V1];
    for (const [index, entry] of entries.entries()) {
      await expect(getRevisionWikitext(entry.revid)).resolves.toMatchObject({
        wikitext: texts[index],
        title: "Caphiria",
        source: "ixwiki",
      });
      await expect(history().getRevisionContent({ revid: entry.revid })).resolves.toMatchObject({
        wikitext: texts[index],
      });
    }
    await expect(getRevisionWikitext("9999")).resolves.toBeNull();
    await expect(getRevisionWikitext("cmissing")).resolves.toBeNull();
  });

  it("purges: the view goes stale and is rendered again, the text stays", async () => {
    let finish!: () => void;
    const held = new Promise<void>((resolve) => (finish = resolve));
    jest.mocked(renderArticleViaMediaWiki).mockImplementationOnce(async (wikitext: string) => {
      await held;
      return parse(wikitext);
    });

    await purgeArticle({ id: page().id, title: "Caphiria" });

    expect(page().htmlSyncedAt).toBeNull();
    finish();
    expect(page().wikitext).toBe(V1);
    expect(evictWikiTitleCaches).toHaveBeenCalledWith("Caphiria", "ixwiki", page().id);
    await settle();
    expect(jest.mocked(renderArticleViaMediaWiki).mock.calls).toEqual([[V1, "Caphiria"]]);
    expect(page().htmlSyncedAt).toBeInstanceOf(Date);
    expect(revisionsOf(page().id)).toHaveLength(1);
  });

  it("saves under the canonical title, and hands the editor every reference of the head with its text", async () => {
    // the head is stamped with MediaWiki's id (5001); a native save adds its row id as the newest head
    const loaded = await reading().getWikitext({ title: "Caphiria" });
    expect(loaded).toMatchObject({
      revisionRef: "5001",
      revisionRefs: expect.arrayContaining([r1, "5001"]),
    });

    await editing().saveWikitext({ title: "caphiria", wikitext: V2, baseRevisionRef: "5001" });
    expect(tables.wikiArticle.rows.map((row) => row.title)).toEqual(["Caphiria"]);

    // a head that cannot be read still leaves the editor the text, with no reference to save against
    const down = jest
      .spyOn(tables.wikiRevision, "findMany")
      .mockRejectedValueOnce(new Error("db down"));
    await expect(reading().getWikitext({ title: "Caphiria" })).resolves.toMatchObject({
      wikitext: V2,
      revisionRef: null,
      revisionRefs: [],
    });
    down.mockRestore();
  });

  it("reads a revision whose text is unknown or hidden as unknown, never as an empty page", async () => {
    const id = page().id;
    const at = (day: number) => new Date(`2026-09-0${day}T00:00:00Z`);
    tables.wikiRevision.insert({
      articleId: id,
      mwRevId: 4001,
      wikitext: "",
      byteSize: 4096,
      createdAt: at(2),
    }); // imported placeholder
    tables.wikiRevision.insert({
      articleId: id,
      mwRevId: 4002,
      wikitext: "",
      byteSize: 0,
      createdAt: at(3),
    }); // synced, empty: unknown
    tables.wikiRevision.insert({
      articleId: id,
      mwRevId: 4003,
      wikitext: "",
      byteSize: 0,
      textDeleted: true,
      createdAt: at(4),
    });
    const blank = tables.wikiRevision.insert({
      articleId: id,
      wikitext: "",
      byteSize: 0,
      createdAt: at(5),
    }); // native, really empty
    tables.wikiRevision.insert({
      articleId: id,
      mwRevId: 9001,
      wikitext: "conflicting text",
      byteSize: 16,
      parked: true,
      createdAt: at(6),
    });

    await expect(getRevisionWikitext("4001")).resolves.toMatchObject({
      wikitext: null,
      title: "Caphiria",
    });
    await expect(getRevisionWikitext("4002")).resolves.toMatchObject({ wikitext: null });
    await expect(getRevisionWikitext("4003")).resolves.toMatchObject({ wikitext: null });
    await expect(getRevisionWikitext(blank.id)).resolves.toMatchObject({
      wikitext: "",
      parked: false,
    });
    await expect(getRevisionWikitext("9001")).resolves.toMatchObject({
      wikitext: "conflicting text",
      parked: true,
    });

    // a revision of another wiki is no IxWiki revision
    const other = tables.wikiArticle.insert({
      title: "Caphiria",
      slug: "caphiria",
      source: "iiwiki",
      wikitext: "x",
    });
    const foreign = tables.wikiRevision.insert({
      articleId: other.id,
      source: "iiwiki",
      mwRevId: 7001,
      wikitext: "x",
      byteSize: 1,
    });
    await expect(getRevisionWikitext("7001")).resolves.toBeNull();
    await expect(getRevisionWikitext(foreign.id)).resolves.toBeNull();
  });

  it("refuses a revert to text it does not have, and blanking but for an administrator; an overwritten revision's text comes back", async () => {
    const id = page().id;
    const urcea = tables.wikiArticle.insert({ title: "Urcea", slug: "urcea", wikitext: "Urcea." });
    tables.wikiRevision.insert({
      articleId: urcea.id,
      mwRevId: 4100,
      wikitext: "Urcea.",
      byteSize: 6,
    });
    tables.wikiRevision.insert({ articleId: id, mwRevId: 4001, wikitext: "", byteSize: 4096 }); // never imported
    tables.wikiRevision.insert({
      articleId: id,
      mwRevId: 9001,
      wikitext: "conflicting text",
      byteSize: 16,
      parked: true,
    });
    const blank = tables.wikiRevision.insert({ articleId: id, wikitext: "", byteSize: 0 });
    const blanks = tables.wikiRevision.insert({
      articleId: id,
      wikitext: " \n\t  \n",
      byteSize: 6,
    });
    const before = revisionsOf(id).length;
    const revert = (revid: string, as = editing) =>
      as().revertToRevision({ title: "Caphiria", revid });

    await expect(revert("4001")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(revert("4100")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(revert(blank.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(revert(blanks.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(revisionsOf(id)).toHaveLength(before);
    expect(page().wikitext).toBe(V1);

    // an administrator may blank the page
    await revert(blank.id, administrator);
    expect(page().wikitext).toBe("");

    // an overwritten revision (kept in the history with its text) is restored like any other
    await revert("9001");
    expect(page().wikitext).toBe("conflicting text");
  });

  it("rolls back to the last other editor's text, and refuses when every revision is the same editor's", async () => {
    tables.wikiUserGroup.seed({ userId: "db-member", group: "rollbacker" });
    await editing().saveWikitext({ title: "Caphiria", wikitext: V2, baseRevisionRef: "5001" });
    await editing().saveWikitext({
      title: "Caphiria",
      wikitext: `${V2}\nMore.`,
      baseRevisionRef: revisionsOf(page().id).at(-1)!.id,
    });

    await editing().rollback({ title: "Caphiria" });
    expect(page().wikitext).toBe(V1);
    expect(revisionsOf(page().id).at(-1)).toMatchObject({
      wikitext: V1,
      summary: expect.stringContaining("Rolled back edits by Member"),
    });

    tables.wikiArticle.insert({ title: "Solo", slug: "solo", wikitext: "two" });
    const solo = tables.wikiArticle.rows.find((row) => row.title === "Solo")!;
    tables.wikiRevision.insert({
      articleId: solo.id,
      wikitext: "one",
      byteSize: 3,
      author: "Member",
      createdAt: new Date("2026-09-01"),
    });
    tables.wikiRevision.insert({
      articleId: solo.id,
      wikitext: "two",
      byteSize: 3,
      author: "Member",
      createdAt: new Date("2026-09-02"),
    });
    await expect(editing().rollback({ title: "Solo" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("evicts the edited page under every spelling a reader used, and nothing else, even when one cache is down", async () => {
    tables.wikiArticle.insert({ title: "Urcea", slug: "urcea", wikitext: "Urcea is a kingdom." });
    for (const spelling of ["Caphiria", "caphiria"]) await getArticleIntro(spelling);
    await getArticleIntro("Urcea");
    jest.spyOn(intelligentLoreCache, "evictTitle").mockRejectedValueOnce(new Error("cache down"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const saved = await editing().saveWikitext({
      title: "Caphiria",
      wikitext: V2,
      baseRevisionRef: "5001",
    });
    expect(saved).toMatchObject({ success: true });
    await settle();

    expect([...wikiBridgeCache.keys()].filter((key) => key.startsWith("intro:"))).toEqual([
      "intro:ixwiki:Urcea",
    ]);
    expect((await getArticleIntro("caphiria"))?.text).toMatch(/^Caphiria is an empire in Sarpedon/);
  });
});
