/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Plan 2026-10-24 Task 9: WikiOS's page operations (delete, move, undelete) through the conflict rule before their mirror
 * jobs send anything. An operation that lost to a later classic change sends nothing, its job is done with a note and one
 * conflict row names its author; one that won goes out (a move from where classic has the page, after bringing a
 * deleted page back), with its trail. Each case runs in both WikiOS modes and in both orders (the mirror first, then
 * the inbound cycle, and the reverse), every step twice: one row, the same outcome on both wikis.
 *
 * Real mirror worker, page-op rule, inbound cycle, log events, PageManagementService and conflict log over the
 * in-memory WikiOS tables (Prisma mode) and a MediaWiki that keeps state (fake-mediawiki-site.ts).
 */
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
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
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn(), createMany: jest.fn().mockResolvedValue([]) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  renderArticleViaMediaWiki: jest.fn(async (wikitext: string) => ({
    html: `<p>${wikitext}</p>`,
    metadata: null,
  })),
}));

import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { notificationAPI } from "~/lib/notifications/api";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const KIR = { userId: "db-kir", name: "Kir" };
const KIR_AUTHOR = { userId: "db-kir", classicName: null, ip: null, label: "Kir" };

const realFetch = global.fetch;
let site: ReturnType<typeof createFakeMediaWikiSite>;

const article = (title: string) =>
  tables.wikiArticle.rows.find((row) => row.title === title && row.status !== "ARCHIVED") ??
  tables.wikiArticle.rows.find((row) => row.title === title);
const articleById = (id: string) => tables.wikiArticle.rows.find((row) => row.id === id)!;
const conflicts = () => tables.wikiConflict.rows;
const overwrittenRefs = (row: Record<string, unknown>) =>
  (row.overwritten as Array<{ ref: string }>).map((change) => change.ref);
const jobOf = (kind: string) => tables.wikiMirrorJob.rows.find((job) => job.kind === kind)!;
const noteOf = (kind: string) => (jobOf(kind).payload as { note?: string }).note;
const sent = (action: string) =>
  site.wiki.calls().filter((request) => request.params.action === action);
/** The site's clock: its last write. */
const siteTime = () => Date.parse(site.now());
/** WikiOS's log entry of the page operation `kind`, dated `at` (WikiOS saved it then). */
const dateOperation = (kind: string, at: Date) => {
  const log = tables.wikiLog.rows.find((row) => row.id === jobOf(kind).logId)!;
  log.createdAt = at;
  return log;
};
/** No published WikiOS redirect points at a page that is not there. */
const danglingRedirects = () =>
  tables.wikiArticle.rows
    .filter((row) => row.status !== "ARCHIVED" && row.redirectTargetSlug)
    .filter((row) => article(String(row.redirectTargetSlug))?.status !== "PUBLISHED")
    .map((row) => row.title);

const mirrorTwice = async () => {
  await runMirrorCycle();
  await runMirrorCycle();
};
const cycleTwice = async () => {
  await runAutoSyncCycle();
  await runAutoSyncCycle();
};
/** The two orders: the mirror first, then the inbound cycle, and the reverse. */
const ORDERS = [
  ["mirror first", [mirrorTwice, cycleTwice]],
  ["cycle first", [cycleTwice, mirrorTwice]],
] as const;
const runInOrder = async (steps: readonly (() => Promise<void>)[]) => {
  for (const step of steps) await step();
};

beforeEach(() => {
  fake.reset();
  wikiBridgeCache.clear();
  jest.clearAllMocks();
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  site = createFakeMediaWikiSite();
  global.fetch = site.fetch as never;

  // Caphiria as both wikis have it: MediaWiki's revision 100 is WikiOS's head, stamped
  const founded = site.editAs("Founder", "Caphiria", "Caphiria is a kingdom.");
  tables.user.seed({ id: "db-kir", clerkUserId: "clerk-kir", handle: "kir" });
  const row = tables.wikiArticle.insert({
    title: "Caphiria",
    slug: "caphiria",
    wikitext: founded.text,
    mwPageId: site.pages.get("Caphiria")!.pageid,
    mwLatestRevId: founded.revid,
    htmlSyncedAt: new Date("2026-09-01"),
  });
  tables.wikiRevision.insert({
    articleId: row.id,
    wikitext: founded.text,
    byteSize: founded.text.length,
    mwRevId: founded.revid,
    sha1: mwSha1Base36(founded.text),
    author: "Founder",
    origin: "classic",
    createdAt: new Date("2026-09-01"),
  });
  tables.systemConfig.seed(
    { key: "wikiAutoSync.rcHighWater", value: site.now() },
    { key: "wikiAutoSync.logHighWater", value: site.now() }
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

describe.each(WIKIOS_MODES)("WikiOS page operations through the conflict rule [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  const caphiriaId = () => article("Caphiria")!.id;

  describe.each(ORDERS)("%s", (_order, steps) => {
    it("a WikiOS delete older than a classic edit is not sent; the job notes it and a row names the deleter", async () => {
      const id = caphiriaId();
      await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
      const deletion = dateOperation("delete", new Date(siteTime() - 60_000));
      const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

      await runInOrder(steps);

      expect(sent("delete")).toEqual([]);
      expect(site.pages.has("Caphiria")).toBe(true);
      expect(jobOf("delete").state).toBe("done");
      expect(noteOf("delete")).toBe("Lost to a later edit in MediaWiki");
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "classic",
        winnerAction: "edit",
        winnerRef: String(bob.revid),
        overwritten: [
          { side: "wikios", action: "delete", ref: `log:${deletion.id}`, author: KIR_AUTHOR },
        ],
      });
      // the classic edit brought the page back in WikiOS too
      expect(articleById(id)).toMatchObject({ status: "PUBLISHED", wikitext: bob.text });
    });

    it("a WikiOS delete older than two classic edits loses to the first of them, as the cycle judges it: one row", async () => {
      await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
      dateOperation("delete", new Date(siteTime() - 60_000));
      const first = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
      site.editAs("Carol", "Caphiria", "Caphiria is a federal republic.");

      await runInOrder(steps);

      expect(sent("delete")).toEqual([]);
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "classic",
        winnerRef: String(first.revid),
      });
    });

    it("a WikiOS delete newer than classic's last edit deletes as before, with no row", async () => {
      const id = caphiriaId();
      await PageManagementService.archiveArticle("Caphiria", "spam", KIR);

      await runInOrder(steps);

      expect(sent("delete")).toHaveLength(1);
      expect(site.pages.has("Caphiria")).toBe(false);
      expect(jobOf("delete")).toMatchObject({ state: "done", payload: { reason: "spam" } });
      expect(conflicts()).toEqual([]);
      expect(articleById(id).status).toBe("ARCHIVED");
    });

    it("a WikiOS delete newer than a classic edit it never saw deletes, and a row names that editor", async () => {
      const id = caphiriaId();
      const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
      await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
      const deletion = dateOperation("delete", new Date());

      await runInOrder(steps);

      // a delete leaves no page to carry a trail: it goes with its own reason
      expect(sent("delete").map((request) => request.params.reason)).toEqual(["spam"]);
      expect(site.pages.has("Caphiria")).toBe(false);
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "wikios",
        winnerAction: "delete",
        winnerRef: `log:${deletion.id}`,
      });
      expect(overwrittenRefs(conflicts()[0]!)).toEqual([String(bob.revid)]);
      expect(articleById(id).status).toBe("ARCHIVED");
    });

    it("a WikiOS move older than a classic move of the same page is not sent", async () => {
      const id = caphiriaId();
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      const move = dateOperation("move", new Date(siteTime() - 60_000));
      site.movePage("Bob", "Caphiria", "Caphiria Republic");

      await runInOrder(steps);

      expect(sent("move")).toEqual([]);
      expect(noteOf("move")).toBe("Lost to a later move in MediaWiki");
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "classic",
        winnerAction: "move",
        overwritten: [{ side: "wikios", action: "move", ref: `log:${move.id}` }],
      });
      // classic's move stands on both wikis: the page is where classic put it, WikiOS's redirect gone
      expect(site.pages.has("Caphiria Republic")).toBe(true);
      expect(articleById(id)).toMatchObject({ title: "Caphiria Republic", status: "PUBLISHED" });
      expect(article("Caphirian Empire")).toBeUndefined();
      expect(danglingRedirects()).toEqual([]);
    });

    it("an undelete older than a classic re-delete is not sent", async () => {
      const id = caphiriaId();
      await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
      await runMirrorCycle();
      expect(site.pages.has("Caphiria")).toBe(false);
      await PageManagementService.restoreArticle("Caphiria", KIR, "ixwiki", "back");
      const undelete = dateOperation("undelete", new Date(siteTime() - 30_000));
      site.restorePage("Admin", "Caphiria");
      site.deletePage("Admin", "Caphiria", "vandalism");

      await runInOrder(steps);

      expect(sent("undelete")).toEqual([]);
      expect(noteOf("undelete")).toBe("Lost to a later delete in MediaWiki");
      expect(site.pages.has("Caphiria")).toBe(false);
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "classic",
        winnerAction: "delete",
        overwritten: [{ side: "wikios", action: "undelete", ref: `log:${undelete.id}` }],
      });
      expect(articleById(id).status).toBe("ARCHIVED");
    });

    it("a WikiOS move later than a classic move moves classic's page from where classic has it", async () => {
      const id = caphiriaId();
      const pageid = site.pages.get("Caphiria")!.pageid;
      site.movePage("Bob", "Caphiria", "Caphiria Republic");
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      const move = dateOperation("move", new Date());

      await runInOrder(steps);

      // classic's page (the one Bob moved) is at WikiOS's title; its old title redirects there as in WikiOS
      expect(site.pages.get("Caphirian Empire")?.pageid).toBe(pageid);
      expect(site.pages.has("Caphiria Republic")).toBe(false);
      expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphirian Empire]]");
      expect(articleById(id)).toMatchObject({ title: "Caphirian Empire", status: "PUBLISHED" });
      expect(article("Caphiria Republic")).toBeUndefined();
      expect(article("Caphiria")).toMatchObject({ redirectTargetSlug: "Caphirian Empire" });
      expect(conflicts()).toHaveLength(1);
      const [row] = conflicts();
      expect(row).toMatchObject({
        winnerSide: "wikios",
        winnerAction: "move",
        winnerRef: `log:${move.id}`,
        trailRevisionId: `log:${move.id}`,
      });
      expect(overwrittenRefs(row!)).toEqual([expect.stringMatching(/^mwlog:\d+$/)]);
      // one trail line on each wiki: WikiOS's move log entry and the move MediaWiki logged
      const trail = `(conflict ${row!.id})`;
      expect(String(move.comment)).toContain(trail);
      expect(site.logEvents.filter((event) => event.comment.includes(trail))).toHaveLength(1);
    });

    it("a WikiOS move later than a classic move that left no redirect still moves classic's page", async () => {
      const id = caphiriaId();
      site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      dateOperation("move", new Date());

      await runInOrder(steps);

      expect(site.pages.has("Caphirian Empire")).toBe(true);
      expect(site.pages.has("Caphiria Republic")).toBe(false);
      expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphirian Empire]]");
      expect(jobOf("move").state).toBe("done");
      expect(articleById(id).title).toBe("Caphirian Empire");
      expect(conflicts()).toHaveLength(1);
    });

    it("a classic delete after an unsent WikiOS move is judged against the move: the page goes on both wikis", async () => {
      const id = caphiriaId();
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      const move = dateOperation("move", new Date(siteTime() - 60_000));
      site.deletePage("Admin", "Caphiria");

      await runInOrder(steps);

      expect(sent("move")).toEqual([]);
      expect(noteOf("move")).toBe("Lost to a later delete in MediaWiki");
      expect(site.pages.has("Caphirian Empire")).toBe(false);
      expect(articleById(id).status).toBe("ARCHIVED");
      expect(article("Caphiria")?.status).toBe("ARCHIVED");
      expect(danglingRedirects()).toEqual([]);
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "classic",
        winnerAction: "delete",
        overwritten: [{ side: "wikios", action: "move", ref: `log:${move.id}` }],
      });
    });

    it("a WikiOS move later than a classic delete brings the page back in classic and moves it", async () => {
      const id = caphiriaId();
      site.deletePage("Admin", "Caphiria");
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      const move = dateOperation("move", new Date());

      await runInOrder(steps);

      expect(sent("undelete")).toHaveLength(1);
      expect(site.current("Caphirian Empire")?.text).toBe("Caphiria is a kingdom.");
      expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphirian Empire]]");
      expect(articleById(id)).toMatchObject({ title: "Caphirian Empire", status: "PUBLISHED" });
      expect(conflicts()).toHaveLength(1);
      expect(conflicts()[0]).toMatchObject({
        winnerSide: "wikios",
        winnerRef: `log:${move.id}`,
        overwritten: [{ side: "classic", action: "delete" }],
      });
    });

    it("a winning classic move over a chain of WikiOS moves leaves no WikiOS redirect pointing at a page that is gone", async () => {
      const id = caphiriaId();
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      await PageManagementService.movePage("Caphirian Empire", "Imperial Caphiria", "again", KIR);
      const [first, second] = tables.wikiMirrorJob.rows.filter((job) => job.kind === "move");
      for (const job of [first!, second!]) {
        tables.wikiLog.rows.find((row) => row.id === job.logId)!.createdAt = new Date(
          siteTime() - 60_000
        );
      }
      site.movePage("Bob", "Caphiria", "Caphiria Republic");

      await runInOrder(steps);

      expect(sent("move")).toEqual([]);
      expect(
        tables.wikiMirrorJob.rows.filter((job) => job.kind === "move").map((job) => job.state)
      ).toEqual(["done", "done"]);
      expect(articleById(id)).toMatchObject({ title: "Caphiria Republic", status: "PUBLISHED" });
      expect(danglingRedirects()).toEqual([]);
      expect(conflicts()).toHaveLength(1);
      expect(overwrittenRefs(conflicts()[0]!)).toEqual([
        `log:${first!.logId}`,
        `log:${second!.logId}`,
      ]);
    });
  });
});

describe.each(WIKIOS_MODES)("a page job sent again [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  it("a winning move whose answer was lost is done on the retry, its trail written once on each wiki", async () => {
    site.movePage("Bob", "Caphiria", "Caphiria Republic");
    await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
    const move = dateOperation("move", new Date());
    // MediaWiki makes the first move, and its answer never arrives
    let lose = 1;
    global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const response = await site.fetch(input, init);
      const moving = init?.body instanceof URLSearchParams && init.body.get("action") === "move";
      if (moving && lose-- > 0) return new Response("{}", { status: 500 });
      return response;
    }) as never;

    await runMirrorCycle();
    expect(jobOf("move")).toMatchObject({ state: "pending", attempts: 1 });
    jobOf("move").nextAttemptAt = new Date(Date.now() - 1_000);
    await mirrorTwice();

    expect(jobOf("move").state).toBe("done");
    expect(site.pages.has("Caphirian Empire")).toBe(true);
    expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphirian Empire]]");
    const [row] = conflicts();
    expect(conflicts()).toHaveLength(1);
    const trail = `(conflict ${row!.id})`;
    expect(String(move.comment).split(trail)).toHaveLength(2);
    expect(site.logEvents.filter((event) => event.comment.includes(trail))).toHaveLength(1);
  });
});

describe.each(WIKIOS_MODES)("what a page job finds in classic [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  it("classic revisions WikiOS has, or wrote itself, never meet its delete: it goes out with its own reason, no row", async () => {
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runAutoSyncCycle();
    site.editAs(site.mirror, "Caphiria", "Caphiria is a republic.\n");
    await PageManagementService.archiveArticle("Caphiria", "spam", KIR);

    await mirrorTwice();

    expect(sent("delete").map((request) => request.params.reason)).toEqual(["spam"]);
    expect(conflicts()).toEqual([]);
  });

  it("an undelete of a page whose classic delete WikiOS had seen goes out, with no row", async () => {
    site.deletePage("Admin", "Caphiria");
    await runAutoSyncCycle();
    expect(article("Caphiria")?.status).toBe("ARCHIVED");
    await PageManagementService.restoreArticle("Caphiria", KIR, "ixwiki", "back");

    await mirrorTwice();

    expect(sent("undelete")).toHaveLength(1);
    expect(site.pages.has("Caphiria")).toBe(true);
    expect(conflicts()).toEqual([]);
  });

  it("an undelete after WikiOS's own delete, or after a classic restore, goes out with no row", async () => {
    await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
    await runMirrorCycle();
    await PageManagementService.restoreArticle("Caphiria", KIR, "ixwiki", "back");
    await mirrorTwice();
    expect(site.pages.has("Caphiria")).toBe(true);

    await PageManagementService.archiveArticle("Caphiria", "spam again", KIR);
    await runMirrorCycle();
    site.restorePage("Admin", "Caphiria");
    await PageManagementService.restoreArticle("Caphiria", KIR, "ixwiki", "back again");
    await mirrorTwice();

    expect(site.pages.has("Caphiria")).toBe(true);
    expect(tables.wikiMirrorJob.rows.every((job) => job.state === "done")).toBe(true);
    expect(conflicts()).toEqual([]);
  });

  it("a classic move to the title WikiOS moved the page to is the same move: no row", async () => {
    site.movePage("Bob", "Caphiria", "Caphirian Empire");
    await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
    dateOperation("move", new Date(siteTime() - 60_000));

    await mirrorTwice();

    expect(jobOf("move").state).toBe("done");
    expect(site.pages.has("Caphirian Empire")).toBe(true);
    expect(conflicts()).toEqual([]);
  });

  it("a page someone made at classic's old title since is left alone by a winning move", async () => {
    site.movePage("Bob", "Caphiria", "Caphiria Republic");
    site.editAs("Carol", "Caphiria", "Caphiria is a city.");
    await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
    dateOperation("move", new Date());

    await mirrorTwice();

    expect(site.pages.has("Caphirian Empire")).toBe(true);
    expect(site.current("Caphiria")?.text).toBe("Caphiria is a city.");
  });

  it("a winning move that leaves no redirect, over a classic move that left none, leaves the old title empty", async () => {
    site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
    await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR, "ixwiki", {
      leaveRedirect: false,
    });
    dateOperation("move", new Date());

    await mirrorTwice();

    expect(site.pages.has("Caphirian Empire")).toBe(true);
    expect(site.pages.has("Caphiria")).toBe(false);
    expect(sent("edit")).toEqual([]);
  });

  it.each([
    ["through the redirect the second move left", false, true],
    ["through the move log, the second move having left no redirect", true, false],
  ])(
    "a winning move finds classic's page after two classic moves, %s",
    async (_how, firstRedirect, secondRedirect) => {
      const pageid = site.pages.get("Caphiria")!.pageid;
      site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: firstRedirect });
      site.movePage("Bob", "Caphiria Republic", "Republic of Caphiria", {
        redirect: secondRedirect,
      });
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      dateOperation("move", new Date());

      await mirrorTwice();

      expect(site.pages.get("Caphirian Empire")?.pageid).toBe(pageid);
      expect(site.pages.has("Republic of Caphiria")).toBe(false);
      expect(jobOf("move").state).toBe("done");
    }
  );

  it("a move of a page classic deleted and someone made again moves the new page: nothing is undeleted", async () => {
    site.deletePage("Admin", "Caphiria");
    site.editAs("Bob", "Caphiria", "Caphiria, made again.");
    await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
    dateOperation("move", new Date());

    await mirrorTwice();

    expect(sent("undelete")).toEqual([]);
    expect(site.current("Caphirian Empire")?.text).toBe("Caphiria, made again.");
  });
});

describe.each(WIKIOS_MODES)(
  "a classic move or protection and what WikiOS does next [%s]",
  (mode) => {
    let restoreMode: () => void = () => undefined;
    beforeEach(async () => {
      restoreMode = await seedWikiosMode(fake.db, mode);
    });
    afterEach(() => restoreMode());

    const caphiriaId = () => article("Caphiria")!.id;
    /** Kir's WikiOS save of the page now at `title`, on its head, counting at `at` when given. */
    const kirSaves = async (title: string, wikitext: string, at?: Date) => {
      const head = tables.wikiRevision.rows
        .filter((row) => row.articleId === article(title)!.id && !row.parked)
        .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
        .at(-1) as { id: string; mwRevId: number | null };
      const saved = await ArticleRepository.saveArticle(
        { slug: title, title, wikitext, expectedHeadRef: toRevisionRef(head) },
        "db-kir",
        "Kir"
      );
      if (at) tables.wikiRevision.rows.find((row) => row.id === saved.revisionId)!.createdAt = at;
      return saved;
    };
    /** Nothing anyone would read as a collision: no row, no notice, no trail line on either wiki. */
    const expectNoCollision = () => {
      expect(conflicts()).toEqual([]);
      expect(jest.mocked(notificationAPI.createMany)).not.toHaveBeenCalled();
      expect(
        tables.wikiRevision.rows.filter((row) => String(row.summary ?? "").includes("Overwrote"))
      ).toEqual([]);
      const classic = [...site.pages.values()].flatMap((page) => page.revisions);
      expect(classic.filter((revision) => revision.comment.includes("Overwrote"))).toEqual([]);
    };
    const duplicates = () => {
      const titles = tables.wikiArticle.rows
        .filter((row) => row.status !== "ARCHIVED")
        .map((row) => row.title);
      return titles.filter((title, at) => titles.indexOf(title) !== at);
    };

    it("a WikiOS edit after a classic move is no collision: the mover's null revision is not an edit", async () => {
      site.movePage("Bob", "Caphiria", "Caphiria Republic");
      await cycleTwice();
      await kirSaves("Caphiria Republic", "Caphiria is a republic in Sarpedon.");

      await mirrorTwice();
      await cycleTwice();

      expect(site.current("Caphiria Republic")?.text).toBe("Caphiria is a republic in Sarpedon.");
      expectNoCollision();
    });

    it("a WikiOS edit after a classic protection is no collision", async () => {
      site.protectPage("Admin", "Caphiria");
      await cycleTwice();
      await kirSaves("Caphiria", "Caphiria is a protected kingdom.");

      await mirrorTwice();

      expect(site.current("Caphiria")?.text).toBe("Caphiria is a protected kingdom.");
      expectNoCollision();
    });

    it("a WikiOS delete after a classic move is no collision: it deletes the page where it is", async () => {
      site.movePage("Bob", "Caphiria", "Caphiria Republic");
      await cycleTwice();
      await PageManagementService.archiveArticle("Caphiria Republic", "spam", KIR);

      await mirrorTwice();
      await cycleTwice();

      expect(site.pages.has("Caphiria Republic")).toBe(false);
      expectNoCollision();
    });

    it.each(ORDERS)(
      "a WikiOS edit made before a classic move and mirrored after it is the newest real change: it wins with no row (%s)",
      async (_order, steps) => {
        // Kir saves a second after classic's revision WikiOS has, a second before Bob's move (the site's clock moves
        // on a second per write)
        site.editAs("Founder", "Elsewhere", "Another page.");
        const saved = await kirSaves("Caphiria", "Caphiria is an empire.", new Date(siteTime()));
        site.movePage("Bob", "Caphiria", "Caphiria Republic");

        await runInOrder(steps);

        expect(site.current("Caphiria Republic")?.text).toBe("Caphiria is an empire.");
        expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphiria Republic]]");
        expect(tables.wikiRevision.rows.find((row) => row.id === saved.revisionId)?.parked).toBe(
          false
        );
        expect(duplicates()).toEqual([]);
        expectNoCollision();
      }
    );

    it("a revision job queued before a WikiOS move goes to the title classic still has the page at: one page on classic", async () => {
      await kirSaves("Caphiria", "Caphiria is an empire.");
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);

      await mirrorTwice();

      expect(site.pages.has("Caphiria")).toBe(true);
      expect(site.current("Caphirian Empire")?.text).toBe("Caphiria is an empire.");
      expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphirian Empire]]");
      expect(tables.wikiMirrorJob.rows.every((job) => job.state === "done")).toBe(true);
    });

    it("a revision of a page someone made anew at a title classic once moved away goes to that page", async () => {
      site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
      await cycleTwice();
      site.editAs("Carol", "Caphiria", "Caphiria is a city.");
      await cycleTwice();
      await kirSaves("Caphiria", "Caphiria is a city by the sea.");

      await mirrorTwice();

      expect(site.current("Caphiria")?.text).toBe("Caphiria is a city by the sea.");
      expect(site.current("Caphiria Republic")?.text).toBe("Caphiria is a kingdom.");
    });

    it("a revision mirrored before the cycle saw a classic move goes to the moved page, never to a new page at the old title", async () => {
      await kirSaves("Caphiria", "Caphiria is an empire.");
      site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
      site.editAs("Carol", "Caphiria", "Caphiria is a city.");

      await mirrorTwice();

      expect(site.current("Caphiria Republic")?.text).toBe("Caphiria is an empire.");
      expect(site.current("Caphiria")?.text).toBe("Caphiria is a city.");
    });

    it("a revision mirrored after a classic move and a delete it never saw brings the page back where classic had it", async () => {
      await kirSaves("Caphiria", "Caphiria is an empire.");
      site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
      site.deletePage("Admin", "Caphiria Republic");

      await mirrorTwice();

      expect(site.current("Caphiria Republic")?.text).toBe("Caphiria is an empire.");
      expect(site.pages.has("Caphiria")).toBe(false);
    });

    it("a revision job queued under the old title goes where the article lives now, after the cycle renamed it", async () => {
      await kirSaves("Caphiria", "Caphiria is an empire.");
      site.movePage("Bob", "Caphiria", "Caphiria Republic");

      await cycleTwice();
      await mirrorTwice();
      await cycleTwice();

      expect(site.current("Caphiria Republic")?.text).toBe("Caphiria is an empire.");
      expect(site.current("Caphiria")?.text).toBe("#REDIRECT [[Caphiria Republic]]");
      expect(article("Caphiria Republic")?.wikitext).toBe("Caphiria is an empire.");
      expect(duplicates()).toEqual([]);
    });

    describe.each(ORDERS)("%s", (_order, steps) => {
      it.each([
        ["leaving a redirect", true],
        ["leaving no redirect", false],
      ])(
        "a classic move after a WikiOS delete wins: the page is live at its new title on both wikis, the deleter told (%s)",
        async (_how, redirect) => {
          const id = caphiriaId();
          await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
          const deletion = dateOperation("delete", new Date(siteTime() - 60_000));
          site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect });

          await runInOrder(steps);

          expect(sent("delete")).toEqual([]);
          expect(noteOf("delete")).toBe("Lost to a later move in MediaWiki");
          expect(site.pages.has("Caphiria Republic")).toBe(true);
          expect(articleById(id)).toMatchObject({
            title: "Caphiria Republic",
            status: "PUBLISHED",
          });
          expect(conflicts()).toHaveLength(1);
          expect(conflicts()[0]).toMatchObject({
            winnerSide: "classic",
            winnerAction: "move",
            winnerRef: expect.stringMatching(/^mwlog:\d+$/),
            overwritten: [
              { side: "wikios", action: "delete", ref: `log:${deletion.id}`, author: KIR_AUTHOR },
            ],
          });
          expect(duplicates()).toEqual([]);
        }
      );

      it.each([
        ["leaving a redirect", true],
        ["leaving no redirect", false],
      ])(
        "a classic move before a WikiOS delete loses: the delete follows the page to its new title (%s)",
        async (_how, redirect) => {
          const id = caphiriaId();
          site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect });
          await PageManagementService.archiveArticle("Caphiria", "spam", KIR);
          const deletion = dateOperation("delete", new Date());

          await runInOrder(steps);

          expect(sent("delete").map((request) => request.params.title)).toEqual([
            "Caphiria Republic",
          ]);
          expect(site.pages.has("Caphiria Republic")).toBe(false);
          expect(articleById(id).status).toBe("ARCHIVED");
          expect(conflicts()).toHaveLength(1);
          expect(conflicts()[0]).toMatchObject({
            winnerSide: "wikios",
            winnerAction: "delete",
            winnerRef: `log:${deletion.id}`,
            overwritten: [{ side: "classic", action: "move" }],
          });
        }
      );

      it("classic deleting the page after WikiOS's winning move: the move is not sent, and the page goes on both wikis", async () => {
        const id = caphiriaId();
        site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
        await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
        dateOperation("move", new Date(siteTime() + 30_000));
        // the delete is the latest change: it happens after WikiOS's move
        site.deletePage("Admin", "Caphiria Republic");
        const removal = site.logEvents.filter((event) => event.type === "delete").at(-1)!;
        removal.timestamp = new Date(siteTime() + 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");

        await runInOrder(steps);

        expect(sent("move")).toEqual([]);
        expect(noteOf("move")).toBe("Lost to a later delete in MediaWiki");
        expect(jobOf("move").state).toBe("done");
        expect(articleById(id).status).toBe("ARCHIVED");
        expect(danglingRedirects()).toEqual([]);
        expect(conflicts().find((row) => row.winnerAction === "delete")).toMatchObject({
          winnerSide: "classic",
          winnerRef: `mwlog:${removal.logid}`,
        });
      });
    });

    it.each(ORDERS)(
      "a WikiOS move later than a classic move and a classic delete of the page brings it back where classic had it and moves it (%s)",
      async (_order, steps) => {
        const id = caphiriaId();
        const pageid = site.pages.get("Caphiria")!.pageid;
        site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
        site.deletePage("Admin", "Caphiria Republic");
        await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
        dateOperation("move", new Date());

        await runInOrder(steps);

        expect(sent("undelete").map((request) => request.params.title)).toEqual([
          "Caphiria Republic",
        ]);
        expect(site.pages.get("Caphirian Empire")?.pageid).toBe(pageid);
        expect(articleById(id)).toMatchObject({ title: "Caphirian Empire", status: "PUBLISHED" });
        expect(jobOf("move").state).toBe("done");
      }
    );

    it("a winning WikiOS move whose page classic has nowhere (and never deleted) fails, for an administrator to look at", async () => {
      site.movePage("Bob", "Caphiria", "Caphiria Republic", { redirect: false });
      site.pages.delete("Caphiria Republic");
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      dateOperation("move", new Date());

      await runMirrorCycle();

      expect(jobOf("move")).toMatchObject({ state: "pending", attempts: 1 });
      expect(String(jobOf("move").lastError)).toContain("nowhere");
      expect(sent("move")).toEqual([]);
    });

    it("a winning WikiOS move never moves an unrelated page made at classic's in-between title", async () => {
      const pageid = site.pages.get("Caphiria")!.pageid;
      site.movePage("Bob", "Caphiria", "Caphiria Republic");
      site.movePage("Bob", "Caphiria Republic", "Republic of Caphiria", { redirect: false });
      site.editAs("Carol", "Caphiria Republic", "A different republic.");
      await PageManagementService.movePage("Caphiria", "Caphirian Empire", "rename", KIR);
      dateOperation("move", new Date());

      await mirrorTwice();

      expect(site.pages.get("Caphirian Empire")?.pageid).toBe(pageid);
      expect(site.current("Caphiria Republic")?.text).toBe("A different republic.");
    });
  }
);
