/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario: WikiOS and classic MediaWiki edited side by side. An editor changes Caphiria on MediaWiki and an
 * administrator deletes another page there; the inbound cycle fast-forwards Caphiria (rendered again from the new
 * text, its intro the new text at once), archives the deleted page and tells the watchers. A WikiOS member then edits Caphiria: the mirror
 * imports the revision under `wikios>Label`, stamps MediaWiki's revision on it, and a second cycle has nothing to do.
 * A MediaWiki edit on the base WikiOS has moved past is parked with one re-push of WikiOS's head, and the next cycle
 * pushes nothing again; the re-push itself coming back is WikiOS's own echo. A page whose revision cannot be read
 * holds its later revisions and the mark back while other pages sync, and the health telemetry says so.
 *
 * Real auto-sync cycle, inbound decision and log events, importer, ArticleRepository, mirror worker, queue, revision
 * import and bot login run over the in-memory WikiOS tables (Prisma mode) and a MediaWiki that keeps state
 * (fake-mediawiki-site.ts). MediaWiki's render is a stand-in.
 *
 * Folds:
 * - wikios-health-telemetry.test.ts: after a cycle with a failed page getHealthTelemetry is DEGRADED and carries the
 *   stored status; after a clean cycle ACTIVE; when the status row cannot be read UNKNOWN, never ACTIVE.
 * - import-label.test.ts: the revision MediaWiki gets names `importName("  Kir\n Republic ")` = "wikios>Kir Republic",
 *   an unattributed save "wikios>Community Contributor"; `labelOfImportName` reads MediaWiki's name back as the label
 *   ("wikios>Kir_Republic" stays "Kir_Republic", "wikios>  Kir Republic " is "Kir Republic") and is null for a bare
 *   MediaWiki name and for "Wikios>Kir" (the prefix is case-sensitive).
 */
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-wiki-db").createFakeWikiDb({ prisma: true });
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
  renderArticleViaMediaWiki: jest.fn(async (wikitext: string) => ({ html: `<p>${wikitext}</p>`, metadata: null })),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { getArticleIntro } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { labelOfImportName } from "~/lib/wiki-os/services/import-label";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { notificationAPI } from "~/lib/notifications/api";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const telemetry = () =>
  createCallerFactory(wikiosUtilitiesRouter)(createMockRouterContext({ auth: null, user: null }) as never).getHealthTelemetry();

const article = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const revisionsOf = (title: string) => tables.wikiRevision.rows.filter((row) => row.articleId === article(title)?.id);
/** The page's head: its newest revision that is not parked. */
const headOf = (title: string) => revisionsOf(title).filter((row) => !row.parked).at(-1)!;
const jobs = () => tables.wikiMirrorJob.rows.map((job) => `${job.kind} ${job.title} ${job.state}`);
const notices = () =>
  jest
    .mocked(notificationAPI.createMany)
    .mock.calls.flatMap(([inputs]) => inputs.map((input) => `${input.userId} ${(input.metadata as { kind: string }).kind}`));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const realFetch = global.fetch;
let site: ReturnType<typeof createFakeMediaWikiSite>;

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
  const old = site.editAs("Founder", "Old page", "An old page.");
  tables.user.seed({ id: "db-watcher", clerkUserId: "clerk-watcher", wikiUsername: "Watcher" });
  for (const [title, revision] of [["Caphiria", founded], ["Old page", old]] as const) {
    const row = tables.wikiArticle.insert({
      title,
      slug: title.toLowerCase().replace(/ /g, "_"),
      wikitext: revision.text,
      mwPageId: site.pages.get(title)!.pageid,
      mwLatestRevId: revision.revid,
      htmlSyncedAt: new Date("2026-09-01"),
    });
    tables.wikiRevision.insert({
      articleId: row.id,
      wikitext: revision.text,
      byteSize: revision.text.length,
      mwRevId: revision.revid,
      sha1: mwSha1Base36(revision.text),
      author: "Founder",
      createdAt: new Date("2026-09-01"),
    });
  }
  tables.wikiWatchlist.seed({ userId: "db-watcher", articleId: article("Caphiria")!.id });
  // the marks: every change so far is done
  tables.systemConfig.seed(
    { key: "wikiAutoSync.rcHighWater", value: site.now() },
    { key: "wikiAutoSync.logHighWater", value: site.now() }
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

describe("WikiOS and MediaWiki edited side by side", () => {
  it("syncs MediaWiki's edits and deletions in, mirrors WikiOS's edits out, and parks a conflict once", async () => {
    // the country and geo intros read the page through the bridge, which keeps what it read for 30 minutes
    await expect(getArticleIntro("Caphiria")).resolves.toMatchObject({ text: "Caphiria is a kingdom." });

    // 1. on MediaWiki: Alice edits Caphiria, an administrator deletes Old page
    const alice = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    site.deletePage("Admin", "Old page");

    await runAutoSyncCycle();
    await settle();

    // fast-forward: Alice's revision is WikiOS's head, stamped with MediaWiki's id; the page is stale and re-rendered
    expect(article("Caphiria")).toMatchObject({ wikitext: "Caphiria is an empire.", mwLatestRevId: alice.revid });
    expect(headOf("Caphiria")).toMatchObject({ mwRevId: alice.revid, author: "Alice", parked: false });
    expect(article("Old page")?.status).toBe("ARCHIVED");
    expect(notices()).toEqual(["clerk-watcher edited"]);
    // the reader's view is rendered from the new text
    expect(jest.mocked(renderArticleViaMediaWiki).mock.calls.map(([text]) => text)).toContain("Caphiria is an empire.");
    expect(article("Caphiria")?.htmlSyncedAt).toBeInstanceOf(Date);
    expect((await telemetry()).inboundSyncStatus).toBe("ACTIVE");
    expect(jobs()).toEqual([]); // nothing of MediaWiki's goes back to MediaWiki
    // the fast-forward evicted the page from the bridge: its intro is Alice's text
    expect((await getArticleIntro("Caphiria"))?.text).toBe("Caphiria is an empire.");

    // 2. in WikiOS: a member with no verified wiki account edits Caphiria; the mirror imports it
    const saved = await ArticleRepository.saveArticle(
      { slug: "Caphiria", title: "Caphiria", wikitext: "Caphiria is an empire in Sarpedon.", expectedHeadRef: String(alice.revid) },
      undefined,
      "  Kir\n Republic "
    );
    expect(jobs()).toEqual(["revision Caphiria pending"]);
    await settle();
    expect((await getArticleIntro("Caphiria"))?.text).toBe("Caphiria is an empire in Sarpedon.");

    const first = await runMirrorCycle();
    expect(first).toMatchObject({ done: 1, failed: 0 });
    const imported = site.pages.get("Caphiria")!.revisions.find((r) => r.text === "Caphiria is an empire in Sarpedon.")!;
    expect(imported.user).toBe("wikios>Kir Republic");
    expect(labelOfImportName(imported.user)).toBe("Kir Republic");
    // stamped with the revision MediaWiki shows as current (the import's null revision holds the same text)
    const mwHead = site.current("Caphiria")!;
    expect(mwHead.text).toBe("Caphiria is an empire in Sarpedon.");
    expect(tables.wikiRevision.rows.find((row) => row.id === saved.revisionId)?.mwRevId).toBe(mwHead.revid);
    expect(article("Caphiria")?.mwLatestRevId).toBe(mwHead.revid);
    expect(tables.wikiMirrorJob.rows[0]).toMatchObject({ state: "done", mwRevId: mwHead.revid });
    expect(await runMirrorCycle()).toMatchObject({ done: 0, failed: 0 });
    // the bot logged in with its bot password, and never wrote with an anonymous token
    const logins = site.wiki.requests.filter((request) => request.params.action === "login");
    expect(logins.map((request) => [request.params.lgname, request.params.lgpassword])).toEqual([
      ["WikiOSMirror@wikios", "bot-password"],
    ]);
    expect(site.wiki.calls().filter((request) => request.method === "POST").map((r) => r.params.token)).not.toContain("+\\");

    // an unattributed save goes out as the community contributor
    await ArticleRepository.saveArticle({ slug: "Help:Start", title: "Help:Start", wikitext: "Start here.", expectedHeadRef: null });
    await runMirrorCycle();
    expect(site.pages.get("Help:Start")!.revisions[0]!.user).toBe("wikios>Community Contributor");

    // 3. the member edits again, and before the mirror runs Bob saves on MediaWiki's current text: his parent is
    // the revision WikiOS's last edit went out as, not WikiOS's head any more
    jest.mocked(notificationAPI.createMany).mockClear();
    const again = await ArticleRepository.saveArticle(
      { slug: "Caphiria", title: "Caphiria", wikitext: "Caphiria is an empire in Sarpedon and Ixnay.", expectedHeadRef: String(mwHead.revid) },
      undefined,
      "Kir Republic"
    );
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    // and "Wikios>Kir", a real MediaWiki user (the prefix is lower-case), edits another page: news, not WikiOS's own
    site.editAs("Wikios>Kir", "Ixnay", "Ixnay is a world.");
    expect(labelOfImportName("Wikios>Kir")).toBeNull();
    expect(labelOfImportName("Bob")).toBeNull();

    await runAutoSyncCycle();
    await settle();

    // parked: kept in the history, never the head; WikiOS's head goes back to MediaWiki once, in a restore job
    const parked = () => revisionsOf("Caphiria").filter((row) => row.parked);
    expect(parked().map((row) => row.wikitext)).toEqual(["Caphiria is a republic."]);
    expect(headOf("Caphiria").id).toBe(again.revisionId);
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is an empire in Sarpedon and Ixnay.");
    expect(jobs().filter((job) => job.endsWith("pending"))).toEqual(["revision Caphiria pending", "revision Caphiria pending"]);
    expect(tables.wikiMirrorJob.rows.at(-1)?.payload).toMatchObject({ restore: true });
    expect(article("Ixnay")).toMatchObject({ wikitext: "Ixnay is a world." });
    expect(headOf("Ixnay")).toMatchObject({ author: "Wikios>Kir", parked: false });

    // the mirror: MediaWiki moved on (Bob), so WikiOS's head goes on top as an edit by the mirror account; the
    // restore then finds MediaWiki already holding the head's text
    await runMirrorCycle();
    expect(site.current("Caphiria")).toMatchObject({ text: "Caphiria is an empire in Sarpedon and Ixnay.", user: "WikiOSMirror" });
    expect(jobs().filter((job) => !job.endsWith("done"))).toEqual([]);
    expect(tables.wikiRevision.rows.find((row) => row.id === again.revisionId)?.mwRevId).toBe(site.current("Caphiria")!.revid);

    // 4. the next cycle sees the mirror's edit come back: WikiOS's own, never judged; nothing parked or pushed again
    const rowsBefore = tables.wikiRevision.rows.length;
    await runAutoSyncCycle();
    expect(parked()).toHaveLength(1);
    expect(headOf("Caphiria").id).toBe(again.revisionId);
    expect(tables.wikiRevision.rows.length).toBe(rowsBefore); // the head already carries that MediaWiki revision
    expect(jobs().filter((job) => !job.endsWith("done"))).toEqual([]);
    expect((await telemetry()).inboundSyncStatus).toBe("ACTIVE");
  });

  it("holds a page whose revision cannot be read, syncs the others, and reports the cycle DEGRADED", async () => {
    const broken = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    const later = site.editAs("Alice", "Caphiria", "Caphiria is an empire, again.");
    site.editAs("Carol", "Ixnay", "Ixnay is a world.");
    site.failRevision(broken.revid);
    const markBefore = tables.systemConfig.rows.find((row) => row.key === "wikiAutoSync.rcHighWater")?.value;

    await runAutoSyncCycle();

    // the failing page holds its later revision back; the other page syncs; the mark stays before the failure
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a kingdom.");
    expect(revisionsOf("Caphiria").map((row) => row.mwRevId)).not.toContain(later.revid);
    expect(article("Ixnay")?.wikitext).toBe("Ixnay is a world.");
    expect(tables.systemConfig.rows.find((row) => row.key === "wikiAutoSync.rcHighWater")?.value).toBe(markBefore);
    const degraded = await telemetry();
    expect(degraded.inboundSyncStatus).toBe("DEGRADED");
    expect(degraded.inboundSync).toMatchObject({ status: "DEGRADED", failures: 1, lastError: expect.stringContaining("500") });

    // MediaWiki answers again: the next cycle applies both revisions in order, and the sync is ACTIVE
    site.recover(broken.revid);
    await runAutoSyncCycle();
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is an empire, again.");
    expect(headOf("Caphiria")).toMatchObject({ mwRevId: later.revid });
    expect((await telemetry()).inboundSyncStatus).toBe("ACTIVE");

    // a status row that cannot be read is UNKNOWN, never ACTIVE
    jest.spyOn(tables.systemConfig, "findUnique").mockRejectedValueOnce(new Error("db down"));
    expect(await telemetry()).toMatchObject({
      inboundSyncStatus: "UNKNOWN",
      inboundSync: { lastRunAt: null, failures: 0, repushSkipped: [] },
    });
  });

  it("reads MediaWiki's names back as labels only for the import prefix", () => {
    expect(labelOfImportName("wikios>Kir_Republic")).toBe("Kir_Republic");
    expect(labelOfImportName("wikios>  Kir Republic ")).toBe("Kir Republic");
  });
});
