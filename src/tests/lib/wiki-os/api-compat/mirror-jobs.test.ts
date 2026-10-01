/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 407 + 410: every write an api.php client makes reaches classic MediaWiki through the mirror outbox, exactly
// one job per page written, inserted in the transaction of the write itself. The api.php modules are the real ones;
// the services behind them are `createApiDeps()`'s (the ones the tRPC routers use) over an in-memory fake of the
// WikiOS tables, so the jobs are the real services' own. Only the permission gate is the harness's no-op.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true, resetAt: new Date(0) }) },
}));
// the kick would run the mirror worker in a timer; the jobs themselves are real
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
  invalidateTemplateDependents: jest.fn(),
  ensureRendered: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/services/title-cache-eviction", () => ({
  evictWikiTitleCaches: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  renderArticleViaMediaWiki: jest.fn(),
  wikitextToHtml: jest.fn(),
}));

import { createApiDeps } from "~/lib/wiki-os/api-compat/deps";
import { scheduleMirrorKick } from "~/lib/wiki-os/services/mirror-outbox";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const { db, tables } = fakeWikiDb;
const real = createApiDeps().services;

const data = (): FakeWikiData => ({
  pages: [
    { pageId: 1, title: "Alpha" },
    { pageId: 2, title: "Talk:Alpha", namespace: 1 },
    { pageId: 3, title: "MediaWiki:Sidebar", namespace: 8 },
  ],
  revisions: [
    {
      revId: 101,
      page: "Alpha",
      timestamp: "2026-01-01T10:00:00Z",
      user: "Heku",
      content: "good text",
    },
    {
      revId: 102,
      page: "Talk:Alpha",
      timestamp: "2026-01-02T10:00:00Z",
      user: "Heku",
      content: "talk",
    },
    {
      revId: 103,
      page: "MediaWiki:Sidebar",
      timestamp: "2026-01-03T10:00:00Z",
      user: "Heku",
      content: "* old",
    },
  ],
});

/** Whether the job inserts happened inside a `$transaction`, in the order they were made. */
let insertedInTransaction: boolean[] = [];

async function setup() {
  const wiki = data();
  let nextRevId = 9000;
  const wikiDeps = await makeWikiDeps(wiki, {
    services: {
      // the real save, then the same revision in the harness's fake store (it answers the module's own reads)
      saveWikitext: async (ctx, save) => {
        await real.saveWikitext(ctx, save);
        const revId = nextRevId++;
        wiki.revisions!.push({
          revId,
          page: save.title,
          timestamp: "2026-09-30T12:00:00Z",
          user: "Heku",
          comment: save.summary,
          content: save.wikitext,
        });
        return { revisionRowId: `row-${revId}` };
      },
      movePage: real.movePage,
      archivePage: real.archivePage,
      restorePage: real.restorePage,
      protectPage: real.protectPage,
    },
  });
  const token = await loggedIn(wikiDeps.bot);
  const act = (action: string, params: Record<string, string>) =>
    wikiDeps.bot.post({ action, token, formatversion: "2", ...params }) as Promise<Body>;
  return { act };
}

const jobs = () => tables.wikiMirrorJob.rows;
const summary = () =>
  jobs().map(
    (job) =>
      `${job.kind}:${job.title}${job.kind === "move" ? `->${(job.payload as { to: string }).to}` : ""}`
  );

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
  insertedInTransaction = [];
  let inTransaction = false;
  jest.spyOn(db, "$transaction").mockImplementation(async (work) => {
    inTransaction = true;
    try {
      return await work(db);
    } finally {
      inTransaction = false;
    }
  });
  const insert = tables.wikiMirrorJob.create;
  jest.spyOn(tables.wikiMirrorJob, "create").mockImplementation(async (args) => {
    insertedInTransaction.push(inTransaction);
    return insert(args);
  });
  tables.wikiArticle.seed(
    {
      id: "a-alpha",
      source: "ixwiki",
      title: "Alpha",
      slug: "alpha",
      namespace: 0,
      wikitext: "good text",
    },
    {
      id: "a-talk",
      source: "ixwiki",
      title: "Talk:Alpha",
      slug: "talk:alpha",
      namespace: 1,
      wikitext: "talk",
    }
  );
});

afterEach(() => jest.restoreAllMocks());

describe("api.php action=edit", () => {
  it("inserts one revision job, in the save's own transaction, for the revision it wrote", async () => {
    const { act } = await setup();

    const body = await act("edit", { title: "Alpha", text: "new text", summary: "via api.php" });

    expect(body.edit.result).toBe("Success");
    expect(tables.wikiRevision.rows).toHaveLength(1);
    expect(jobs()).toHaveLength(1);
    expect(jobs()[0]).toMatchObject({
      source: "ixwiki",
      kind: "revision",
      title: "Alpha",
      articleId: "a-alpha",
      revisionId: tables.wikiRevision.rows[0]!.id,
      state: "pending",
    });
    // inserted inside the transaction that wrote the revision, not after it
    expect(insertedInTransaction).toEqual([true]);
    expect(scheduleMirrorKick).toHaveBeenCalledTimes(1);
  });

  it("inserts one job per edit, and none for an edit that is refused", async () => {
    const { act } = await setup();

    await act("edit", { title: "Alpha", text: "one" });
    await act("edit", { title: "Alpha", text: "two" });
    const refused = await act("edit", { title: "Alpha", text: "three", md5: "0".repeat(32) });

    expect(refused.error.code).toBe("badmd5");
    expect(summary()).toEqual(["revision:Alpha", "revision:Alpha"]);
    expect(jobs().map((job) => job.revisionId)).toEqual(
      tables.wikiRevision.rows.map((row) => row.id)
    );
  });

  it("writes the revision of a MediaWiki: page and no job: the mirror account may never write it", async () => {
    const { act } = await setup();

    await act("edit", { title: "MediaWiki:Sidebar", text: "* navigation" });

    expect(tables.wikiRevision.rows).toHaveLength(1);
    expect(jobs()).toEqual([]);
  });
});

describe("api.php move, delete, undelete and protect", () => {
  it("action=delete queues one delete job with the reason, in the delete's transaction", async () => {
    const { act } = await setup();

    await act("delete", { title: "Alpha", reason: "junk" });

    expect(jobs()).toHaveLength(1);
    expect(jobs()[0]).toMatchObject({
      kind: "delete",
      title: "Alpha",
      payload: { reason: "junk" },
    });
    expect(insertedInTransaction).toEqual([true]);
  });

  it("action=undelete queues one undelete job", async () => {
    tables.wikiArticle.rows.find((row) => row.id === "a-alpha")!.status = "ARCHIVED";
    const { act } = await setup();

    await act("undelete", { title: "Alpha", reason: "oops" });

    expect(summary()).toEqual(["undelete:Alpha"]);
    expect(jobs()[0]).toMatchObject({ payload: { reason: "oops" } });
    expect(insertedInTransaction).toEqual([true]);
  });

  it("action=protect queues one protect job with every restriction", async () => {
    const { act } = await setup();

    await act("protect", {
      title: "Alpha",
      protections: "edit=sysop|move=autoconfirmed",
      expiry: "infinite",
      reason: "vandalism",
    });

    expect(jobs()).toHaveLength(1);
    expect(jobs()[0]).toMatchObject({
      kind: "protect",
      title: "Alpha",
      payload: {
        reason: "vandalism",
        restrictions: [
          { action: "edit", level: "sysop", expiresAt: null },
          { action: "move", level: "autoconfirmed", expiresAt: null },
        ],
      },
    });
    expect(insertedInTransaction).toEqual([true]);
  });

  it("action=move queues one move job per page that moved: the page, and its talk page when it goes along", async () => {
    const { act } = await setup();

    const alone = await act("move", { from: "Alpha", to: "Gamma", reason: "rename" });
    expect(alone.move.from).toBe("Alpha");
    expect(summary()).toEqual(["move:Alpha->Gamma"]);

    fakeWikiDb.reset();
    tables.wikiArticle.seed(
      {
        id: "a-alpha",
        source: "ixwiki",
        title: "Alpha",
        slug: "alpha",
        namespace: 0,
        wikitext: "good text",
      },
      {
        id: "a-talk",
        source: "ixwiki",
        title: "Talk:Alpha",
        slug: "talk:alpha",
        namespace: 1,
        wikitext: "talk",
      }
    );
    const withTalk = await act("move", { from: "Alpha", to: "Gamma", movetalk: "" });
    expect(withTalk.move.talkto).toBe("Talk:Gamma");
    expect(summary()).toEqual(["move:Alpha->Gamma", "move:Talk:Alpha->Talk:Gamma"]);
    expect(insertedInTransaction.every(Boolean)).toBe(true);
  });

  it("queues nothing for a write the service refuses", async () => {
    const { act } = await setup();
    tables.wikiArticle.reset(); // MediaWiki lists the page, WikiOS holds no article for it

    const missing = await act("delete", { title: "Alpha" });
    const cascade = await act("protect", {
      title: "Alpha",
      protections: "edit=sysop",
      cascade: "",
    });

    expect(missing.error.code).toBe("missingtitle");
    expect(cascade.error.code).toBe("cantcascade");
    expect(jobs()).toEqual([]);
  });

  it("queues nothing for a read", async () => {
    const { act } = await setup();

    await act("query", { titles: "Alpha", prop: "revisions" });

    expect(jobs()).toEqual([]);
  });
});
