/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario: WikiOS and classic MediaWiki edited side by side. An editor changes Caphiria on MediaWiki and an
 * administrator deletes another page there; the inbound cycle fast-forwards Caphiria (rendered again from the new
 * text, its intro the new text at once), archives the deleted page and tells the watchers. A WikiOS member then edits Caphiria: the mirror
 * imports the revision under `wikios>Label`, stamps MediaWiki's revision on it, and a second cycle has nothing to do.
 * A MediaWiki edit on the base WikiOS has moved past goes through the conflict rule: saved before WikiOS's head, it is
 * kept as an overwritten revision with one conflict row, nothing pushed back for it, and its editor told on their talk
 * page by the same cycle; the mirror's own edit coming back is WikiOS's echo. A page whose revision cannot be read
 * holds its later revisions and the mark back while other pages sync, and the health telemetry says so. Each case of
 * the rule (older, later, earlier, same second, a deleted page, the webhook, the mirror's edits, the settling) runs in
 * both WikiOS modes.
 *
 * Real auto-sync cycle, inbound decision and log events, importer, ArticleRepository, mirror worker, queue, revision
 * import and bot login run over the in-memory WikiOS tables (Prisma mode) and a MediaWiki that keeps state
 * (fake-mediawiki-site.ts). MediaWiki's render is a stand-in.
 *
 * Folds:
 * - wikios-health-telemetry.test.ts: after a cycle with a failed page getHealthTelemetry is DEGRADED and carries the
 *   stored status; after a clean cycle ACTIVE; when the status row cannot be read UNKNOWN, never ACTIVE.
 * - auto-sync-service.test.ts, the incident regressions the stateful site can play (one row each): a blanking edit is an
 *   empty revision and head; a revision never sorts before the head it builds on; a claimed name's edit is credited
 *   to its account (a logged claim tag); the mirror account's edit is WikiOS's own whatever its text; an overwritten
 *   edit's claimed editor is told with the diff link; a page MediaWiki creates anew comes back; a title MediaWiki would
 *   refuse is skipped; a redirect's target and section are stored, and cleared; the webhook's single-page sync imports,
 *   leaves a collision to the cycle, and never throws when MediaWiki is down; a page with text but no revision row is
 *   never overwritten: its text is captured first, an earlier edit on another base kept as overwritten.
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

import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { runAutoSyncCycle, syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";
import { syncLatestRevision, syncRevisionById } from "~/lib/wiki-os/services/inbound-revision-sync";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
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
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const telemetry = () =>
  createCallerFactory(wikiosUtilitiesRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  ).getHealthTelemetry();

const article = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const revisionsOf = (title: string) =>
  tables.wikiRevision.rows.filter((row) => row.articleId === article(title)?.id);
/** The page's head: its newest revision that is not parked. */
const headOf = (title: string) =>
  revisionsOf(title)
    .filter((row) => !row.parked)
    .at(-1)!;
const jobs = () => tables.wikiMirrorJob.rows.map((job) => `${job.kind} ${job.title} ${job.state}`);
const notices = () =>
  jest
    .mocked(notificationAPI.createMany)
    .mock.calls.flatMap(([inputs]) =>
      inputs.map((input) => `${input.userId} ${(input.metadata as { kind: string }).kind}`)
    );
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
/** The page's head as WikiOS reads it: its newest live revision by time. */
const liveHead = (title: string) =>
  revisionsOf(title)
    .filter((row) => !row.parked)
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .at(-1)!;
const revisionRow = (id: string) => tables.wikiRevision.rows.find((row) => row.id === id)!;
const conflictsOf = (title: string) =>
  tables.wikiConflict.rows.filter((row) => row.title === title);
/** The refs a conflict row lists as overwritten, oldest first. */
const overwrittenRefs = (row: Record<string, unknown>) =>
  (row.overwritten as Array<{ ref: string }>).map((change) => change.ref);

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
  tables.user.seed({ id: "db-watcher", clerkUserId: "clerk-watcher" });
  for (const [title, revision] of [
    ["Caphiria", founded],
    ["Old page", old],
  ] as const) {
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
  it("syncs MediaWiki's edits and deletions in, mirrors WikiOS's edits out, and keeps an earlier conflicting edit as overwritten, once", async () => {
    // the country and geo intros read the page through the bridge, which keeps what it read for 30 minutes
    await expect(getArticleIntro("Caphiria")).resolves.toMatchObject({
      text: "Caphiria is a kingdom.",
    });

    // 1. on MediaWiki: Alice edits Caphiria, an administrator deletes Old page
    const alice = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    site.deletePage("Admin", "Old page");

    await runAutoSyncCycle();
    await settle();

    // fast-forward: Alice's revision is WikiOS's head, stamped with MediaWiki's id; the page is stale and re-rendered
    expect(article("Caphiria")).toMatchObject({
      wikitext: "Caphiria is an empire.",
      mwLatestRevId: alice.revid,
    });
    expect(headOf("Caphiria")).toMatchObject({
      mwRevId: alice.revid,
      author: "Alice",
      parked: false,
    });
    expect(article("Old page")?.status).toBe("ARCHIVED");
    expect(notices()).toEqual(["clerk-watcher edited"]);
    // the reader's view is rendered from the new text
    expect(jest.mocked(renderArticleViaMediaWiki).mock.calls.map(([text]) => text)).toContain(
      "Caphiria is an empire."
    );
    expect(article("Caphiria")?.htmlSyncedAt).toBeInstanceOf(Date);
    expect((await telemetry()).inboundSyncStatus).toBe("ACTIVE");
    expect(jobs()).toEqual([]); // nothing of MediaWiki's goes back to MediaWiki
    // the fast-forward evicted the page from the bridge: its intro is Alice's text
    expect((await getArticleIntro("Caphiria"))?.text).toBe("Caphiria is an empire.");

    // 2. in WikiOS: a member with no verified wiki account edits Caphiria; the mirror imports it
    const saved = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext: "Caphiria is an empire in Sarpedon.",
        expectedHeadRef: String(alice.revid),
      },
      undefined,
      "  Kir\n Republic "
    );
    expect(jobs()).toEqual(["revision Caphiria pending"]);
    await settle();
    expect((await getArticleIntro("Caphiria"))?.text).toBe("Caphiria is an empire in Sarpedon.");

    const first = await runMirrorCycle();
    expect(first).toMatchObject({ done: 1, failed: 0 });
    const imported = site.pages
      .get("Caphiria")!
      .revisions.find((r) => r.text === "Caphiria is an empire in Sarpedon.")!;
    expect(imported.user).toBe("wikios>Kir Republic");
    expect(labelOfImportName(imported.user)).toBe("Kir Republic");
    // stamped with the revision MediaWiki shows as current (the import's null revision holds the same text)
    const mwHead = site.current("Caphiria")!;
    expect(mwHead.text).toBe("Caphiria is an empire in Sarpedon.");
    expect(tables.wikiRevision.rows.find((row) => row.id === saved.revisionId)?.mwRevId).toBe(
      mwHead.revid
    );
    expect(article("Caphiria")?.mwLatestRevId).toBe(mwHead.revid);
    expect(tables.wikiMirrorJob.rows[0]).toMatchObject({ state: "done", mwRevId: mwHead.revid });
    expect(await runMirrorCycle()).toMatchObject({ done: 0, failed: 0 });
    // the bot logged in with its bot password, and never wrote with an anonymous token
    const logins = site.wiki.requests.filter((request) => request.params.action === "login");
    expect(logins.map((request) => [request.params.lgname, request.params.lgpassword])).toEqual([
      ["WikiOSMirror@wikios", "bot-password"],
    ]);
    expect(
      site.wiki
        .calls()
        .filter((request) => request.method === "POST")
        .map((r) => r.params.token)
    ).not.toContain("+\\");

    // an unattributed save goes out as the community contributor
    await ArticleRepository.saveArticle({
      slug: "Help:Start",
      title: "Help:Start",
      wikitext: "Start here.",
      expectedHeadRef: null,
    });
    await runMirrorCycle();
    expect(site.pages.get("Help:Start")!.revisions[0]!.user).toBe("wikios>Community Contributor");

    // 3. the member edits again, and before the mirror runs Bob saves on MediaWiki's current text: his parent is
    // the revision WikiOS's last edit went out as, not WikiOS's head any more
    jest.mocked(notificationAPI.createMany).mockClear();
    const again = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext: "Caphiria is an empire in Sarpedon and Ixnay.",
        expectedHeadRef: String(mwHead.revid),
      },
      undefined,
      "Kir Republic"
    );
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    // the member's save counts a minute after Bob's: WikiOS's is the later one
    revisionRow(again.revisionId).createdAt = new Date(Date.parse(bob.timestamp) + 60_000);
    // and "Wikios>Kir", a real MediaWiki user (the prefix is lower-case), edits another page: news, not WikiOS's own
    site.editAs("Wikios>Kir", "Ixnay", "Ixnay is a world.");
    expect(labelOfImportName("Wikios>Kir")).toBeNull();
    expect(labelOfImportName("Bob")).toBeNull();

    await runAutoSyncCycle();
    await settle();

    // overwritten: kept in the history, never the head, one conflict row; nothing goes back to MediaWiki for it, and
    // the same cycle tells Bob on his talk page (a WikiOS edit, mirrored like any other)
    const parked = () => revisionsOf("Caphiria").filter((row) => row.parked);
    expect(parked().map((row) => [row.wikitext, row.parkReason])).toEqual([
      ["Caphiria is a republic.", `overwritten:${again.revisionId}`],
    ]);
    expect(liveHead("Caphiria").id).toBe(again.revisionId);
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is an empire in Sarpedon and Ixnay.");
    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[String(bob.revid)]]);
    expect(jobs().filter((job) => job.endsWith("pending"))).toEqual([
      "revision Caphiria pending",
      "revision User talk:Bob pending",
    ]);
    expect(
      tables.wikiMirrorJob.rows.some(
        (job) => job.payload !== null && "restore" in (job.payload as object)
      )
    ).toBe(false);
    expect(article("Ixnay")).toMatchObject({ wikitext: "Ixnay is a world." });
    expect(headOf("Ixnay")).toMatchObject({ author: "Wikios>Kir", parked: false });

    // the mirror: MediaWiki moved on (Bob), so WikiOS's head goes on top as an edit by the mirror account
    await runMirrorCycle();
    expect(site.current("Caphiria")).toMatchObject({
      text: "Caphiria is an empire in Sarpedon and Ixnay.",
      user: "WikiOSMirror",
    });
    expect(jobs().filter((job) => !job.endsWith("done"))).toEqual([]);
    expect(tables.wikiRevision.rows.find((row) => row.id === again.revisionId)?.mwRevId).toBe(
      site.current("Caphiria")!.revid
    );

    // 4. the next cycle sees the mirror's edit come back: WikiOS's own, never judged; nothing parked or pushed again
    const rowsBefore = tables.wikiRevision.rows.length;
    await runAutoSyncCycle();
    expect(parked()).toHaveLength(1);
    expect(liveHead("Caphiria").id).toBe(again.revisionId);
    expect(tables.wikiConflict.rows).toHaveLength(1);
    expect(tables.wikiRevision.rows.length).toBe(rowsBefore); // the head already carries that MediaWiki revision
    expect(jobs().filter((job) => !job.endsWith("done"))).toEqual([]);
    expect((await telemetry()).inboundSyncStatus).toBe("ACTIVE");
  });

  it("holds a page whose revision cannot be read, syncs the others, and reports the cycle DEGRADED", async () => {
    const broken = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    const later = site.editAs("Alice", "Caphiria", "Caphiria is an empire, again.");
    site.editAs("Carol", "Ixnay", "Ixnay is a world.");
    site.failRevision(broken.revid);
    const markBefore = tables.systemConfig.rows.find(
      (row) => row.key === "wikiAutoSync.rcHighWater"
    )?.value;

    await runAutoSyncCycle();

    // the failing page holds its later revision back; the other page syncs; the mark stays before the failure
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a kingdom.");
    expect(revisionsOf("Caphiria").map((row) => row.mwRevId)).not.toContain(later.revid);
    expect(article("Ixnay")?.wikitext).toBe("Ixnay is a world.");
    expect(
      tables.systemConfig.rows.find((row) => row.key === "wikiAutoSync.rcHighWater")?.value
    ).toBe(markBefore);
    const degraded = await telemetry();
    expect(degraded.inboundSyncStatus).toBe("DEGRADED");
    expect(degraded.inboundSync).toMatchObject({
      status: "DEGRADED",
      failures: 1,
      lastError: expect.stringContaining("500"),
    });

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
      inboundSync: { lastRunAt: null, failures: 0, conflictsPending: 0 },
    });
  });

  it("reads MediaWiki's names back as labels only for the import prefix", () => {
    expect(labelOfImportName("wikios>Kir_Republic")).toBe("Kir_Republic");
    expect(labelOfImportName("wikios>  Kir Republic ")).toBe("Kir Republic");
  });
});

describe("inbound incidents, one row each", () => {
  const caphiriaRev = () => site.current("Caphiria")!.revid;
  /** A WikiOS member saves on top of the head before the mirror runs: MediaWiki's next edit is on a base WikiOS left. */
  const saveInWikiOS = (wikitext: string) =>
    ArticleRepository.saveArticle(
      { slug: "Caphiria", title: "Caphiria", wikitext, expectedHeadRef: String(caphiriaRev()) },
      undefined,
      "Kir"
    );

  it("imports a MediaWiki edit that blanks the page as a real, empty revision and an empty head", async () => {
    const blank = site.editAs("Alice", "Caphiria", "");
    await runAutoSyncCycle();
    expect(article("Caphiria")).toMatchObject({ wikitext: "", mwLatestRevId: blank.revid });
    expect(headOf("Caphiria")).toMatchObject({
      mwRevId: blank.revid,
      wikitext: "",
      byteSize: 0,
      textDeleted: false,
    });
  });

  it("never lets a revision sort before the head it builds on (MediaWiki's clock is behind)", async () => {
    const ahead = new Date(Date.now() + 86_400_000);
    headOf("Caphiria").createdAt = ahead;
    const alice = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    await runAutoSyncCycle();
    expect(headOf("Caphiria").mwRevId).toBe(alice.revid);
    expect((headOf("Caphiria").createdAt as Date).getTime()).toBeGreaterThan(ahead.getTime());
  });

  it("credits a revision to the account holding the approved claim of the MediaWiki name, through a logged tag", async () => {
    tables.user.seed({ id: "db-alice", clerkUserId: "clerk-alice", handle: "alice" });
    const claim = tables.wikiNameClaim.insert({
      userId: "db-alice",
      name: "Alice",
      origin: "PLAYER",
      requestedById: "db-alice",
    });
    site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    await runAutoSyncCycle();
    expect(headOf("Caphiria")).toMatchObject({ author: "Alice", authorId: "db-alice" });
    expect(tables.wikiRevisionClaimTag.rows).toEqual([
      expect.objectContaining({
        claimId: claim.id,
        revisionId: headOf("Caphiria").id,
        undoneAt: null,
      }),
    ]);
  });

  it("treats an edit by the mirror account as WikiOS's own whatever its text: recorded, never judged, nothing pushed", async () => {
    const own = site.editAs(site.mirror, "Caphiria", "Text the mirror wrote.");
    await runAutoSyncCycle();
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a kingdom.");
    expect(revisionsOf("Caphiria").find((row) => row.mwRevId === own.revid)).toMatchObject({
      parked: false,
    });
    expect(revisionsOf("Caphiria").filter((row) => row.parked)).toEqual([]);
    expect(jobs()).toEqual([]);
  });

  it("tells an overwritten edit's claimed editor in-app, with the diff of the winner against their edit", async () => {
    tables.user.seed({ id: "db-bob", clerkUserId: "clerk-bob", handle: "bob" });
    tables.wikiNameClaim.seed({
      userId: "db-bob",
      name: "Bob",
      origin: "PLAYER",
      requestedById: "db-bob",
    });
    const saved = await saveInWikiOS("Caphiria is an empire in Sarpedon.");
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runAutoSyncCycle();
    expect(
      revisionsOf("Caphiria")
        .filter((row) => row.parked)
        .map((row) => row.mwRevId)
    ).toEqual([bob.revid]);
    const [conflict] = conflictsOf("Caphiria");
    expect(jest.mocked(notificationAPI.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "clerk-bob",
        href: `/wiki/Caphiria?diff=${saved.revisionId}&oldid=${bob.revid}&conflict=${conflict!.id}`,
      })
    );
  });

  it("brings a page WikiOS deleted back when MediaWiki creates it anew", async () => {
    site.deletePage("Admin", "Old page");
    await runAutoSyncCycle();
    expect(article("Old page")?.status).toBe("ARCHIVED");
    const anew = site.editAs("Alice", "Old page", "A new old page.");
    await runAutoSyncCycle();
    expect(article("Old page")).toMatchObject({
      status: "PUBLISHED",
      wikitext: "A new old page.",
      mwLatestRevId: anew.revid,
    });
  });

  it("skips a change whose title MediaWiki itself would refuse, and syncs the rest", async () => {
    site.editAs("Alice", "Bad|title", "x");
    site.editAs("Carol", "Ixnay", "Ixnay is a world.");
    await runAutoSyncCycle();
    expect(article("Bad|title")).toBeUndefined();
    expect(article("Ixnay")?.wikitext).toBe("Ixnay is a world.");
    expect((await telemetry()).inboundSyncStatus).toBe("ACTIVE");
  });

  it("stores a synced redirect's canonical target and section, and clears them when the page stops redirecting", async () => {
    site.editAs("Alice", "Caphirian history", "#REDIRECT [[caphiria#History]]");
    await runAutoSyncCycle();
    expect(article("Caphirian history")).toMatchObject({
      redirectTargetSlug: "Caphiria",
      redirectTargetFragment: "History",
    });
    site.editAs("Alice", "Caphirian history", "Now an article of its own.");
    await runAutoSyncCycle();
    expect(article("Caphirian history")).toMatchObject({
      redirectTargetSlug: null,
      redirectTargetFragment: null,
    });
  });

  it("the webhook's single-page sync imports a new page, leaves a conflict to the cycle, and never throws", async () => {
    const carol = site.editAs("Carol", "Ixnay", "Ixnay is a world.");
    await expect(syncSinglePage("Ixnay")).resolves.toBe(true);
    expect(headOf("Ixnay")).toMatchObject({ mwRevId: carol.revid });

    await saveInWikiOS("Caphiria is an empire in Sarpedon.");
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await expect(syncSinglePage("Caphiria")).resolves.toBe(false);
    expect(revisionsOf("Caphiria").filter((row) => row.parked)).toEqual([]);

    global.fetch = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED")) as never;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(syncSinglePage("Ixnay")).resolves.toBe(false);
  });

  it("never overwrites a page that has text but no revision row: its text is captured first, an earlier edit on another base kept as overwritten", async () => {
    const synced = site.editAs("Founder", "Legacy", "Legacy text.");
    site.editAs("Founder", "Other", "MediaWiki's text.");
    tables.wikiArticle.insert({
      title: "Legacy",
      slug: "legacy",
      wikitext: "Legacy text.",
      mwPageId: site.pages.get("Legacy")!.pageid,
      mwLatestRevId: synced.revid,
    });
    tables.wikiArticle.insert({
      title: "Other",
      slug: "other",
      wikitext: "WikiOS's own text.",
      mwPageId: site.pages.get("Other")!.pageid,
      mwLatestRevId: null,
    });
    site.editAs("Alice", "Legacy", "Legacy, edited.");
    site.editAs("Alice", "Other", "MediaWiki's text, edited.");

    await runAutoSyncCycle();

    // the edit on the revision the page came from goes on top of a revision that holds the page's old text
    expect(revisionsOf("Legacy").map((row) => [row.wikitext, row.parked])).toEqual([
      ["Legacy text.", false],
      ["Legacy, edited.", false],
    ]);
    expect(article("Legacy")?.wikitext).toBe("Legacy, edited.");
    // MediaWiki's revisions of a page whose text WikiOS never had from them, saved before it, are overwritten by the
    // captured text, which stays the page's: one conflict row lists both
    expect(revisionsOf("Other").map((row) => [row.wikitext, row.parked])).toEqual([
      ["WikiOS's own text.", false],
      ["MediaWiki's text.", true],
      ["MediaWiki's text, edited.", true],
    ]);
    expect(article("Other")?.wikitext).toBe("WikiOS's own text.");
    expect(conflictsOf("Other").map(overwrittenRefs)).toHaveLength(1);
  });
});

describe.each(WIKIOS_MODES)("inbound revisions through the conflict rule [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  /** The site's clock: its last write. */
  const siteTime = () => Date.parse(site.now());
  /** A WikiOS save of Caphiria on WikiOS's head (not mirrored), counting at `at` when given. */
  const saveOnHead = async (wikitext: string, at?: Date, authorId?: string) => {
    const saved = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext,
        expectedHeadRef: toRevisionRef(
          liveHead("Caphiria") as { id: string; mwRevId: number | null }
        ),
      },
      authorId,
      "Kir"
    );
    if (at) revisionRow(saved.revisionId).createdAt = at;
    return saved;
  };
  const revisionOf = (mwRevId: number) =>
    tables.wikiRevision.rows.find((row) => row.mwRevId === mwRevId);

  it("never applies an older revision over a newer head: R1 replayed after R2 is history, the head stays R2, no conflict row", async () => {
    const r1 = site.editAs("Alice", "Caphiria", "Caphiria is an empire.");
    const r2 = site.editAs("Alice", "Caphiria", "Caphiria is a great empire.");
    // R2 came in first (the webhook): it is WikiOS's head, stamped
    const caphiria = article("Caphiria")!;
    tables.wikiRevision.insert({
      articleId: caphiria.id,
      wikitext: r2.text,
      byteSize: r2.text.length,
      mwRevId: r2.revid,
      sha1: mwSha1Base36(r2.text),
      author: "Alice",
      origin: "classic",
      createdAt: new Date(r2.timestamp),
    });
    caphiria.wikitext = r2.text;
    caphiria.mwLatestRevId = r2.revid;

    await expect(syncRevisionById(r1.revid)).resolves.toBe("older");
    await runAutoSyncCycle();

    expect(liveHead("Caphiria").mwRevId).toBe(r2.revid);
    expect(article("Caphiria")).toMatchObject({ wikitext: r2.text, mwLatestRevId: r2.revid });
    expect(revisionOf(r1.revid)).toMatchObject({
      parked: false,
      wikitext: r1.text,
      createdAt: new Date(r1.timestamp),
    });
    expect(tables.wikiConflict.rows).toEqual([]);
    expect(jobs()).toEqual([]);
  });

  it("a classic edit later than WikiOS's unmirrored head from the same base becomes the head; one conflict row lists the WikiOS revisions; no mirror job is enqueued", async () => {
    const first = await saveOnHead("Caphiria is an empire.", new Date(siteTime() - 120_000));
    const second = await saveOnHead(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000)
    );
    const jobsBefore = jobs();
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await expect(syncRevisionById(bob.revid)).resolves.toBe("won");

    expect(liveHead("Caphiria")).toMatchObject({ mwRevId: bob.revid, parked: false });
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a republic.");
    const conflicts = conflictsOf("Caphiria");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      source: "ixwiki",
      articleId: article("Caphiria")!.id,
      winnerSide: "classic",
      winnerRef: String(bob.revid),
    });
    expect(overwrittenRefs(conflicts[0]!)).toEqual([first.revisionId, second.revisionId]);
    // the WikiOS revisions stay in the history; nothing is queued for MediaWiki by the import
    expect(revisionRow(first.revisionId).parked).toBe(false);
    expect(revisionRow(second.revisionId).parked).toBe(false);
    expect(jobs()).toEqual(jobsBefore);
  });

  it("a classic edit earlier than WikiOS's head is kept as an overwritten revision; one row; the head is unchanged; no job", async () => {
    // WikiOS saves now; the site's clock is an hour behind
    const saved = await saveOnHead("Caphiria is an empire in Sarpedon.");
    const jobsBefore = jobs();
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await expect(syncRevisionById(bob.revid)).resolves.toBe("overwritten");
    // only a classic restore brings an overwritten revision back: the webhook's read of classic's latest does not,
    // nor does a restore whose revision WikiOS's later head still stands over
    await expect(syncLatestRevision("Caphiria")).resolves.toBe("known");
    await expect(syncLatestRevision("Caphiria", { effectiveAt: new Date() })).resolves.toBe(
      "known"
    );

    expect(revisionOf(bob.revid)).toMatchObject({
      parked: true,
      parkReason: `overwritten:${saved.revisionId}`,
      wikitext: "Caphiria is a republic.",
    });
    expect(liveHead("Caphiria").id).toBe(saved.revisionId);
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is an empire in Sarpedon.");
    const conflicts = conflictsOf("Caphiria");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ winnerSide: "wikios", winnerRef: saved.revisionId });
    expect(overwrittenRefs(conflicts[0]!)).toEqual([String(bob.revid)]);
    expect(jobs()).toEqual(jobsBefore);

    // dated with the head (a restore of a revision as new as it): live again, and the page's text follows
    revisionRow(revisionOf(bob.revid)!.id).createdAt = revisionRow(saved.revisionId).createdAt;
    await expect(syncLatestRevision("Caphiria")).resolves.toBe("known");
    expect(revisionOf(bob.revid)).toMatchObject({ parked: true });
    await expect(syncLatestRevision("Caphiria", { effectiveAt: new Date() })).resolves.toBe(
      "known"
    );
    expect(revisionOf(bob.revid)).toMatchObject({ parked: false, parkReason: null });
  });

  it("a WikiOS revision the mirror stamped with a higher id than a later classic edit from the same base still collides: the classic edit wins, one row, the WikiOS author told", async () => {
    tables.user.seed({ id: "db-kir", clerkUserId: "clerk-kir", handle: "kir" });
    const w1 = await saveOnHead(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000),
      "db-kir"
    );
    const c = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    // the mirror's Special:Import gave W1 a newer MediaWiki id than C, with W1's older time
    revisionRow(w1.revisionId).mwRevId = c.revid + 50;

    await runAutoSyncCycle();

    expect(liveHead("Caphiria").wikitext).toBe("Caphiria is a republic.");
    expect(revisionOf(c.revid)?.parked).toBe(false);
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerRef: String(c.revid) }),
    ]);
    // a WikiOS save keeps its row id as its ref once stamped: the mirror and the cycle name it alike
    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[w1.revisionId]]);
    expect(jest.mocked(notificationAPI.create)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk-kir", source: "wikiConflict" })
    );
  });

  it("an older revision of a page with text but no revision row keeps that text as a baseline head", async () => {
    const r1 = site.editAs("Founder", "Legacy", "Legacy, first.");
    const r2 = site.editAs("Founder", "Legacy", "Legacy, second.");
    tables.wikiArticle.insert({
      title: "Legacy",
      slug: "legacy",
      wikitext: r2.text,
      mwPageId: site.pages.get("Legacy")!.pageid,
      mwLatestRevId: r2.revid,
    });

    await expect(syncRevisionById(r1.revid)).resolves.toBe("older");

    expect(revisionsOf("Legacy").map((row) => [row.wikitext, row.parked ?? false])).toEqual([
      [r2.text, false],
      [r1.text, false],
    ]);
    expect(liveHead("Legacy").wikitext).toBe(r2.text);
    expect(article("Legacy")?.wikitext).toBe(r2.text);
    expect(tables.wikiConflict.rows).toEqual([]);
  });

  it("a classic edit whose import fails records no conflict and tells nobody; the next cycle judges it again", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    tables.user.seed({ id: "db-kir", clerkUserId: "clerk-kir", handle: "kir" });
    await saveOnHead("Caphiria is an empire in Sarpedon.", new Date(siteTime() - 60_000), "db-kir");
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    const importSpy = jest
      .spyOn(ArticleRepository, "importPageRevisions")
      .mockRejectedValueOnce(new Error("lock timeout"));

    await runAutoSyncCycle();

    expect(tables.wikiConflict.rows).toEqual([]);
    expect(jest.mocked(notificationAPI.create)).not.toHaveBeenCalled();
    expect(revisionOf(bob.revid)).toBeUndefined();

    await runAutoSyncCycle();

    // Bob's edit is the page's text now (the settling's trail revision copies it on top)
    expect(revisionOf(bob.revid)?.parked).toBe(false);
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a republic.");
    expect(conflictsOf("Caphiria")).toHaveLength(1);
    expect(jest.mocked(notificationAPI.create)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk-kir" })
    );
    importSpy.mockRestore();
  });

  it("a WikiOS save that lands before the import's lock leaves the classic edit to the next cycle, which tells its author", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const w1 = await saveOnHead("Caphiria is an empire.", new Date(siteTime() - 60_000));
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    const realImport = ArticleRepository.importPageRevisions;
    let w2Id = "";
    const importSpy = jest
      .spyOn(ArticleRepository, "importPageRevisions")
      .mockImplementationOnce(async (input) => {
        // a WikiOS member saves between the cycle's read of the head and the import's page lock
        const w2 = await ArticleRepository.saveArticle(
          {
            slug: "Caphiria",
            title: "Caphiria",
            wikitext: "Caphiria is an empire in Sarpedon.",
            expectedHeadRef: w1.revisionId,
          },
          undefined,
          "Kir"
        );
        w2Id = w2.revisionId;
        return realImport(input);
      });

    await runAutoSyncCycle();

    expect(tables.wikiConflict.rows).toEqual([]);
    expect(revisionOf(bob.revid)).toBeUndefined();
    expect(liveHead("Caphiria").id).toBe(w2Id);

    await runAutoSyncCycle();

    expect(revisionOf(bob.revid)).toMatchObject({
      parked: true,
      parkReason: `overwritten:${w2Id}`,
    });
    const [conflict] = conflictsOf("Caphiria");
    expect(conflict).toMatchObject({ winnerSide: "wikios", winnerRef: w2Id });
    expect(conflict?.notified).toEqual([
      expect.objectContaining({ key: "name:Bob", channel: "talk-page" }),
    ]);
    importSpy.mockRestore();
  });

  it("a same-second classic edit wins", async () => {
    const saved = await saveOnHead("Caphiria is an empire in Sarpedon.");
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    // WikiOS saved in Bob's second, later by the milliseconds
    revisionRow(saved.revisionId).createdAt = new Date(Date.parse(bob.timestamp) + 900);

    await expect(syncRevisionById(bob.revid)).resolves.toBe("won");

    expect(liveHead("Caphiria").mwRevId).toBe(bob.revid);
    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[saved.revisionId]]);
  });

  it("with the editing switch on and v1 off a WikiOS edit is never silently overwritten", async () => {
    tables.user.seed({ id: "db-kir", clerkUserId: "clerk-kir", handle: "kir" });
    const saved = await saveOnHead(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000),
      "db-kir"
    );
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await runAutoSyncCycle();

    // Bob's later edit is the head, and Kir's revision is kept, listed and its author told
    expect(liveHead("Caphiria").wikitext).toBe("Caphiria is a republic.");
    expect(revisionOf(bob.revid)?.parked).toBe(false);
    expect(revisionRow(saved.revisionId)).toMatchObject({ parked: false });
    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[saved.revisionId]]);
    expect(jest.mocked(notificationAPI.create)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk-kir", source: "wikiConflict" })
    );
  });

  it("an edit of a page WikiOS deleted earlier brings it back; one made before the delete is overwritten", async () => {
    // Old page: deleted in WikiOS a minute before Alice's edit (the delete not mirrored yet)
    const old = article("Old page")!;
    old.status = "ARCHIVED";
    const removal = tables.wikiLog.insert({
      articleId: old.id,
      logType: "delete",
      action: "delete",
      title: "Old page",
      actorName: "Remover",
      userId: null,
      mwLogId: null,
      createdAt: new Date(siteTime() - 60_000),
    });
    const after = site.editAs("Alice", "Old page", "An old page, kept.");

    await expect(syncRevisionById(after.revid)).resolves.toBe("won");

    expect(article("Old page")).toMatchObject({
      status: "PUBLISHED",
      wikitext: "An old page, kept.",
    });
    expect(conflictsOf("Old page")).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerRef: String(after.revid) }),
    ]);
    expect(conflictsOf("Old page").map(overwrittenRefs)).toEqual([[`log:${removal.id}`]]);

    // Caphiria: Bob edits, then WikiOS deletes the page (now, after the site's clock)
    const caphiria = article("Caphiria")!;
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    caphiria.status = "ARCHIVED";
    const deletion = tables.wikiLog.insert({
      articleId: caphiria.id,
      logType: "delete",
      action: "delete",
      title: "Caphiria",
      actorName: "Remover",
      userId: null,
      mwLogId: null,
      createdAt: new Date(),
    });

    await expect(syncRevisionById(bob.revid)).resolves.toBe("overwritten");

    expect(revisionOf(bob.revid)).toMatchObject({
      parked: true,
      parkReason: `overwritten:log:${deletion.id}`,
    });
    expect(article("Caphiria")).toMatchObject({
      status: "ARCHIVED",
      wikitext: "Caphiria is a kingdom.",
    });
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({
        winnerSide: "wikios",
        winnerAction: "delete",
        winnerRef: `log:${deletion.id}`,
      }),
    ]);
    expect(jobs()).toEqual([]);
  });

  it("the webhook still defers a collision to the cycle", async () => {
    await saveOnHead("Caphiria is an empire in Sarpedon.");
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await expect(syncSinglePage("Caphiria")).resolves.toBe(false);

    expect(revisionOf(bob.revid)).toBeUndefined();
    expect(tables.wikiConflict.rows).toEqual([]);

    await runAutoSyncCycle();
    expect(revisionOf(bob.revid)?.parked).toBe(true);
    expect(conflictsOf("Caphiria")).toHaveLength(1);
  });

  it("the mirror account's edits stay echoes", async () => {
    const saved = await saveOnHead("Caphiria is an empire in Sarpedon.");
    const own = site.editAs(site.mirror, "Caphiria", "Text the mirror wrote.");

    await expect(syncRevisionById(own.revid)).resolves.toBe("echo");

    expect(liveHead("Caphiria").id).toBe(saved.revisionId);
    expect(revisionOf(own.revid)?.parked).toBe(false);
    expect(tables.wikiConflict.rows).toEqual([]);
  });

  it("a revision brought over by a restore counts at the restore's time", async () => {
    const carol = site.editAs("Carol", "Ixnay", "Ixnay is a world.");
    const restoredAt = new Date(Date.parse(carol.timestamp) + 3_600_000);

    await expect(syncLatestRevision("Ixnay", { effectiveAt: restoredAt })).resolves.toBe(
      "fast-forward"
    );

    expect(liveHead("Ixnay")).toMatchObject({ mwRevId: carol.revid, createdAt: restoredAt });
  });

  it("a restored revision that collides with WikiOS's head is judged by the cycle at the restore's time", async () => {
    const restored = site.editAs("Dana", "Caphiria", "Caphiria is a republic.");
    // WikiOS saved after the classic edit, but before the restore that brought it back
    await saveOnHead(
      "Caphiria is an empire in Sarpedon.",
      new Date(Date.parse(restored.timestamp) + 60_000)
    );
    const restoredAt = new Date(Date.parse(restored.timestamp) + 3_600_000);

    await expect(
      syncLatestRevision("Caphiria", { effectiveAt: restoredAt, judgeCollisions: true })
    ).resolves.toBe("won");

    expect(liveHead("Caphiria")).toMatchObject({ mwRevId: restored.revid, createdAt: restoredAt });
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerRef: String(restored.revid), winnerAt: restoredAt }),
    ]);
  });

  it("a classic delete that wins over an unmirrored WikiOS edit, then a classic restore: the page's text and render are MediaWiki's revision, never the loser's", async () => {
    const kingdom = site.current("Caphiria")!;
    const lost = await saveOnHead(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000)
    );
    site.deletePage("Admin", "Caphiria");

    await runAutoSyncCycle();

    expect(revisionRow(lost.revisionId)).toMatchObject({ parked: true });
    expect(article("Caphiria")).toMatchObject({ status: "ARCHIVED", wikitext: kingdom.text });

    site.restorePage("Admin", "Caphiria");
    jest.mocked(renderArticleViaMediaWiki).mockClear();
    // the restored revision is one WikiOS has: it comes back "known", nothing is imported
    await runAutoSyncCycle();
    await settle();

    expect(article("Caphiria")).toMatchObject({ status: "PUBLISHED", wikitext: kingdom.text });
    expect(liveHead("Caphiria").mwRevId).toBe(kingdom.revid);
    const rendered = jest.mocked(renderArticleViaMediaWiki).mock.calls.map(([text]) => text);
    expect(rendered).toContain(kingdom.text);
    expect(rendered).not.toContain("Caphiria is an empire in Sarpedon.");
  });

  it("a deleted page whose text is an overwritten revision's renders its live head once restored, from classic or in WikiOS", async () => {
    /** The page as an older delete left it: archived, its text a parked loser's. */
    const leaveStale = (title: string) => {
      const row = article(title)!;
      tables.wikiRevision.insert({
        articleId: row.id,
        wikitext: "Lost text.",
        author: "Kir",
        parked: true,
        parkReason: "overwritten:mwlog:1",
        createdAt: new Date("2026-10-01"),
      });
      Object.assign(row, { status: "ARCHIVED", wikitext: "Lost text." });
    };
    leaveStale("Caphiria");
    leaveStale("Old page");
    site.deletePage("Admin", "Old page");
    site.restorePage("Admin", "Old page");
    jest.mocked(renderArticleViaMediaWiki).mockClear();

    await runAutoSyncCycle();
    await PageManagementService.restoreArticle("Caphiria", {
      userId: "db-watcher",
      name: "Watcher",
    });
    await settle();

    expect(article("Old page")).toMatchObject({ status: "PUBLISHED", wikitext: "An old page." });
    expect(article("Caphiria")).toMatchObject({
      status: "PUBLISHED",
      wikitext: "Caphiria is a kingdom.",
    });
    const rendered = jest.mocked(renderArticleViaMediaWiki).mock.calls.map(([text]) => text);
    expect(rendered).not.toContain("Lost text.");
  });

  it("the cycle settles conflicts after its steps", async () => {
    await saveOnHead("Caphiria is an empire in Sarpedon.");
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await runAutoSyncCycle();

    const [conflict] = conflictsOf("Caphiria");
    expect(conflict?.settledAt).toBeInstanceOf(Date);
    expect(conflict?.notified).toEqual([
      expect.objectContaining({ key: "name:Bob", channel: "talk-page" }),
    ]);
    expect(article("User talk:Bob")?.wikitext).toContain(
      "== Your edit to [[Caphiria]] was replaced =="
    );
    expect(jobs()).toContain("revision User talk:Bob pending");
  });
});

describe.each(WIKIOS_MODES)("outbound revisions through the conflict rule [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
    tables.user.seed({ id: "db-kir", clerkUserId: "clerk-kir", handle: "kir" });
  });
  afterEach(() => restoreMode());

  /** The site's clock: its last write. */
  const siteTime = () => Date.parse(site.now());
  /** Kir's WikiOS save of Caphiria on WikiOS's head (not mirrored yet), counting at `at` when given. */
  const kirSaves = async (wikitext: string, at?: Date) => {
    const saved = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext,
        expectedHeadRef: toRevisionRef(
          liveHead("Caphiria") as { id: string; mwRevId: number | null }
        ),
      },
      "db-kir",
      "Kir"
    );
    if (at) revisionRow(saved.revisionId).createdAt = at;
    return saved;
  };
  const siteRevisions = (title = "Caphiria") => site.pages.get(title)?.revisions ?? [];
  const sentEdits = () => site.wiki.calls().filter((request) => request.params.action === "edit");
  const caphiriaJob = () =>
    tables.wikiMirrorJob.rows.find((job) => job.title === "Caphiria" && job.kind === "revision")!;
  /** History lines that carry a trail: WikiOS's revisions of Caphiria, and MediaWiki's. */
  const trailLines = () => ({
    wikios: revisionsOf("Caphiria").filter((row) => String(row.summary ?? "").includes("Overwrote"))
      .length,
    classic: siteRevisions().filter((revision) => revision.comment.includes("Overwrote")).length,
  });
  const revisionOfMw = (mwRevId: number) =>
    tables.wikiRevision.rows.find((row) => row.mwRevId === mwRevId);
  const bobNotices = (row: Record<string, unknown>) =>
    (row.notified as Array<{ key: string; channel: string }>).filter(
      (mark) => mark.key === "name:Bob"
    );

  it("a WikiOS revision later than classic's current from the same base is imported as current, with the trail in its summary on both wikis; one row", async () => {
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    // Kir saves now: the site's clock is an hour behind, so Kir's save is the later one
    const saved = await kirSaves("Caphiria is an empire in Sarpedon.");

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });

    expect(site.current("Caphiria")?.text).toBe("Caphiria is an empire in Sarpedon.");
    const [conflict] = conflictsOf("Caphiria");
    expect(conflictsOf("Caphiria")).toHaveLength(1);
    expect(conflict).toMatchObject({ winnerSide: "wikios", winnerRef: saved.revisionId });
    expect(overwrittenRefs(conflict!)).toEqual([String(bob.revid)]);
    const trail = `Overwrote revision ${bob.revid} by Bob, saved from the same version (conflict ${conflict!.id})`;
    expect(revisionRow(saved.revisionId).summary).toContain(trail);
    const imported = siteRevisions().find((r) => r.text === "Caphiria is an empire in Sarpedon.")!;
    expect(imported.comment).toContain(trail);
    expect(trailLines()).toEqual({ wikios: 1, classic: 1 });
    expect(sentEdits()).toEqual([]);
    expect(revisionRow(saved.revisionId).mwRevId).toBe(site.current("Caphiria")!.revid);
  });

  it("a page both wikis created on their own has no base: only classic's current revision is listed overwritten", async () => {
    site.editAs("Carol", "Ixnay", "Ixnay is a world.");
    const dana = site.editAs("Dana", "Ixnay", "Ixnay is a planet.");
    const created = await ArticleRepository.saveArticle(
      {
        slug: "Ixnay",
        title: "Ixnay",
        wikitext: "Ixnay is a world of empires.",
        expectedHeadRef: null,
      },
      "db-kir",
      "Kir"
    );

    await runMirrorCycle();

    expect(conflictsOf("Ixnay")).toEqual([
      expect.objectContaining({
        winnerSide: "wikios",
        winnerRef: created.revisionId,
        baseRef: null,
      }),
    ]);
    expect(conflictsOf("Ixnay").map(overwrittenRefs)).toEqual([[String(dana.revid)]]);
    expect(site.current("Ixnay")?.text).toBe("Ixnay is a world of empires.");
  });

  it("a WikiOS revision earlier than classic's current is imported as history only: no action=edit is sent, the job notes it lost, one row names its author", async () => {
    const saved = await kirSaves(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000)
    );
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });

    expect(site.current("Caphiria")?.text).toBe("Caphiria is a republic.");
    expect(sentEdits()).toEqual([]);
    const imported = siteRevisions().find((r) => r.text === "Caphiria is an empire in Sarpedon.");
    expect(imported?.user).toBe("wikios>Kir");
    expect(caphiriaJob()).toMatchObject({ state: "done" });
    expect(caphiriaJob().payload).toEqual({
      note: `Lost to MediaWiki revision ${bob.revid} (saved later); imported as history`,
    });
    // stamped with its own place in MediaWiki's history; the page's latest revision is still classic's
    expect(revisionRow(saved.revisionId).mwRevId).toBe(imported?.revid);
    expect(article("Caphiria")?.mwLatestRevId).not.toBe(imported?.revid);
    const conflicts = conflictsOf("Caphiria");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ winnerSide: "classic", winnerRef: String(bob.revid) });
    expect(conflicts[0]!.overwritten).toEqual([
      expect.objectContaining({
        side: "wikios",
        ref: saved.revisionId,
        author: expect.objectContaining({ userId: "db-kir", label: "Kir" }),
      }),
    ]);
    expect(trailLines()).toEqual({ wikios: 0, classic: 0 });
  });

  it("a job queued before a classic edit and run after it still loses by save time", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const saved = await kirSaves(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000)
    );
    // the first attempt's import fails; Bob edits while the job waits out its backoff
    global.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
      init?.body instanceof FormData
        ? new Response("Down.", { status: 503 })
        : site.fetch(input, init)) as never;
    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 0, failed: 1 });
    global.fetch = site.fetch as never;
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    caphiriaJob().nextAttemptAt = new Date(Date.now() - 1);

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });

    expect(site.current("Caphiria")?.text).toBe("Caphiria is a republic.");
    expect(sentEdits()).toEqual([]);
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerRef: String(bob.revid) }),
    ]);

    // the cycle brings Bob's edit over as the head (the settling's trail copies it on top): the same row, Kir told once
    await runAutoSyncCycle();
    expect(revisionOfMw(bob.revid)?.parked).toBe(false);
    expect(liveHead("Caphiria").wikitext).toBe("Caphiria is a republic.");
    expect(revisionRow(saved.revisionId).parked).toBe(false);
    expect(conflictsOf("Caphiria")).toHaveLength(1);
    expect(
      jest
        .mocked(notificationAPI.create)
        .mock.calls.filter(([input]) => input.userId === "clerk-kir")
    ).toHaveLength(1);
  });

  it("a winner dated before the mirror's own null revision is promoted by one edit; a loser never is", async () => {
    // W1 goes out alone; the import's null revision is dated a second after it
    const w1At = new Date(siteTime() + 10_000);
    await kirSaves("Caphiria is an empire.", w1At);
    await runMirrorCycle();
    const nullRevision = site.current("Caphiria")!;
    expect(nullRevision.user).toBe(site.mirror);
    // W2 was saved before that null revision: imported, it lands under it
    const w2 = await kirSaves("Caphiria is an empire in Sarpedon.", new Date(w1At.getTime() + 500));

    await runMirrorCycle();

    expect(sentEdits()).toHaveLength(1);
    expect(sentEdits()[0]?.params).toMatchObject({ baserevid: expect.any(String), bot: "1" });
    expect(site.current("Caphiria")).toMatchObject({
      text: "Caphiria is an empire in Sarpedon.",
      user: site.mirror,
    });
    expect(revisionRow(w2.revisionId).mwRevId).toBe(site.current("Caphiria")!.revid);
    expect(conflictsOf("Caphiria")).toEqual([]);

    // a loser: Bob's later edit is already WikiOS's head (the cycle ran first), W3 is older than it
    const w3 = await kirSaves("Caphiria is a small empire.", new Date(siteTime() - 60_000));
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runAutoSyncCycle();
    expect(liveHead("Caphiria").mwRevId).toBe(bob.revid);

    await runMirrorCycle();

    expect(sentEdits()).toHaveLength(1);
    expect(site.current("Caphiria")?.text).toBe("Caphiria is a republic.");
    const job = tables.wikiMirrorJob.rows.find((row) => row.revisionId === w3.revisionId)!;
    expect(job).toMatchObject({ state: "done" });
    expect((job.payload as { note: string }).note).toContain(`revision ${bob.revid}`);
  });

  it.each(["mirror first, then cycle", "cycle first, then mirror"])(
    "%s: one row, one notice per author, one trail line",
    async (order) => {
      const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
      const saved = await kirSaves("Caphiria is an empire in Sarpedon.");
      const steps =
        order === "mirror first, then cycle"
          ? [runMirrorCycle, runAutoSyncCycle]
          : [runAutoSyncCycle, runMirrorCycle];

      for (const step of [...steps, ...steps]) await step();

      expect(conflictsOf("Caphiria")).toHaveLength(1);
      const [conflict] = conflictsOf("Caphiria");
      expect(conflict).toMatchObject({ winnerSide: "wikios", winnerRef: saved.revisionId });
      expect(overwrittenRefs(conflict!)).toEqual([String(bob.revid)]);
      expect(bobNotices(conflict!)).toEqual([expect.objectContaining({ channel: "talk-page" })]);
      expect(trailLines()).toEqual({ wikios: 1, classic: 1 });
      expect(site.current("Caphiria")?.text).toBe("Caphiria is an empire in Sarpedon.");
      expect(liveHead("Caphiria").id).toBe(saved.revisionId);
      expect(revisionOfMw(bob.revid)).toMatchObject({
        parked: true,
        parkReason: `overwritten:${saved.revisionId}`,
      });
      expect(sentEdits().filter((edit) => edit.params.title === "Caphiria")).toEqual([]);
    }
  );

  it("a batch that lost still carries the trail of a collision an earlier revision of it won", async () => {
    const c1 = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    const t1 = Date.parse(c1.timestamp);
    // W1, saved after Bob's edit, wins over it in the cycle; W2 follows; then Carol saves on classic after both
    const w1 = await kirSaves("Caphiria is an empire.", new Date(t1 + 1_200));
    await runAutoSyncCycle();
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerRef: w1.revisionId, trailRevisionId: null }),
    ]);
    await kirSaves("Caphiria is an empire in Sarpedon.", new Date(t1 + 1_500));
    site.editAs("Dana", "Ixnay", "Ixnay is a world.");
    site.editAs("Dana", "Ixnay", "Ixnay is a planet.");
    const c2 = site.editAs("Carol", "Caphiria", "Caphiria is a duchy.");

    await runMirrorCycle();

    expect(site.current("Caphiria")?.text).toBe("Caphiria is a duchy.");
    expect(conflictsOf("Caphiria").map((row) => [row.winnerRef, row.trailRevisionId])).toEqual([
      [w1.revisionId, w1.revisionId],
      [String(c2.revid), null],
    ]);
    const trail = `Overwrote revision ${c1.revid} by Bob`;
    expect(revisionRow(w1.revisionId).summary).toContain(trail);
    const imported = siteRevisions().find((r) => r.text === "Caphiria is an empire.");
    expect(imported?.comment).toContain(trail);
    expect(trailLines()).toEqual({ wikios: 1, classic: 1 });
  });

  it("cuts a long summary so MediaWiki keeps the whole trail", async () => {
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    const saved = await kirSaves("Caphiria is an empire in Sarpedon.");
    revisionRow(saved.revisionId).summary = "a".repeat(490);

    await runMirrorCycle();

    const summary = String(revisionRow(saved.revisionId).summary);
    const [conflict] = conflictsOf("Caphiria");
    expect(summary.length).toBeLessThanOrEqual(500);
    expect(summary).toMatch(/^a+; Overwrote revision \d+ by Bob/);
    expect(summary.endsWith(`(conflict ${conflict!.id})`)).toBe(true);
  });

  it("a classic current revision whose time MediaWiki leaves out counts as saved now: WikiOS's earlier save loses", async () => {
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    // saved now, an hour after Bob by the site's clock: it would win against Bob's real time
    await kirSaves("Caphiria is an empire in Sarpedon.", new Date(Date.now() - 5_000));
    global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const response = await site.fetch(input, init);
      if (new URL(String(input)).searchParams.get("rvlimit") !== "1") return response;
      const body = (await response.json()) as {
        query?: { pages?: Array<{ revisions?: Array<{ timestamp?: string }> }> };
      };
      for (const revision of body.query?.pages?.[0]?.revisions ?? []) delete revision.timestamp;
      return new Response(JSON.stringify(body), { status: 200 });
    }) as never;

    await runMirrorCycle();

    expect(conflictsOf("Caphiria")).toEqual([expect.objectContaining({ winnerSide: "classic" })]);
    expect((caphiriaJob().payload as { note: string }).note).toMatch(/^Lost to MediaWiki revision/);
    expect(sentEdits()).toEqual([]);
  });

  it("a later WikiOS revision outside the batch is not listed as lost with it", async () => {
    const w1 = await kirSaves("Caphiria is an empire.", new Date(siteTime() - 60_000));
    const w2 = await kirSaves("Caphiria is an empire in Sarpedon.");
    // W2's job waits out a backoff: the batch is W1 alone
    tables.wikiMirrorJob.rows.find((job) => job.revisionId === w2.revisionId)!.nextAttemptAt =
      new Date(Date.now() + 3_600_000);
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");

    await runMirrorCycle();

    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerRef: String(bob.revid) }),
    ]);
    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[w1.revisionId]]);
  });

  it("behind the mirror's own null revision, a later WikiOS save is judged against the classic edit there: one row, one trail line on each wiki", async () => {
    await kirSaves("Caphiria is an empire.", new Date(siteTime() - 60_000));
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runMirrorCycle(); // W1 lost: imported as history, under the import's null revision by the mirror
    expect(site.current("Caphiria")?.user).toBe(site.mirror);

    // W2 is saved before the cycle brought Bob's edit over, and after it
    const w2 = await kirSaves("Caphiria is an empire in Sarpedon.", new Date(siteTime() + 60_000));
    await runMirrorCycle();

    const won = conflictsOf("Caphiria").filter((row) => row.winnerRef === w2.revisionId);
    expect(won).toHaveLength(1);
    expect(won[0]).toMatchObject({ winnerSide: "wikios" });
    expect(overwrittenRefs(won[0]!)).toEqual([String(bob.revid)]);
    expect(site.current("Caphiria")?.text).toBe("Caphiria is an empire in Sarpedon.");
    expect(trailLines()).toEqual({ wikios: 1, classic: 1 });

    // the cycle then sees Bob's edit: the same row, no second trail on W2
    await runAutoSyncCycle();
    expect(conflictsOf("Caphiria").filter((row) => row.winnerRef === w2.revisionId)).toHaveLength(
      1
    );
    expect(revisionOfMw(bob.revid)).toMatchObject({ parkReason: `overwritten:${w2.revisionId}` });
    expect(String(revisionRow(w2.revisionId).summary).match(/Overwrote/g)).toHaveLength(1);
  });

  it("the mirror's own revisions are never listed as overwritten", async () => {
    await kirSaves("Caphiria is an empire.", new Date(siteTime() - 60_000));
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runMirrorCycle(); // lost: the import's null revision by the mirror is on top
    // a classic edit lands on the mirror's revision, and a later WikiOS revision overwrites it
    const carol = site.editAs("Carol", "Caphiria", "Caphiria is a duchy.");
    const w2 = await kirSaves("Caphiria is a small empire.", new Date(siteTime() + 60_000));

    await runMirrorCycle();

    const won = conflictsOf("Caphiria").find((row) => row.winnerRef === w2.revisionId)!;
    expect(overwrittenRefs(won)).toEqual([String(bob.revid), String(carol.revid)]);
  });

  it("a classic delete later than an unsent WikiOS revision wins, mirror first: nothing is sent, one row, and the cycle archives without a second", async () => {
    const w1 = await kirSaves("Caphiria is an empire in Sarpedon.", new Date(siteTime() - 60_000));
    site.deletePage("Admin", "Caphiria");

    await expect(runMirrorCycle()).resolves.toMatchObject({ done: 1, failed: 0 });

    expect(site.pages.has("Caphiria")).toBe(false);
    expect(site.wiki.calls().filter((request) => request.params.action === "import")).toEqual([]);
    const [conflict] = conflictsOf("Caphiria");
    expect(conflictsOf("Caphiria")).toHaveLength(1);
    expect(conflict).toMatchObject({ winnerSide: "classic", winnerAction: "delete" });
    expect(String(conflict!.winnerRef)).toMatch(/^mwlog:\d+$/);
    expect(overwrittenRefs(conflict!)).toEqual([w1.revisionId]);
    expect(revisionRow(w1.revisionId)).toMatchObject({
      parked: true,
      parkReason: `overwritten:${conflict!.winnerRef}`,
      mwRevId: null,
    });
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a kingdom.");
    expect((caphiriaJob().payload as { note: string }).note).toMatch(
      /^Overwritten before it was sent/
    );

    await runAutoSyncCycle();

    expect(conflictsOf("Caphiria")).toHaveLength(1);
    expect(article("Caphiria")?.status).toBe("ARCHIVED");
    expect(site.pages.has("Caphiria")).toBe(false);
  });

  it("a later WikiOS revision outside the batch is not overwritten by a classic delete between them", async () => {
    const w1 = await kirSaves("Caphiria is an empire.", new Date(siteTime() - 60_000));
    const w2 = await kirSaves("Caphiria is an empire in Sarpedon.");
    tables.wikiMirrorJob.rows.find((job) => job.revisionId === w2.revisionId)!.nextAttemptAt =
      new Date(Date.now() + 3_600_000);
    site.deletePage("Admin", "Caphiria");

    await runMirrorCycle();

    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[w1.revisionId]]);
    expect(revisionRow(w2.revisionId).parked).toBe(false);
  });

  it("creates a page classic never had, whatever else classic deleted since", async () => {
    const fresh = await ArticleRepository.saveArticle(
      { slug: "Fresh", title: "Fresh", wikitext: "A fresh page.", expectedHeadRef: null },
      "db-kir",
      "Kir"
    );
    revisionRow(fresh.revisionId).createdAt = new Date(siteTime() - 60_000);
    site.deletePage("Admin", "Old page");

    await runMirrorCycle();

    expect(site.current("Fresh")?.text).toBe("A fresh page.");
    expect(tables.wikiConflict.rows).toEqual([]);
  });

  it.each(["mirror first, then cycle", "cycle first, then mirror"])(
    "a classic delete in the same second as the WikiOS revision wins, %s: classic stays deleted, WikiOS archived, one row",
    async (order) => {
      site.deletePage("Bob", "Caphiria");
      const deletedAt = Date.parse(site.now());
      const w1 = await kirSaves("Caphiria is an empire in Sarpedon.", new Date(deletedAt + 900));
      const steps =
        order === "mirror first, then cycle"
          ? [runMirrorCycle, runAutoSyncCycle]
          : [runAutoSyncCycle, runMirrorCycle];

      for (const step of steps) await step();

      expect(site.pages.has("Caphiria")).toBe(false);
      expect(site.wiki.calls().filter((request) => request.params.action === "import")).toEqual([]);
      expect(article("Caphiria")?.status).toBe("ARCHIVED");
      expect(revisionRow(w1.revisionId)).toMatchObject({ parked: true });
      expect(conflictsOf("Caphiria")).toEqual([
        expect.objectContaining({ winnerSide: "classic", winnerAction: "delete" }),
      ]);
    }
  );

  it.each(["mirror first, then cycle", "cycle first, then mirror"])(
    "a WikiOS revision saved after classic's delete brings the page back, %s: WikiOS stays live, one row, the deleter told once, one trail line",
    async (order) => {
      site.deletePage("Bob", "Caphiria");
      // Kir saves now: an hour after Bob's delete by the site's clock
      const w1 = await kirSaves("Caphiria is an empire in Sarpedon.");
      const steps =
        order === "mirror first, then cycle"
          ? [runMirrorCycle, runAutoSyncCycle]
          : [runAutoSyncCycle, runMirrorCycle];

      for (const step of [...steps, ...steps]) await step();

      expect(site.current("Caphiria")?.text).toBe("Caphiria is an empire in Sarpedon.");
      expect(article("Caphiria")?.status).toBe("PUBLISHED");
      expect(liveHead("Caphiria").id).toBe(w1.revisionId);
      expect(conflictsOf("Caphiria")).toHaveLength(1);
      const [conflict] = conflictsOf("Caphiria");
      expect(conflict).toMatchObject({ winnerSide: "wikios", winnerRef: w1.revisionId });
      expect(overwrittenRefs(conflict!)).toEqual([expect.stringMatching(/^mwlog:\d+$/)]);
      expect(bobNotices(conflict!)).toEqual([expect.objectContaining({ channel: "talk-page" })]);
      expect(trailLines()).toEqual({ wikios: 1, classic: 1 });
    }
  );

  it("a classic delete meets a WikiOS save the mirror sent in its own second: the delete wins the tie, and its author is told", async () => {
    site.deletePage("Bob", "Caphiria");
    const deletedAt = Date.parse(site.now());
    const w1 = await kirSaves("Caphiria is an empire in Sarpedon.", new Date(deletedAt + 900));
    // sent already: stamped, its job done
    revisionRow(w1.revisionId).mwRevId = 9_000;
    caphiriaJob().state = "done";

    await runAutoSyncCycle();

    expect(article("Caphiria")?.status).toBe("ARCHIVED");
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerAction: "delete" }),
    ]);
    expect(conflictsOf("Caphiria").map(overwrittenRefs)).toEqual([[w1.revisionId]]);
  });

  it("a classic revision WikiOS has is never judged as a WikiOS save against a classic delete", async () => {
    site.deletePage("Bob", "Caphiria");
    const caphiria = article("Caphiria")!;
    tables.wikiRevision.insert({
      articleId: caphiria.id,
      wikitext: "Caphiria is a republic.",
      byteSize: 23,
      mwRevId: 9_001,
      author: "Carol",
      origin: "classic",
      createdAt: new Date(siteTime() + 5_000),
    });

    await runAutoSyncCycle();

    expect(conflictsOf("Caphiria")).toEqual([]);
  });

  it("a save landing between the mirror and the cycle joins the delete's row: one row, one notice, one trail line", async () => {
    site.deletePage("Bob", "Caphiria");
    const w1 = await kirSaves("Caphiria is an empire.");
    await runMirrorCycle(); // W1 wins over Bob's delete and brings the page back
    await kirSaves("Caphiria is an empire in Sarpedon.", new Date(Date.now() + 1_000));

    await runAutoSyncCycle();
    await runMirrorCycle(); // W2's job

    expect(conflictsOf("Caphiria")).toHaveLength(1);
    const [conflict] = conflictsOf("Caphiria");
    expect(conflict).toMatchObject({ winnerSide: "wikios", winnerRef: w1.revisionId });
    expect(bobNotices(conflict!)).toEqual([expect.objectContaining({ channel: "talk-page" })]);
    expect(trailLines()).toEqual({ wikios: 1, classic: 1 });
    expect(article("Caphiria")?.status).toBe("PUBLISHED");
    expect(site.current("Caphiria")?.text).toBe("Caphiria is an empire in Sarpedon.");
  });

  it("a save landing between the mirror and the cycle joins the edit's row: one row, one notice, one trail line", async () => {
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    const w1 = await kirSaves("Caphiria is an empire.");
    await runMirrorCycle(); // W1 is later than Bob's edit: it wins
    await kirSaves("Caphiria is an empire in Sarpedon.", new Date(Date.now() + 1_000));

    await runAutoSyncCycle();
    await runMirrorCycle(); // W2's job

    expect(conflictsOf("Caphiria")).toHaveLength(1);
    const [conflict] = conflictsOf("Caphiria");
    expect(conflict).toMatchObject({ winnerSide: "wikios", winnerRef: w1.revisionId });
    expect(overwrittenRefs(conflict!)).toEqual([String(bob.revid)]);
    expect(bobNotices(conflict!)).toEqual([expect.objectContaining({ channel: "talk-page" })]);
    expect(trailLines()).toEqual({ wikios: 1, classic: 1 });
    expect(revisionOfMw(bob.revid)?.parked).toBe(true);
  });

  it("a system write never brings back a page classic deleted: parked, nothing sent", async () => {
    site.deletePage("Bob", "Caphiria");
    // a settler's write (a talk note, a trail) saved after the delete
    const note = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext: "Caphiria is a kingdom.\n\nA note.",
        expectedHeadRef: toRevisionRef(
          liveHead("Caphiria") as { id: string; mwRevId: number | null }
        ),
      },
      undefined,
      "WikiOS"
    );

    await runMirrorCycle();

    expect(site.pages.has("Caphiria")).toBe(false);
    expect(site.wiki.calls().filter((request) => request.params.action === "import")).toEqual([]);
    expect(revisionRow(note.revisionId)).toMatchObject({ parked: true });
    expect(conflictsOf("Caphiria")).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerAction: "delete" }),
    ]);
  });

  it("a classic delete that beats a person's save parks the system writes sent with it too", async () => {
    const w1 = await kirSaves("Caphiria is an empire.", new Date(siteTime() - 60_000));
    site.deletePage("Bob", "Caphiria");
    const note = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext: "Caphiria is an empire.\n\nA note.",
        expectedHeadRef: w1.revisionId,
      },
      undefined,
      "WikiOS"
    );

    await runMirrorCycle();

    expect(site.pages.has("Caphiria")).toBe(false);
    expect(revisionRow(w1.revisionId)).toMatchObject({ parked: true });
    expect(revisionRow(note.revisionId)).toMatchObject({ parked: true });
  });

  it("names and links an overwritten WikiOS revision MediaWiki has by its MediaWiki id, in the trail and on a claimed name's talk page", async () => {
    tables.wikiNameClaim.seed({
      userId: "db-kir",
      name: "Kir",
      origin: "PLAYER",
      requestedById: "db-kir",
    });
    const w1 = await kirSaves("Caphiria is an empire.", new Date(siteTime() - 60_000));
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runMirrorCycle(); // lost: W1 is stamped with its place in MediaWiki's history
    const stamped = revisionRow(w1.revisionId).mwRevId as number;
    expect(stamped).toEqual(expect.any(Number));

    await runAutoSyncCycle(); // Bob's edit comes over as the winner: the trail and the notices

    const trailRow = revisionsOf("Caphiria").find((row) =>
      String(row.summary ?? "").startsWith("Overwrote")
    );
    expect(trailRow?.summary).toContain(`Overwrote revision ${stamped} by Kir`);
    expect(trailRow?.summary).not.toContain(w1.revisionId);
    expect(article("User talk:Kir")?.wikitext).toContain(
      `[[Special:PermanentLink/${stamped}|revision ${stamped}]]`
    );
  });

  it("a classic delete wins, then that page's queued WikiOS job runs: classic stays deleted and no import is sent", async () => {
    const lost = await kirSaves(
      "Caphiria is an empire in Sarpedon.",
      new Date(siteTime() - 60_000)
    );
    site.deletePage("Admin", "Caphiria");
    await runAutoSyncCycle();
    expect(revisionRow(lost.revisionId)).toMatchObject({ parked: true });

    await expect(runMirrorCycle()).resolves.toMatchObject({ failed: 0 });

    expect(site.pages.has("Caphiria")).toBe(false);
    expect(site.wiki.calls().filter((request) => request.params.action === "import")).toEqual([]);
    expect(caphiriaJob().state).toBe("done");
    expect((caphiriaJob().payload as { note: string }).note).toMatch(
      /^Overwritten before it was sent/
    );
    expect(revisionRow(lost.revisionId).mwRevId).toBeNull();
  });
});
