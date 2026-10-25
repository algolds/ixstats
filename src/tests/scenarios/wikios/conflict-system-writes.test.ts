/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario: WikiOS's own conflict writes (trail dummy edits, talk notes) never win or lose by time, and an old classic
 * delete is no conflict for a page made again since.
 *   - A trail written after a classic editor saved again on classic (an edit WikiOS has not had) is withheld by the
 *     mirror: classic keeps the edit, WikiOS fast-forwards to it, no row and nobody told.
 *   - A trail is written only while the classic winner is the page's head.
 *   - A talk note meets the recipient's own edit of their talk page on classic: no conflict row; the edit becomes the
 *     head, the note stays in the history and is appended again to the new head, once, on both wikis.
 *   - A batch with a person's save and a system write after it is judged by the person's save: lost, the system write
 *     after it is held back, so classic keeps the later classic edit.
 *   - A classic delete WikiOS applied already, or of a page classic never had as WikiOS knows it, records nothing when
 *     a WikiOS save creates the page there again.
 *
 * Real auto-sync cycle, conflict rule, settling, ArticleRepository, mirror worker and revision import over the in-memory
 * WikiOS tables (Prisma mode) and a MediaWiki that keeps state (fake-mediawiki-site.ts), in both WikiOS modes.
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
import { syncRevisionById } from "~/lib/wiki-os/services/inbound-revision-sync";
import { settleConflicts } from "~/lib/wiki-os/services/conflict-notices";
import { CONFLICT_NOTICE_AUTHOR } from "~/lib/wiki-os/services/conflict-sides";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { PageManagementService } from "~/lib/wiki-os/core/page-management-service";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { notificationAPI } from "~/lib/notifications/api";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

type Row = Record<string, unknown>;

const TALK = "User talk:Bob";
const article = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const revisionsOf = (title: string) =>
  tables.wikiRevision.rows.filter((row) => row.articleId === article(title)?.id);
/** The page's head as WikiOS reads it: its newest live revision by time. */
const liveHead = (title: string) =>
  revisionsOf(title)
    .filter((row) => !row.parked)
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .at(-1)!;
const revisionRow = (id: unknown) => tables.wikiRevision.rows.find((row) => row.id === id)!;
const conflictsOf = (title: string) =>
  tables.wikiConflict.rows.filter((row) => row.title === title);
const jobOf = (revisionId: unknown) =>
  tables.wikiMirrorJob.rows.find((job) => job.revisionId === revisionId)!;
const marksOf = (row: Row, key: string) =>
  (row.notified as Array<{ key: string; channel: string }>).filter((mark) => mark.key === key);
/** Revisions of `title` written by WikiOS's own conflict writer. */
const systemWrites = (title: string) =>
  revisionsOf(title).filter((row) => row.author === CONFLICT_NOTICE_AUTHOR && !row.authorId);

const realFetch = global.fetch;
let site: ReturnType<typeof createFakeMediaWikiSite>;

beforeEach(() => {
  fake.reset();
  wikiBridgeCache.clear();
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  site = createFakeMediaWikiSite();
  global.fetch = site.fetch as never;

  // Caphiria as both wikis have it: MediaWiki's revision 100 is WikiOS's head, stamped
  const founded = site.editAs("Founder", "Caphiria", "Caphiria is a kingdom.");
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
  tables.user.seed(
    { id: "db-kir", clerkUserId: "clerk-kir", handle: "kir" },
    { id: "db-ana", clerkUserId: "clerk-ana", handle: "ana" }
  );
  // the marks: every change so far is done
  tables.systemConfig.seed(
    { key: "wikiAutoSync.rcHighWater", value: site.now() },
    { key: "wikiAutoSync.logHighWater", value: site.now() }
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

describe.each(WIKIOS_MODES)("WikiOS's own writes never win or lose by time [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    restoreMode = await seedWikiosMode(fake.db, mode);
  });
  afterEach(() => restoreMode());

  /** The site's clock: its last write. */
  const siteTime = () => Date.parse(site.now());
  /** A WikiOS save of `title` by `userId` on WikiOS's head, counting at `at` when given. */
  const saves = async (title: string, wikitext: string, userId: string, at?: Date) => {
    const head = article(title) ? liveHead(title) : null;
    const saved = await ArticleRepository.saveArticle(
      {
        slug: title.replace(/ /g, "_"),
        title,
        wikitext,
        expectedHeadRef: head
          ? toRevisionRef(head as { id: string; mwRevId: number | null })
          : null,
      },
      userId,
      userId === "db-kir" ? "Kir" : "Ana"
    );
    if (at) revisionRow(saved.revisionId).createdAt = at;
    return saved;
  };
  /** Kir's save of Caphiria an hour before Bob's classic edit wins it on classic: the cycle imports Bob's and settles. */
  const bobWinsCaphiria = async () => {
    const kir = await saves(
      "Caphiria",
      "Caphiria is an empire.",
      "db-kir",
      new Date(siteTime() - 60_000)
    );
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await runMirrorCycle();
    await runAutoSyncCycle();
    return { kir, bob };
  };

  it("a trail written after the classic winner's author saved again on classic is withheld: classic keeps the edit, WikiOS reaches it, no row and nobody told", async () => {
    const { bob } = await bobWinsCaphiria();
    const [won] = conflictsOf("Caphiria");
    expect(won).toMatchObject({ winnerSide: "classic", winnerRef: String(bob.revid) });
    const trail = revisionRow(won!.trailRevisionId);
    expect(trail).toMatchObject({ wikitext: "Caphiria is a republic.", author: "WikiOS" });
    // Bob saves again on classic before the trail's job runs; the trail is dated later than his edit
    const again = site.editAs("Bob", "Caphiria", "Caphiria is a federal republic.");
    jest.mocked(notificationAPI.create).mockClear();

    await runMirrorCycle();

    expect(site.current("Caphiria")?.text).toBe("Caphiria is a federal republic.");
    expect(site.wiki.calls().filter((call) => call.params.action === "import")).toHaveLength(1);
    expect(jobOf(trail.id)).toMatchObject({ state: "done" });
    expect((jobOf(trail.id).payload as { note: string }).note).toContain(
      `met MediaWiki revision ${again.revid}`
    );
    expect(revisionRow(trail.id).mwRevId).toBeNull();

    await runAutoSyncCycle();

    expect(liveHead("Caphiria")).toMatchObject({
      mwRevId: again.revid,
      wikitext: "Caphiria is a federal republic.",
    });
    expect(article("Caphiria")?.wikitext).toBe("Caphiria is a federal republic.");
    expect(conflictsOf("Caphiria")).toHaveLength(1);
    expect(article(TALK)).toBeUndefined();
    expect(notificationAPI.create).not.toHaveBeenCalled();
    expect(revisionRow(trail.id)).toMatchObject({ parked: false });
  });

  it("a trail is written only while the classic winner is the head: an edit on top of it first leaves the row settled without one", async () => {
    const kir = await saves("Caphiria", "Caphiria is an empire.", "db-kir");
    revisionRow(kir.revisionId).createdAt = new Date(siteTime() - 60_000);
    const bob = site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await syncRevisionById(bob.revid);
    const [won] = conflictsOf("Caphiria");
    expect(won).toMatchObject({ winnerRef: String(bob.revid), trailRevisionId: null });
    const ana = await saves("Caphiria", "Caphiria is a republic in Sarpedon.", "db-ana");

    await settleConflicts();

    expect(conflictsOf("Caphiria")[0]).toMatchObject({
      trailRevisionId: null,
      settledAt: expect.any(Date),
    });
    expect(systemWrites("Caphiria")).toEqual([]);
    expect(liveHead("Caphiria").id).toBe(ana.revisionId);
  });

  describe.each(["mirror first", "cycle first"])(
    "a talk note meets Bob's own edit of his talk page, %s",
    (order) => {
      it("no conflict row; Bob's edit is the head and the note is appended again on top of it, on both wikis", async () => {
        site.editAs("Carol", TALK, "Hello Bob.");
        await runAutoSyncCycle();
        // Kir's save, just after Bob's, wins Caphiria on classic: Bob is told on his talk page (dated by the site's clock,
        // so classic's own clock stays behind WikiOS's, as one server's clocks are)
        site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
        await saves("Caphiria", "Caphiria is an empire.", "db-kir", new Date(siteTime() + 1500));
        await runMirrorCycle();
        await runAutoSyncCycle();
        const [won] = conflictsOf("Caphiria");
        expect(won).toMatchObject({ winnerSide: "wikios" });
        const [note] = systemWrites(TALK);
        expect(note).toBeDefined();
        const section = String(note!.wikitext).replace("Hello Bob.", "").trim();
        expect(section).toContain("was replaced");
        // Bob replies on classic from the version before the note
        const reply = site.editAs("Bob", TALK, "Hello Bob.\n\nThanks Carol.");

        if (order === "mirror first") await runMirrorCycle();
        await runAutoSyncCycle();
        await runMirrorCycle();
        await runAutoSyncCycle();

        expect(conflictsOf(TALK)).toEqual([]);
        const expected = `Hello Bob.\n\nThanks Carol.\n\n${section}`;
        expect(article(TALK)?.wikitext).toBe(expected);
        expect(site.current(TALK)?.text).toBe(expected);
        expect(revisionsOf(TALK).some((row) => row.mwRevId === reply.revid)).toBe(true);
        // the first note stays in WikiOS's history, and Bob's talk channel is marked once
        expect(revisionRow(note!.id)).toMatchObject({ parked: false, wikitext: note!.wikitext });
        expect(marksOf(conflictsOf("Caphiria")[0]!, "name:Bob")).toEqual([
          expect.objectContaining({ channel: "talk-page" }),
        ]);
        expect(systemWrites(TALK)).toHaveLength(2);
      });
    }
  );

  it("a talk note under a person's later save, both overwritten by Bob's classic edit of his talk page: the note is appended again on top of Bob's edit", async () => {
    site.editAs("Carol", TALK, "Hello Bob.");
    await runAutoSyncCycle();
    site.editAs("Bob", "Caphiria", "Caphiria is a republic.");
    await saves("Caphiria", "Caphiria is an empire.", "db-kir", new Date(siteTime() + 1500));
    await runMirrorCycle();
    await runAutoSyncCycle();
    const [note] = systemWrites(TALK);
    const section = String(note!.wikitext).replace("Hello Bob.", "").trim();
    // Ana adds to the talk page in WikiOS, on top of the note, a little before Bob's own edit on classic
    await saves(
      TALK,
      `${String(note!.wikitext)}\n\nWelcome, Bob!`,
      "db-ana",
      new Date(siteTime() + 500)
    );
    // the talk page's jobs wait, so the cycle meets Bob's edit first
    for (const job of tables.wikiMirrorJob.rows.filter((row) => row.title === TALK)) {
      job.nextAttemptAt = new Date(Date.now() + 3_600_000);
    }
    site.editAs("Bob", TALK, "Hello Bob.\n\nThanks Carol.");

    await runAutoSyncCycle();

    expect(conflictsOf(TALK)).toEqual([expect.objectContaining({ winnerSide: "classic" })]);
    expect(article(TALK)?.wikitext).toBe(`Hello Bob.\n\nThanks Carol.\n\n${section}`);
  });

  it("a batch of a person's save and a system write after it is judged by the person's save: it lost, the system write is held back, classic keeps the later edit", async () => {
    site.editAs("Carol", TALK, "Hello Bob.");
    await runAutoSyncCycle();
    // a system write before Kir's save goes along as history, and is never listed as overwritten
    const earlier = await ArticleRepository.saveArticle(
      {
        slug: "User_talk:Bob",
        title: TALK,
        wikitext: "Hello Bob.\n\n== An earlier note ==",
        expectedHeadRef: toRevisionRef(liveHead(TALK) as { id: string; mwRevId: number | null }),
      },
      undefined,
      CONFLICT_NOTICE_AUTHOR
    );
    revisionRow(earlier.revisionId).createdAt = new Date(siteTime() + 50);
    const kir = await saves(TALK, "Hello Bob.\n\nWelcome!", "db-kir", new Date(siteTime() + 100));
    // a system write on top of Kir's save, dated now (an hour after the site's clock)
    const note = await ArticleRepository.saveArticle(
      {
        slug: "User_talk:Bob",
        title: TALK,
        wikitext: "Hello Bob.\n\nWelcome!\n\n== A note ==",
        expectedHeadRef: kir.revisionId,
      },
      undefined,
      CONFLICT_NOTICE_AUTHOR
    );
    const bob = site.editAs("Bob", TALK, "Hello Bob.\n\nThanks Carol.");

    await runMirrorCycle();

    expect(site.current(TALK)?.text).toBe("Hello Bob.\n\nThanks Carol.");
    expect(conflictsOf(TALK)).toEqual([
      expect.objectContaining({ winnerSide: "classic", winnerRef: String(bob.revid) }),
    ]);
    expect((conflictsOf(TALK)[0]!.overwritten as Array<{ ref: string }>).map((c) => c.ref)).toEqual(
      [kir.revisionId]
    );
    expect(jobOf(note.revisionId)).toMatchObject({ state: "done" });
    expect(revisionRow(note.revisionId).mwRevId).toBeNull();
    expect(site.pages.get(TALK)!.revisions.some((r) => r.text.includes("An earlier note"))).toBe(
      true
    );
    expect(site.pages.get(TALK)!.revisions.some((r) => r.text.includes("== A note =="))).toBe(
      false
    );

    await runAutoSyncCycle();

    expect(article(TALK)?.wikitext).toBe("Hello Bob.\n\nThanks Carol.");
    expect(conflictsOf(TALK)).toHaveLength(1);
  });

  it("a page classic deleted long ago, made anew in WikiOS, is created on classic: no row, nobody told", async () => {
    site.editAs("Old", "Foo", "An old Foo.");
    site.deletePage("Admin", "Foo");
    await saves("Foo", "A new Foo.", "db-kir");

    await runMirrorCycle();

    expect(site.current("Foo")?.text).toBe("A new Foo.");
    expect(conflictsOf("Foo")).toEqual([]);
    expect(
      revisionsOf("Foo").filter((row) => String(row.summary ?? "").includes("Overwrote"))
    ).toEqual([]);
  });

  it("a classic delete WikiOS applied, then a WikiOS restore and save whose undelete never reached classic: the save creates the page there, no row", async () => {
    site.deletePage("Admin", "Caphiria");
    await runAutoSyncCycle();
    expect(article("Caphiria")?.status).toBe("ARCHIVED");
    await PageManagementService.restoreArticle("Caphiria", { userId: "db-ana", name: "Ana" });
    // the undelete's job was discarded by an administrator
    for (const job of tables.wikiMirrorJob.rows.filter((row) => row.kind === "undelete")) {
      job.state = "discarded";
    }
    await saves("Caphiria", "Caphiria is an empire again.", "db-kir");

    await runMirrorCycle();

    expect(site.current("Caphiria")?.text).toBe("Caphiria is an empire again.");
    expect(conflictsOf("Caphiria")).toEqual([]);
  });
});
