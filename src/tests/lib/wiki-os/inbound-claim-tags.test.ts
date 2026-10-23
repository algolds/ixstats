/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * IxnayID design decisions 7 and 14: a MediaWiki edit the inbound sync stores is written with no WikiOS author, and the
 * approved name claim of its editor then tags it (claim-tags.ts logs every tag, so a revoke takes it back). The editor of
 * a parked edit is the approved claim's owner, whatever the claim's visibility; a pending claim names nobody.
 *
 * The real auto-sync cycle runs over the in-memory WikiOS tables (Prisma mode) and a MediaWiki that keeps state
 * (fake-mediawiki-site.ts); the tagging itself is claim-tags.test.ts's, so it is a mock here.
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
jest.mock("~/lib/identity/claim-tags", () => ({
  tagRevisionsOfName: jest.fn().mockResolvedValue(1),
}));
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

import { tagRevisionsOfName } from "~/lib/identity/claim-tags";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";
import { claimedWikiUserId } from "~/lib/wiki-os/services/inbound-revision-sync";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { notificationAPI } from "~/lib/notifications/api";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;
const tag = jest.mocked(tagRevisionsOfName);
const notify = jest.mocked(notificationAPI.create);

const realFetch = global.fetch;
let site: ReturnType<typeof createFakeMediaWikiSite>;

const caphiria = () => tables.wikiArticle.rows.find((row) => row.title === "Caphiria")!;
const revisionOf = (mwRevId: number) =>
  tables.wikiRevision.rows.find((row) => row.mwRevId === mwRevId);
const claim = (userId: string, name: string, over: Record<string, unknown> = {}) =>
  tables.wikiNameClaim.seed({ userId, name, origin: "PLAYER", requestedById: userId, ...over });

/** The stored revision row of each call to the tagger, when it was called: it must already be there. */
let seenAtTag: Array<Record<string, unknown> | undefined> = [];

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
  seenAtTag = [];
  tag.mockImplementation(async (_db, _source, author) => {
    seenAtTag.push(tables.wikiRevision.rows.find((row) => row.author === author));
    return 1;
  });

  // Caphiria as both wikis have it: MediaWiki's revision is WikiOS's head, stamped
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

/** WikiOS's head moves past MediaWiki's (a WikiOS save the mirror has not pushed yet): the next MediaWiki edit parks. */
function moveWikiOSHeadOn(): void {
  const text = "Caphiria is an empire in Sarpedon.";
  caphiria().wikitext = text;
  tables.wikiRevision.insert({
    articleId: caphiria().id,
    wikitext: text,
    byteSize: text.length,
    mwRevId: null,
    sha1: mwSha1Base36(text),
    author: "alpha",
    authorId: "db-alpha",
    createdAt: new Date("2026-09-02"),
  });
}

describe("claimedWikiUserId", () => {
  it("is the approved claim's owner, whether or not they show it; nobody for a pending claim or no name", async () => {
    claim("db-foo", "Foo bar", { visible: false });
    claim("db-pend", "Pending name", { status: "PENDING" });

    expect(await claimedWikiUserId("Foo_bar")).toBe("db-foo");
    expect(await claimedWikiUserId("Pending name")).toBeNull();
    expect(await claimedWikiUserId("Nobody")).toBeNull();
    expect(await claimedWikiUserId(null)).toBeNull();
  });
});

describe("a MediaWiki edit stored by the inbound sync", () => {
  it("fast-forwarded: stored with no author, then tagged through the editor's name", async () => {
    claim("db-foo", "Foo bar");
    const edit = site.editAs("Foo bar", "Caphiria", "Caphiria is an empire.");

    await runAutoSyncCycle();

    expect(revisionOf(edit.revid)).toMatchObject({
      author: "Foo bar",
      authorId: null,
      parked: false,
    });
    expect(tag).toHaveBeenCalledTimes(1);
    expect(tag).toHaveBeenCalledWith(expect.anything(), "ixwiki", "Foo bar");
    expect(seenAtTag[0]).toMatchObject({ mwRevId: edit.revid });
  });

  it("an echo stored as its own revision: no author, then tagged", async () => {
    const edit = site.editAs("Foo bar", "Caphiria", "Caphiria is a kingdom.");

    await runAutoSyncCycle();

    expect(revisionOf(edit.revid)).toMatchObject({ author: "Foo bar", authorId: null });
    expect(tag).toHaveBeenCalledWith(expect.anything(), "ixwiki", "Foo bar");
    expect(seenAtTag[0]).toMatchObject({ mwRevId: edit.revid });
  });

  it("parked: stored with no author, tagged, and the approved claim's owner is told", async () => {
    claim("db-foo", "Foo bar");
    moveWikiOSHeadOn();
    const edit = site.editAs("Foo bar", "Caphiria", "Caphiria is a republic.");

    await runAutoSyncCycle();

    expect(revisionOf(edit.revid)).toMatchObject({
      author: "Foo bar",
      authorId: null,
      parked: true,
    });
    expect(tag).toHaveBeenCalledWith(expect.anything(), "ixwiki", "Foo bar");
    expect(seenAtTag[0]).toMatchObject({ mwRevId: edit.revid });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "db-foo" }));
  });

  it("parked by a name whose claim is only pending: nobody is told", async () => {
    claim("db-foo", "Foo bar", { status: "PENDING" });
    moveWikiOSHeadOn();
    const edit = site.editAs("Foo bar", "Caphiria", "Caphiria is a republic.");

    await runAutoSyncCycle();

    expect(revisionOf(edit.revid)).toMatchObject({ parked: true, authorId: null });
    expect(notify).not.toHaveBeenCalled();
  });

  it("is kept when the tagging fails: the edit is stored and the cycle goes on", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    tag.mockRejectedValueOnce(new Error("lock timeout"));
    const edit = site.editAs("Foo bar", "Caphiria", "Caphiria is an empire.");

    await runAutoSyncCycle();

    expect(revisionOf(edit.revid)).toMatchObject({ authorId: null, parked: false });
    expect(caphiria().wikitext).toBe("Caphiria is an empire.");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("could not be tagged"),
      expect.any(Error)
    );
    warn.mockRestore();
  });
});
