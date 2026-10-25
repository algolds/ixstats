/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Settling the conflict log (conflict-notices.ts): every overwritten author is told once per channel (in-app with the
 * diff link, a Discord DM when linked, a note on their classic user talk page) and a conflict classic won gets one trail
 * revision. The talk note and the trail are written in WikiOS and mirrored out like any edit, never sent to MediaWiki by
 * the settling itself; the talk page is brought over from classic first, so the note is appended to its text.
 *
 * The real ArticleRepository and inbound revision sync run over the in-memory WikiOS tables (Prisma mode) and a
 * MediaWiki that keeps state (fake-mediawiki-site.ts). The in-app notice and the DM are mocks.
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
  // describeEachWikiosMode answers the switch and marker rows through a mock
  fake.tables.systemConfig.findUnique = jest.fn();
  return { __esModule: true, fake, db: fake.db, isDatabaseReadOnly: true };
});
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: {
    create: jest.fn().mockResolvedValue("n1"),
    createMany: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock("~/lib/discord/user-dm", () => ({
  __esModule: true,
  sendDiscordDm: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  renderArticleViaMediaWiki: jest.fn(async (wikitext: string) => ({
    html: `<p>${wikitext}</p>`,
    metadata: null,
  })),
}));

import { db } from "~/server/db";
import { notificationAPI } from "~/lib/notifications/api";
import { sendDiscordDm } from "~/lib/discord/user-dm";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import {
  conflictKey,
  trailSummary,
  type ChangeAuthor,
  type PageChange,
  type WikiSide,
} from "~/lib/wiki-os/services/conflict-rule";
import { recordConflict } from "~/lib/wiki-os/services/conflict-log";
import { settleConflicts } from "~/lib/wiki-os/services/conflict-notices";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;
const notify = jest.mocked(notificationAPI.create);
const dm = jest.mocked(sendDiscordDm);

const NOTE_HEADING = "== Your edit to [[Caphiria]] was replaced ==";
const NOTE_CLOSE = "Your text is still in the page history; edit the page again to bring it back.";

const realFetch = global.fetch;
let site: ReturnType<typeof createFakeMediaWikiSite>;

const article = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const revisionsOf = (title: string) =>
  tables.wikiRevision.rows.filter((row) => row.articleId === article(title)?.id);
const headOf = (title: string) =>
  revisionsOf(title)
    .filter((row) => !row.parked)
    .at(-1)!;
const jobs = () => tables.wikiMirrorJob.rows.map((job) => `${job.kind} ${job.title}`);
const conflictRow = (id: string) => tables.wikiConflict.rows.find((row) => row.id === id)!;
/** The edits MediaWiki received from the `since`-th request on. */
const editsSentSince = (since: number) =>
  site.wiki.requests.slice(since).filter((request) => request.params.action === "edit");

const author = (over: Partial<ChangeAuthor>): ChangeAuthor => ({
  userId: null,
  classicName: null,
  ip: null,
  label: null,
  ...over,
});
const change = (side: WikiSide, ref: string, by: ChangeAuthor): PageChange => ({
  side,
  action: "edit",
  ref,
  at: new Date("2026-10-24T12:00:00Z"),
  author: by,
});

/** Records the collision of Caphiria as the mirror or the cycle would: `winner` overwrote `overwritten`. */
async function collide(winner: PageChange, overwritten: PageChange[]): Promise<string> {
  const caphiria = article("Caphiria")!;
  const recorded = await recordConflict(db, {
    source: "ixwiki",
    articleId: caphiria.id as string,
    title: "Caphiria",
    verdict: {
      winner,
      overwritten,
      incomingWins: true,
      key: conflictKey("ixwiki", caphiria.id as string, winner.ref),
    },
    baseRef: null,
  });
  return recorded.id;
}

/** Caphiria on both wikis, WikiOS's head stamped with MediaWiki's revision; returns that revision id. */
function seedCaphiria(text = "Caphiria is a kingdom."): number {
  const founded = site.editAs("Founder", "Caphiria", text);
  const row = tables.wikiArticle.insert({
    title: "Caphiria",
    slug: "caphiria",
    wikitext: text,
    mwPageId: site.pages.get("Caphiria")!.pageid,
    mwLatestRevId: founded.revid,
    htmlSyncedAt: new Date("2026-09-01"),
  });
  tables.wikiRevision.insert({
    articleId: row.id,
    wikitext: text,
    byteSize: text.length,
    mwRevId: founded.revid,
    sha1: mwSha1Base36(text),
    author: "Founder",
    createdAt: new Date("2026-09-01"),
  });
  return founded.revid;
}

/** A WikiOS save of Caphiria (not mirrored yet): the head, by its row id. */
function wikiosHead(text: string): string {
  const row = tables.wikiRevision.insert({
    articleId: article("Caphiria")!.id,
    wikitext: text,
    byteSize: text.length,
    sha1: mwSha1Base36(text),
    author: "Alpha",
    authorId: "db-alpha",
    createdAt: new Date("2026-10-24T12:00:05Z"),
  });
  article("Caphiria")!.wikitext = text;
  return row.id;
}

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
  tables.user.seed(
    { id: "db-alpha", clerkUserId: "clerk-alpha", discordUserId: "disc-alpha" },
    { id: "db-beta", clerkUserId: "clerk-beta", discordUserId: null }
  );
});

afterEach(() => {
  global.fetch = realFetch;
});

describeEachWikiosMode("settleConflicts", () => {
  it("tells a claimed WikiOS author in-app with the diff link and DMs them when Discord is linked, once even when settled twice", async () => {
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({ userId: "db-alpha" })), [
      change("wikios", "wk-alpha", author({ userId: "db-alpha", label: "Alpha" })),
    ]);

    const first = await settleConflicts();

    expect(notify).toHaveBeenCalledTimes(1);
    // the notification API takes the Clerk id, as every other notifier passes it (preferences, push)
    expect(notify).toHaveBeenCalledWith({
      userId: "clerk-alpha",
      title: "Your edit was overwritten",
      message:
        'Your edit to "Caphiria" was replaced by a later edit on classic MediaWiki. Your text is kept in the page history.',
      href: `/wiki/Caphiria?diff=${winner}&oldid=wk-alpha&conflict=${id}`,
      category: "wiki",
      type: "warning",
      source: "wikiConflict",
    });
    expect(dm).toHaveBeenCalledTimes(1);
    expect(dm).toHaveBeenCalledWith(
      "disc-alpha",
      expect.stringContaining(`/wiki/Caphiria?diff=${winner}&oldid=wk-alpha&conflict=${id}`)
    );
    expect(dm.mock.calls[0]![1]).toContain('Your edit to "Caphiria" was replaced');
    expect(first).toEqual({ notified: 2, trails: 1, pending: 0 });
    // a WikiOS author with no classic name has no talk page to be told on
    expect(article("User talk:Alpha")).toBeUndefined();

    const second = await settleConflicts();

    expect(second).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(dm).toHaveBeenCalledTimes(1);
  });

  it("writes a classic-only editor's note on their talk page in WikiOS, mirrored like any edit", async () => {
    seedCaphiria();
    const foo = site.editAs("Foo", "Caphiria", "Caphiria is a republic.");
    const head = wikiosHead("Caphiria is an empire in Sarpedon.");
    await collide(change("wikios", head, author({ userId: "db-alpha" })), [
      change("classic", String(foo.revid), author({ classicName: "Foo" })),
    ]);
    const before = site.wiki.requests.length;

    const result = await settleConflicts();

    expect(result).toEqual({ notified: 1, trails: 0, pending: 0 });
    const note = headOf("User talk:Foo");
    expect(note.author).toBe("WikiOS");
    expect(note.wikitext).toContain(NOTE_HEADING);
    expect(note.wikitext).toContain(`[[Special:PermanentLink/${foo.revid}|revision ${foo.revid}]]`);
    expect(note.wikitext).toContain("A later edit on WikiOS replaced your edit");
    expect(note.wikitext).not.toContain("Special:Diff"); // MediaWiki does not have the winner yet
    expect(String(note.wikitext).trimEnd().endsWith(NOTE_CLOSE)).toBe(true);
    expect(jobs()).toEqual(["revision User talk:Foo"]);
    expect(editsSentSince(before)).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
    expect(dm).not.toHaveBeenCalled();
  });

  it("brings the classic talk page over before appending, and appends to its text", async () => {
    seedCaphiria();
    const foo = site.editAs("Foo", "Caphiria", "Caphiria is a republic.");
    const talk = site.editAs("Bar", "User talk:Foo", "old text");
    await collide(change("wikios", wikiosHead("Caphiria is an empire."), author({})), [
      change("classic", String(foo.revid), author({ classicName: "Foo" })),
    ]);
    expect(article("User talk:Foo")).toBeUndefined();

    await settleConflicts();

    const revisions = revisionsOf("User talk:Foo");
    expect(revisions.map((row) => row.mwRevId)).toEqual([talk.revid, null]);
    const note = headOf("User talk:Foo");
    expect(note.parentRevisionId).toBe(revisions[0]!.id);
    expect(String(note.wikitext).startsWith("old text")).toBe(true);
    expect(note.wikitext).toContain(NOTE_HEADING);
    expect(String(note.wikitext).trimEnd().endsWith(NOTE_CLOSE)).toBe(true);
    expect(article("User talk:Foo")!.wikitext).toBe(note.wikitext);
  });

  it("links the diff on classic once the WikiOS winner is mirrored", async () => {
    seedCaphiria();
    const foo = site.editAs("Foo", "Caphiria", "Caphiria is a republic.");
    const head = wikiosHead("Caphiria is an empire.");
    tables.wikiRevision.rows.find((row) => row.id === head)!.mwRevId = 999;
    await collide(change("wikios", head, author({})), [
      change("classic", String(foo.revid), author({ classicName: "Foo" })),
    ]);

    await settleConflicts();

    expect(headOf("User talk:Foo").wikitext).toContain(
      `([[Special:PermanentLink/${foo.revid}|revision ${foo.revid}]], [[Special:Diff/${foo.revid}/999|diff]])`
    );
  });

  it("links a category in the note with a leading colon, so the talk page is not filed in it", async () => {
    tables.wikiConflict.insert({
      key: "ixwiki:cat:wk-cat",
      title: "Category:Empires",
      winnerSide: "wikios",
      winnerAction: "edit",
      winnerRef: "wk-cat",
      winnerAt: new Date("2026-10-24T12:00:05Z"),
      overwritten: [
        {
          side: "classic",
          action: "edit",
          ref: "41",
          at: "2026-10-24T12:00:00.000Z",
          author: { userId: null, classicName: "Foo", ip: null, label: null },
        },
      ],
    });

    await settleConflicts();

    expect(headOf("User talk:Foo").wikitext).toContain(
      "== Your edit to [[:Category:Empires]] was replaced =="
    );
  });

  it("an IP editor gets the talk note only; a wikios> label editor the in-app notice only", async () => {
    seedCaphiria();
    const ip = site.editAs("10.0.0.7", "Caphiria", "Caphiria is a duchy.");
    await collide(change("wikios", wikiosHead("Caphiria is an empire."), author({})), [
      change("classic", String(ip.revid), author({ ip: "10.0.0.7" })),
    ]);
    const classicWin = site.editAs("Founder", "Caphiria", "Caphiria is a duchy again.");
    const beta = await collide(
      change("classic", String(classicWin.revid), author({ classicName: "Founder" })),
      [change("wikios", "wk-beta", author({ userId: "db-beta", label: "Beta" }))]
    );

    await settleConflicts();

    expect(headOf("User talk:10.0.0.7").wikitext).toContain(NOTE_HEADING);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "clerk-beta" }));
    // Beta has no Discord linked and no classic name: no DM, no talk page
    expect(dm).not.toHaveBeenCalled();
    expect(article("User talk:Beta")).toBeUndefined();
    expect(jobs()).toEqual(["revision User talk:10.0.0.7"]);
    // with no Discord linked there is nothing to send: the channel is settled, not owed
    expect(conflictRow(beta).notified).toEqual([
      expect.objectContaining({ key: "user:db-beta", channel: "in-app" }),
      expect.objectContaining({ key: "user:db-beta", channel: "discord" }),
    ]);
  });

  it("a DM Discord refuses is tried again by the next run, and given up a day after the collision", async () => {
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-alpha", author({ userId: "db-alpha" })),
    ]);
    dm.mockResolvedValueOnce(false);

    expect(await settleConflicts()).toEqual({ notified: 1, trails: 1, pending: 1 });
    expect(await settleConflicts()).toEqual({ notified: 1, trails: 0, pending: 0 });
    expect(dm).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(1);

    // a later loser joins the row; Discord keeps refusing, and the collision is two days old
    const merged = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-alpha-2", author({ userId: "db-beta" })),
    ]);
    expect(merged).toBe(id);
    tables.user.rows.find((row) => row.id === "db-beta")!.discordUserId = "disc-beta";
    conflictRow(id).createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    dm.mockResolvedValueOnce(false);

    expect(await settleConflicts()).toEqual({ notified: 1, trails: 0, pending: 0 });
    expect(dm).toHaveBeenLastCalledWith("disc-beta", expect.any(String));
  });

  it("an in-app notice that fails is left for the next run", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const winner = seedCaphiria("Caphiria is an empire.");
    await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-beta", author({ userId: "db-beta" })),
    ]);
    notify.mockRejectedValueOnce(new Error("database down"));

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 1, pending: 1 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("in-app notice of conflict"),
      expect.any(Error)
    );
    expect(await settleConflicts()).toEqual({ notified: 1, trails: 0, pending: 0 });
    expect(notify).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("settles at most `limit` rows a run, oldest first, and counts the rest as pending", async () => {
    seedCaphiria();
    for (const name of ["Ann", "Ben", "Cat"]) {
      const edit = site.editAs(name, "Caphiria", `Caphiria by ${name}.`);
      await collide(change("wikios", wikiosHead(`WikiOS over ${name}.`), author({})), [
        change("classic", String(edit.revid), author({ classicName: name })),
      ]);
    }

    expect(await settleConflicts(2)).toEqual({ notified: 2, trails: 0, pending: 1 });
    expect(article("User talk:Ann")).toBeDefined();
    expect(article("User talk:Cat")).toBeUndefined();
    expect(await settleConflicts(2)).toEqual({ notified: 1, trails: 0, pending: 0 });
  });

  it("a classic winner gets one trail revision with the head's text, mirrored, and never a second", async () => {
    const winner = seedCaphiria("Caphiria is an empire.");
    const overwritten = [change("wikios", "wk-gone", author({ label: "Community Contributor" }))];
    const id = await collide(change("classic", String(winner), author({})), overwritten);

    const first = await settleConflicts();

    expect(first).toEqual({ notified: 0, trails: 1, pending: 0 });
    const trail = headOf("Caphiria");
    expect(trail).toMatchObject({
      author: "WikiOS",
      wikitext: "Caphiria is an empire.",
      byteDelta: 0,
      mwRevId: null,
    });
    expect(trail.summary).toBe(
      trailSummary(
        {
          winner: change("classic", String(winner), author({})),
          overwritten,
          incomingWins: true,
          key: "",
        },
        id
      )
    );
    expect(conflictRow(id).trailRevisionId).toBe(trail.id);
    expect(jobs()).toEqual(["revision Caphiria"]);

    const second = await settleConflicts();

    expect(second).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(revisionsOf("Caphiria")).toHaveLength(2);
    expect(jobs()).toEqual(["revision Caphiria"]);
  });

  it("waits with the trail until the classic winner is in WikiOS's history", async () => {
    seedCaphiria();
    const winner = site.editAs("Founder", "Caphiria", "Caphiria is an empire.");
    await collide(change("classic", String(winner.revid), author({})), [
      change("wikios", "wk-gone", author({ label: "Community Contributor" })),
    ]);

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 1 });
    expect(revisionsOf("Caphiria")).toHaveLength(1);
    expect(jobs()).toEqual([]);
  });

  it("a legacy row is never notified", async () => {
    const winner = seedCaphiria();
    tables.wikiConflict.insert({
      key: `legacy-park:${winner}`,
      articleId: article("Caphiria")!.id,
      title: "Caphiria",
      winnerSide: "classic",
      winnerAction: "edit",
      winnerRef: String(winner),
      winnerAt: new Date("2026-09-01"),
      overwritten: [
        {
          side: "wikios",
          action: "edit",
          ref: "wk-old",
          at: "2026-08-31T00:00:00.000Z",
          author: { userId: "db-alpha", classicName: "Alpha", ip: null, label: null },
        },
      ],
      legacyPark: true,
    });

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(notify).not.toHaveBeenCalled();
    expect(dm).not.toHaveBeenCalled();
    expect(article("User talk:Alpha")).toBeUndefined();
    expect(revisionsOf("Caphiria")).toHaveLength(1);
  });

  it("a deleted talk page takes no note, and the row does not try it again", async () => {
    seedCaphiria();
    const foo = site.editAs("Foo", "Caphiria", "Caphiria is a republic.");
    const id = await collide(change("wikios", wikiosHead("Caphiria is an empire."), author({})), [
      change("classic", String(foo.revid), author({ classicName: "Foo" })),
    ]);
    const talk = tables.wikiArticle.insert({
      title: "User talk:Foo",
      slug: "user_talk:foo",
      namespace: 3,
      wikitext: "Old talk.",
      status: "ARCHIVED",
    });
    tables.wikiRevision.insert({
      articleId: talk.id,
      wikitext: "Old talk.",
      byteSize: 9,
      sha1: mwSha1Base36("Old talk."),
      author: "Bar",
      createdAt: new Date("2026-09-01"),
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const first = await settleConflicts();
    const second = await settleConflicts();

    expect(first.pending).toBe(0);
    expect(second).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(revisionsOf("User talk:Foo")).toHaveLength(1);
    expect(article("User talk:Foo")).toMatchObject({ status: "ARCHIVED", wikitext: "Old talk." });
    expect(jobs()).toEqual([]);
    expect(conflictRow(id).settledAt).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a talk page edited meanwhile leaves the note pending for the next run", async () => {
    seedCaphiria();
    const foo = site.editAs("Foo", "Caphiria", "Caphiria is a republic.");
    const id = await collide(change("wikios", wikiosHead("Caphiria is an empire."), author({})), [
      change("classic", String(foo.revid), author({ classicName: "Foo" })),
    ]);
    const save = ArticleRepository.saveArticle.bind(ArticleRepository);
    jest.spyOn(ArticleRepository, "saveArticle").mockImplementationOnce(async (...args) => {
      // somebody saves the talk page between the settling's read and its save
      await save({ slug: "User talk:Foo", title: "User talk:Foo", wikitext: "Hello Foo." });
      return save(...args);
    });

    const first = await settleConflicts();

    expect(first).toEqual({ notified: 0, trails: 0, pending: 1 });
    expect(headOf("User talk:Foo").wikitext).toBe("Hello Foo.");
    expect(conflictRow(id).notified).toEqual([]);

    const second = await settleConflicts();

    expect(second).toEqual({ notified: 1, trails: 0, pending: 0 });
    const note = headOf("User talk:Foo");
    expect(String(note.wikitext).startsWith("Hello Foo.")).toBe(true);
    expect(note.wikitext).toContain(NOTE_HEADING);
  });
  it("a classic winner later overwritten itself still gets its trail, once", async () => {
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-gone", author({ label: "Community Contributor" })),
    ]);
    // a later WikiOS save overwrote the classic winner: it is history only now
    const winnerRow = tables.wikiRevision.rows.find((row) => row.mwRevId === winner)!;
    Object.assign(winnerRow, { parked: true, parkReason: "overwritten:wk-later" });
    wikiosHead("Caphiria is an empire in Sarpedon.");

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 1, pending: 0 });
    expect(headOf("Caphiria")).toMatchObject({
      author: "WikiOS",
      wikitext: "Caphiria is an empire in Sarpedon.",
    });
    expect(conflictRow(id).trailRevisionId).toBe(headOf("Caphiria").id);
    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(jobs()).toEqual(["revision Caphiria"]);
  });

  it("a row whose article is gone stops being retried", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-gone", author({ label: "Community Contributor" })),
    ]);
    tables.wikiRevision.rows.length = 0;
    tables.wikiArticle.rows.length = 0;

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`conflict ${id}`));
    warn.mockRestore();
  });

  it("a classic winner that never reaches WikiOS is given up a day after the first settle attempt", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    seedCaphiria();
    const winner = site.editAs("Founder", "Caphiria", "Caphiria is an empire.");
    const id = await collide(change("classic", String(winner.revid), author({})), [
      change("wikios", "wk-gone", author({ label: "Community Contributor" })),
    ]);
    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 1 });
    expect(conflictRow(id).settledAt).toBeNull();

    conflictRow(id).firstSettleAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);
    expect(revisionsOf("Caphiria")).toHaveLength(1);
    warn.mockRestore();
  });

  it("a row first settled late still gets 24 h before giving up its trail", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    seedCaphiria();
    const winner = site.editAs("Founder", "Caphiria", "Caphiria is an empire.");
    const id = await collide(change("classic", String(winner.revid), author({})), [
      change("wikios", "wk-gone", author({ label: "Community Contributor" })),
    ]);
    // the settling first reaches the row two days after the collision (the sync was down meanwhile)
    conflictRow(id).createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 1 });
    const first = conflictRow(id).firstSettleAt as Date;
    expect(first).toBeInstanceOf(Date);
    expect(conflictRow(id).settledAt).toBeNull();
    // a later run keeps the first attempt's time and still waits
    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 1 });
    expect(conflictRow(id).firstSettleAt).toEqual(first);

    conflictRow(id).firstSettleAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);
    warn.mockRestore();
  });

  it("a row is settled after its last channel and its trail, and a settled row is not read again", async () => {
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-alpha", author({ userId: "db-alpha" })),
    ]);
    dm.mockResolvedValueOnce(false);

    await settleConflicts();
    expect(conflictRow(id).settledAt).toBeNull(); // the DM is still owed
    await settleConflicts();
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);

    // were the row read again, its emptied marks would send everything a second time
    conflictRow(id).notified = [];
    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("a merge that adds a loser reopens a settled row, and only the new loser is told", async () => {
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-alpha", author({ userId: "db-alpha" })),
    ]);
    await settleConflicts();
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);

    await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-beta", author({ userId: "db-beta" })),
    ]);
    expect(conflictRow(id).settledAt).toBeNull();

    expect(await settleConflicts()).toEqual({ notified: 1, trails: 0, pending: 0 });
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "clerk-beta" }));
    expect(notify).toHaveBeenCalledTimes(2);
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);
  });

  it("a classic move winner gets its trail once the move is in WikiOS; its notices link the page history, not a diff", async () => {
    seedCaphiria("Caphiria is an empire.");
    const winner: PageChange = { ...change("classic", "mwlog:77", author({})), action: "move" };
    const id = await collide(winner, [
      {
        ...change("wikios", "log:wk-move", author({ userId: "db-alpha", classicName: "Alpha" })),
        action: "move",
      },
    ]);

    // the classic move's event has not been applied in WikiOS yet: the trail waits for it
    expect(await settleConflicts()).toEqual({ notified: 3, trails: 0, pending: 1 });
    const history = `/wiki/Caphiria?action=history&conflict=${id}`;
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ href: history }));
    expect(dm).toHaveBeenCalledWith("disc-alpha", expect.stringContaining(history));
    expect(revisionsOf("Caphiria")).toHaveLength(1);
    // Alpha lost a move: the note names it, and links the log (their move) and the history (the winner)
    expect(headOf("User talk:Alpha").wikitext).toContain(
      "== Your move of [[Caphiria]] was replaced =="
    );
    expect(headOf("User talk:Alpha").wikitext).toContain(
      "([{{fullurl:Special:Log|page=Caphiria}} log], [{{fullurl:Caphiria|action=history}} history])"
    );

    tables.wikiLog.insert({
      logType: "move",
      action: "move",
      title: "Caphiria",
      actorName: "Founder",
      mwLogId: 77,
      articleId: article("Caphiria")!.id,
    });

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 1, pending: 0 });
    expect(headOf("Caphiria")).toMatchObject({
      author: "WikiOS",
      wikitext: "Caphiria is an empire.",
    });
    expect(conflictRow(id).trailRevisionId).toBe(headOf("Caphiria").id);
    expect(jobs()).toEqual(["revision User talk:Alpha", "revision Caphiria"]);
  });

  it("a classic delete winner gets no trail; its row settles once its notices are done, which link the log", async () => {
    // the page is live again here (restored since): a delete winner never takes a trail, live page or not
    seedCaphiria("Caphiria is an empire.");
    const winner: PageChange = { ...change("classic", "mwlog:78", author({})), action: "delete" };
    const id = await collide(winner, [
      change("wikios", "wk-beta", author({ userId: "db-beta", classicName: "Beta" })),
    ]);

    expect(await settleConflicts()).toEqual({ notified: 2, trails: 0, pending: 0 });

    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);
    expect(conflictRow(id).trailRevisionId).toBeNull();
    expect(revisionsOf("Caphiria")).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ href: `/util/log?title=Caphiria&conflict=${id}` })
    );
    const note = String(headOf("User talk:Beta").wikitext);
    expect(note).toContain("[{{fullurl:Special:Log|page=Caphiria}} log]");
    expect(note).not.toContain("Special:Diff");
    expect(jobs()).toEqual(["revision User talk:Beta"]);
  });

  it("a classic winner whose page was deleted since gets no trail, and its row settles", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const winner = seedCaphiria("Caphiria is an empire.");
    const id = await collide(change("classic", String(winner), author({})), [
      change("wikios", "wk-gone", author({ label: "Community Contributor" })),
    ]);
    article("Caphiria")!.status = "ARCHIVED";

    expect(await settleConflicts()).toEqual({ notified: 0, trails: 0, pending: 0 });
    expect(conflictRow(id).settledAt).toBeInstanceOf(Date);
    expect(revisionsOf("Caphiria")).toHaveLength(1);
    expect(jobs()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("its page is deleted"));
    warn.mockRestore();
  });

  it("a classic deleter who lost to a later WikiOS edit is told the page was kept, with the log and history, never a diff", async () => {
    seedCaphiria();
    const head = wikiosHead("Caphiria is an empire.");
    const id = await collide(change("wikios", head, author({})), [
      {
        ...change("classic", "mwlog:91", author({ userId: "db-beta", classicName: "Beta" })),
        action: "delete",
      },
    ]);

    expect(await settleConflicts()).toEqual({ notified: 2, trails: 0, pending: 0 });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Your deletion was overwritten",
        message:
          'Your deletion of "Caphiria" was replaced by a later edit on WikiOS. The page was kept.',
        href: `/wiki/Caphiria?action=history&conflict=${id}`,
      })
    );
    const note = headOf("User talk:Beta");
    expect(note.summary).toBe("Your deletion of Caphiria was replaced");
    expect(note.wikitext).toContain(
      "== Your deletion of [[Caphiria]] was replaced ==\n" +
        "A later edit on WikiOS replaced your deletion " +
        "([{{fullurl:Special:Log|page=Caphiria}} log], [{{fullurl:Caphiria|action=history}} history]). " +
        "The page was kept; delete it again if it should still go."
    );
  });

  it("a restorer whose restore a later classic deletion replaced is told the page stays deleted, with the log linked once", async () => {
    seedCaphiria();
    article("Caphiria")!.status = "ARCHIVED";
    const id = await collide({ ...change("classic", "mwlog:92", author({})), action: "delete" }, [
      {
        ...change("wikios", "log:wk-restore", author({ userId: "db-beta", classicName: "Beta" })),
        action: "undelete",
      },
    ]);

    await settleConflicts();

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Your restore of "Caphiria" was replaced by a later deletion on classic MediaWiki. The page stays deleted.',
        href: `/util/log?title=Caphiria&conflict=${id}`,
      })
    );
    expect(headOf("User talk:Beta").wikitext).toContain(
      "replaced your restore ([{{fullurl:Special:Log|page=Caphiria}} log]). " +
        "The page stays deleted; restore it again if it should come back."
    );
  });

  it("a bookkeeping failure on one row leaves the others to settle", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    seedCaphiria();
    const first = site.editAs("Foo", "Caphiria", "Caphiria by Foo.");
    const a = await collide(change("wikios", wikiosHead("WikiOS over Foo."), author({})), [
      change("classic", String(first.revid), author({ classicName: "Foo" })),
    ]);
    const second = site.editAs("Bar", "Caphiria", "Caphiria by Bar.");
    const b = await collide(change("wikios", wikiosHead("WikiOS over Bar."), author({})), [
      change("classic", String(second.revid), author({ classicName: "Bar" })),
    ]);
    // row A's first mark (markNotified's write) fails
    jest
      .spyOn(tables.wikiConflict, "updateMany")
      .mockRejectedValueOnce(new Error("deadlock detected"));

    const result = await settleConflicts();

    expect(result.pending).toBe(1);
    expect(conflictRow(a).settledAt).toBeNull();
    expect(conflictRow(b).settledAt).toBeInstanceOf(Date);
    expect(headOf("User talk:Bar").wikitext).toContain(NOTE_HEADING);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`conflict ${a}`), expect.any(Error));
    warn.mockRestore();
  });
});
