/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario: a sysop moves Caphiria (with its talk page) to Kingdom of Caphiria, deletes it, then restores it. The
 * real page-admin router, PageManagementService, rights engine, title-cache eviction, mirror outbox, watcher
 * notifications and the cached readers run over the in-memory WikiOS tables (Prisma mode); MediaWiki is never asked
 * (fetch answers 404) and its render is a stand-in.
 *
 * Folds wikios-delete-evicts-caches.test.ts: every cached reader shows the page while it is published, nothing once it
 * is deleted, the page again once it is restored, and a moved page under its new name at once.
 */
jest.mock("~/server/db", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-wiki-db").createFakeWikiDb({ prisma: true });
  return {
    __esModule: true,
    fake,
    db: {
      ...fake.db,
      externalApiCache: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    },
    isDatabaseReadOnly: true,
  };
});
// The kick would run the mirror worker in a timer; the jobs themselves are real rows.
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
jest.mock("~/lib/auth/system-owner-constants", () => ({ __esModule: true, isSystemOwner: () => false }));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn(), createMany: jest.fn().mockResolvedValue([]) },
}));
// MediaWiki's render of a page: the one HTTP call a render makes.
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  renderArticleViaMediaWiki: jest.fn(),
}));

import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { wikiosPageAdminRouter } from "~/server/api/routers/wikios/page-admin";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { wikiProcedures } from "~/server/api/routers/countries/wiki";
import { geoWikiRouter } from "~/server/api/routers/geo/wiki";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { getArticleIntro } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { wikiBridgeCache } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { buildViewBundle } from "~/lib/wiki-os/services/render-service";
import { markWatchedVisited } from "~/lib/wiki-os/services/watchlist-notify";
import { notificationAPI } from "~/lib/notifications/api";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const MARKER = "CAPHIRIA-MARKER-4d2b8";
const BODY = `{{Infobox country|name=${MARKER}}}\n${MARKER} is a kingdom.\n`;

const ctxFor = (id: string, clerk: string, name: string, role = "user") =>
  createMockRouterContext({
    auth: { userId: clerk },
    user: { id, clerkUserId: clerk, wikiUsername: name, role: { name: role, level: 100 } },
  }) as never;
const sysop = () => ctxFor("db-sysop", "clerk-sysop", "Mod", "admin");
const newcomer = () => ctxFor("db-new", "clerk-new", "Newcomer");
const signedOut = () => createMockRouterContext({ auth: null, user: null }) as never;

const admin = (ctx: never) => createCallerFactory(wikiosPageAdminRouter)(ctx);
const reader = (ctx: never) => createCallerFactory(wikiosPageContentRouter)(ctx);
const geoWiki = () => createCallerFactory(geoWikiRouter)(signedOut());
const countriesWiki = () => createCallerFactory(createTRPCRouter(wikiProcedures))(signedOut());
const wikiCache = () => createCallerFactory(wikiCacheRouter)(signedOut());

/** Every reader that keeps what it read in a cache, asked for one title. */
const readers = (title: string): Array<[string, () => Promise<unknown>]> => [
  ["bridge.getArticleIntro", () => getArticleIntro(title, "ixwiki")],
  ["geo.getFeatureWikiIntro", () => geoWiki().getFeatureWikiIntro({ wikiPageTitle: title })],
  ["geo.parseWikiInfobox", () => geoWiki().parseWikiInfobox({ pageTitle: title })],
  ["countries.getWikiIntro", () => countriesWiki().getWikiIntro({ countryName: title })],
  ["countries.parseInfobox", () => countriesWiki().parseInfobox({ pageName: title, site: "ixwiki" })],
  ["wikiCache.getCountryProfile", () => wikiCache().getCountryProfile({ countryName: title })],
];

const shows = async (read: () => Promise<unknown>) =>
  JSON.stringify((await read().catch(() => null)) ?? null).includes(MARKER);
/** Which readers show the page's marker for `title`, by name. */
const showing = async (title: string) => {
  const names: string[] = [];
  for (const [name, read] of readers(title)) if (await shows(read)) names.push(name);
  return names;
};
const ALL_READERS = readers("x").map(([name]) => name);

const article = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const jobs = () => tables.wikiMirrorJob.rows.map((job) => `${job.kind} ${job.title}`);
const notified = () =>
  jest
    .mocked(notificationAPI.createMany)
    .mock.calls.flatMap(([inputs]) => inputs.map((input) => `${input.userId}: ${input.title}`));
/** Who was told of what, from the notifications' metadata. */
const notices = () =>
  jest
    .mocked(notificationAPI.createMany)
    .mock.calls.flatMap(([inputs]) =>
      inputs.map((input) => `${input.userId} ${(input.metadata as { kind: string }).kind}`)
    );
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const realFetch = global.fetch;

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as never;
});
afterAll(() => {
  global.fetch = realFetch;
});

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
  wikiBridgeCache.clear();
  wikiCacheService.clearCache();
  jest.mocked(renderArticleViaMediaWiki).mockImplementation(async (wikitext: string) => ({
    html: `<div class="mw-parser-output"><p>${wikitext}</p></div>`,
    // MediaWiki reported no links, templates, images or categories
    metadata: {
      links: null,
      templates: null,
      images: null,
      categories: null,
      displayTitle: null,
      properties: {},
    },
  }));
  tables.user.seed(
    { id: "db-sysop", clerkUserId: "clerk-sysop", wikiUsername: "Mod" },
    { id: "db-new", clerkUserId: "clerk-new", wikiUsername: "Newcomer", createdAt: new Date() },
    { id: "db-watcher", clerkUserId: "clerk-watcher", wikiUsername: "Watcher" }
  );
  const page = tables.wikiArticle.insert({
    title: "Caphiria",
    slug: "caphiria",
    wikitext: BODY,
    htmlSyncedAt: new Date("2026-09-01T00:00:00Z"),
    renderedView: buildViewBundle(`<p>${MARKER} is a kingdom.</p>`),
  });
  tables.wikiRevision.insert({ articleId: page.id, wikitext: BODY, byteSize: BODY.length, author: "Founder" });
  const talk = tables.wikiArticle.insert({ title: "Talk:Caphiria", slug: "talk:caphiria", namespace: 1, wikitext: "chat" });
  tables.wikiRevision.insert({ articleId: talk.id, wikitext: "chat", byteSize: 4 });
  // edit-protected to autoconfirmed members: the protection belongs to the page and moves with it
  tables.wikiRestriction.seed({ source: "ixwiki", title: "Caphiria", action: "edit", level: "autoconfirmed" });
  tables.wikiWatchlist.seed({ userId: "db-watcher", articleId: page.id });
});

describe("a sysop moves, deletes and restores Caphiria", () => {
  it("refuses a newcomer's move and changes nothing", async () => {
    await expect(
      admin(newcomer()).movePage({ from: "Caphiria", to: "Kingdom of Caphiria", reason: "rename" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin(newcomer()).deletePage({ title: "Caphiria", reason: "spam" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(tables.wikiArticle.rows.map((row) => `${row.title} ${row.status}`).sort()).toEqual([
      "Caphiria PUBLISHED",
      "Talk:Caphiria PUBLISHED",
    ]);
    expect(tables.wikiLog.rows).toEqual([]);
    expect(jobs()).toEqual([]);
    await settle();
    expect(notified()).toEqual([]);
    expect(renderArticleViaMediaWiki).not.toHaveBeenCalled();
  });

  it("every reader follows the page through the move, the delete and the restore", async () => {
    // primed: each reader caches what it read, and serves it from the cache the second time
    expect(await showing("Caphiria")).toEqual(ALL_READERS);
    expect(await showing("Caphiria")).toEqual(ALL_READERS);

    // the move: a redirect with its own revision stays behind, the talk page and the protection follow
    const moved = await admin(sysop()).movePage({ from: "Caphiria", to: "Kingdom of Caphiria", reason: "rename" });
    expect(moved).toEqual({
      success: true,
      from: "Caphiria",
      to: "Kingdom of Caphiria",
      redirectCreated: true,
      talkMoved: true,
    });
    const redirect = article("Caphiria")!;
    expect(redirect).toMatchObject({ wikitext: "#REDIRECT [[Kingdom of Caphiria]]", redirectTargetSlug: "Kingdom of Caphiria" });
    expect(tables.wikiRevision.rows.filter((row) => row.articleId === redirect.id)).toEqual([
      expect.objectContaining({ wikitext: "#REDIRECT [[Kingdom of Caphiria]]", author: "Mod" }),
    ]);
    expect(article("Talk:Kingdom of Caphiria")).toBeDefined();
    expect(tables.wikiRestriction.rows.map((row) => `${row.title}/${row.action}=${row.level}`)).toEqual([
      "Kingdom of Caphiria/edit=autoconfirmed",
    ]);
    // one move job per page that moved, written from the old title and tied to the move's log row
    expect(jobs()).toEqual(["move Caphiria", "move Talk:Caphiria"]);
    const moveLogs = tables.wikiLog.rows.map((row) => row.id);
    expect(tables.wikiMirrorJob.rows.map((job) => job.logId)).toEqual(moveLogs);
    await settle();
    expect(notices()).toEqual(["clerk-watcher moved"]);
    expect(notified()[0]).toMatch(/Kingdom of Caphiria/);

    // the readers show the page under its new name at once; the old name is a redirect page now
    expect(await shows(() => getArticleIntro("Caphiria", "ixwiki"))).toBe(false);
    expect(await shows(() => getArticleIntro("Kingdom of Caphiria", "ixwiki"))).toBe(true);
    expect(await showing("Kingdom of Caphiria")).toEqual(ALL_READERS);
    // the moved page is stale under its new name, and its render was queued
    expect(jest.mocked(renderArticleViaMediaWiki).mock.calls.map(([, title]) => title)).toContain("Kingdom of Caphiria");

    await markWatchedVisited("db-watcher", "Kingdom of Caphiria");

    // the delete: gone from every reader, NOT_FOUND to a reader without deletedhistory, still there for the sysop
    await admin(sysop()).deletePage({ title: "Kingdom of Caphiria", reason: "spam" });
    expect(await showing("Kingdom of Caphiria")).toEqual([]);
    await expect(reader(signedOut()).getArticleHtml({ title: "Kingdom of Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(reader(newcomer()).getArticleHtml({ title: "Kingdom of Caphiria" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await reader(sysop()).getArticleHtml({ title: "Kingdom of Caphiria" })).toMatchObject({
      title: "Kingdom of Caphiria",
    });
    expect(jobs().at(-1)).toBe("delete Kingdom of Caphiria");
    expect(tables.wikiMirrorJob.rows.at(-1)?.payload).toMatchObject({ reason: "spam" });
    // the watcher had visited since the move: told of the delete too
    await settle();
    expect(notices()).toEqual(["clerk-watcher moved", "clerk-watcher deleted"]);
    await markWatchedVisited("db-watcher", "Kingdom of Caphiria");

    // the restore: back for every reader, rendered again, and told to the watcher
    jest.mocked(renderArticleViaMediaWiki).mockClear();
    await admin(sysop()).undeletePage({ title: "Kingdom of Caphiria", reason: "not spam" });
    expect(await showing("Kingdom of Caphiria")).toEqual(ALL_READERS);
    expect(await reader(signedOut()).getArticleHtml({ title: "Kingdom of Caphiria" })).toMatchObject({
      title: "Kingdom of Caphiria",
    });
    expect(jobs().at(-1)).toBe("undelete Kingdom of Caphiria");
    expect(tables.wikiMirrorJob.rows.at(-1)?.payload).toMatchObject({ reason: "not spam" });
    expect(jest.mocked(renderArticleViaMediaWiki).mock.calls.map(([, title]) => title)).toEqual([
      "Kingdom of Caphiria",
    ]);
    await settle();
    expect(notices()).toEqual(["clerk-watcher moved", "clerk-watcher deleted", "clerk-watcher restored"]);

    // and a protection: one protect job with every restriction, a lifted one with a null level
    await admin(sysop()).protectPage({
      title: "Kingdom of Caphiria",
      restrictions: [
        { action: "move", level: "sysop", expiresAt: null },
        { action: "edit", level: null, expiresAt: null },
      ],
      reason: "settled",
    });
    expect(jobs().at(-1)).toBe("protect Kingdom of Caphiria");
    expect(tables.wikiMirrorJob.rows.at(-1)?.payload).toMatchObject({
      restrictions: expect.arrayContaining([
        expect.objectContaining({ action: "move", level: "sysop" }),
        expect.objectContaining({ action: "edit", level: null }),
      ]),
    });
    expect(tables.wikiLog.rows.map((row) => `${row.logType}/${row.action}`)).toEqual([
      "move/move",
      "move/move",
      "delete/delete",
      "delete/restore",
      "protect/protect",
    ]);
  });
});
