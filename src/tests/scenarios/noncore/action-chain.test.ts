/** @jest-environment node */
/**
 * A nation's public actions become a story chain on the wiki. Aurelia's owner Ana commits a directive: it declares one
 * public activity row (a retry writes nothing more) that says only what the public record says, and reaches the Home
 * feed and the Following feed of Ben, whose nation follows Aurelia. Ana's ThinkPages posts link her nation's public
 * actions: never another nation's, a private one, more than the cap, or from a player with no nation. She builds a
 * chain of two posts and submits it to a wiki page she may edit. Neither she nor a member without the realm's board
 * power may review it; an officer with it approves, and of two approvals racing only one wins. The approval queues
 * Ana's achievement check and writes the chain's section to the wiki as Aurelia, its player text kept to one line; a
 * failed write leaves the approval standing for the cron to retry. When Ana abandons the directive its row turns
 * private: it leaves both feeds and the activity cards, a post whose only link it was can no longer join a chain, and a
 * chain approved after that writes no section about it.
 *
 * Folds directive-activity, activity-hooks, activities-feed-visibility, activities-following-visibility, the
 * action-links module tests (links, chains, wiki-sync), actionLinks (its gates; the input bounds are in
 * noncore-router-gates), use-thread-action-cards and lib/action-links: the parser of the player text both write
 * paths read keeps what reaches the wiki on its line with no markup, never cuts a token out of an attribute (which
 * would let the rest of it escape as HTML), renders cards only for tokens in text runs (I7), and leaves no token
 * behind a removal.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getRecentChanges: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/modules/thinkpages-forum", () => ({
  ...jest.requireActual("~/server/modules/thinkpages-forum"),
  latestPublicThreadPreviews: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/wiki-os/core", () => ({
  ...jest.requireActual("~/lib/wiki-os/core"),
  ArticleRepository: { findBySlug: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({ getHeadRevisionRefs: jest.fn() }));
jest.mock("~/lib/wiki-os/services/edit-service", () => ({
  assertCanEditArticle: jest.fn(),
  commitWikitextSave: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import {
  chainWikiSection,
  isActivityId,
  MAX_ACTIONS_PER_POST,
  parseTextActionTokens,
  splitActionTokens,
  withoutActionTokens,
} from "~/lib/action-links";
import {
  declareDirectiveActivity,
  withdrawDirectiveActivity,
} from "~/lib/activity/directive-activity";
import { ActivityHooks } from "~/lib/activity/hooks";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { assertCanEditArticle, commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { actionLinksRouter } from "~/server/api/routers/actionLinks";
import { activitiesFeedGlobalRouter } from "~/server/api/routers/activities/feed/global";
import { activitiesFeedPersonalRouter } from "~/server/api/routers/activities/feed/personal";
import { createCallerFactory } from "~/server/api/trpc";
import { syncPostActionLinks } from "~/server/modules/action-links";
import { syncPendingChainWikis } from "~/server/modules/action-links/wiki-sync";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner, type Owner } from "~/tests/helpers/nation-world";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const links = createCallerFactory(actionLinksRouter);
const globalFeed = createCallerFactory(activitiesFeedGlobalRouter);
const personalFeed = createCallerFactory(activitiesFeedPersonalRouter);

const DIRECTIVE = {
  intentId: "int1",
  countryId: "aurelia",
  countryName: "Aurelia",
  userId: "ana-clerk",
  goal: "Create industrial manufacturing jobs",
  tier: "moderate",
  category: "economy",
};

let db: MemoryPrisma;
let ana: Owner;
let ben: Owner;
let ola: Owner;
let nils: Owner;

/** A public (or private) activity row of `countryId`, as the event hooks write them. */
const action = (id: string, countryId: string, title: string, visibility = "public") =>
  db.activityFeed.create({
    data: {
      id,
      type: "diplomatic",
      category: "diplomacy",
      title,
      description: title,
      countryId,
      visibility,
      priority: "medium",
    },
  });

const post = (postRef: string, countryId: string | null, body: string) =>
  syncPostActionLinks(db as never, { postSource: "native", postRef, countryId, body });

const homeIds = async () =>
  (
    await globalFeed(createMockCallerContext({ db, auth: null, user: null })).getGlobalFeed({
      filter: "all",
      limit: 20,
    })
  ).activities.map((a: { id: string }) => a.id);
const followingIds = async () =>
  (await personalFeed(asOwner(db as never, ben)).getFollowingFeed({ limit: 20 })).activities.map(
    (a: { id: string }) => a.id
  );

beforeEach(async () => {
  for (const level of ["log", "info", "warn", "error"] as const) {
    jest.spyOn(console, level).mockImplementation(() => undefined);
  }
  jest.mocked(queueAchievementCheck).mockClear();
  jest.mocked(assertCanEditArticle).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(commitWikitextSave)
    .mockReset()
    .mockResolvedValue({} as never);
  jest
    .mocked(ArticleRepository.findBySlug)
    .mockReset()
    .mockResolvedValue({ wikitext: "Intro." } as never);
  jest
    .mocked(getHeadRevisionRefs)
    .mockReset()
    .mockResolvedValue({ revisionRef: "rev-9", revisionRefs: ["rev-9"] } as never);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  for (const [id, name] of [
    ["aurelia", "Aurelia"],
    ["bastia", "Bastia"],
    ["olania", "Olania"],
  ] as const) {
    await addNation(db as never, { id, name, baselineDate: new Date() });
  }
  ana = await addOwner(db as never, "ana", "aurelia");
  ben = await addOwner(db as never, "ben", "bastia");
  ola = await addOwner(db as never, "ola", "olania");
  nils = await addOwner(db as never, "nils", null);
  await db.countryFollow.create({
    data: { followerCountryId: "bastia", followedCountryId: "aurelia" },
  });
  await db.realmOfficer.create({
    data: {
      realmId: "default",
      userId: ola.clerkUserId,
      title: "Archivist",
      powers: ["board"],
      appointedBy: "system",
    },
  });
});
afterEach(() => jest.restoreAllMocks());

it("turns Ana's linked posts into a reviewed chain on the wiki, written once by one approval", async () => {
  // The directive's row: one public row, idempotent, saying only what the public record says
  expect(await declareDirectiveActivity(db as never, DIRECTIVE)).toBe("dir-int1");
  expect(await declareDirectiveActivity(db as never, DIRECTIVE)).toBe("dir-int1");
  expect(await db.activityFeed.count({ where: { id: "dir-int1" } })).toBe(1);
  expect(await db.activityFeed.findUniqueOrThrow({ where: { id: "dir-int1" } })).toMatchObject({
    visibility: "public",
    description: "Aurelia declared a moderate directive in economy.",
  });
  await action("pact-1", "aurelia", "Signed the Northern Pact");
  await action("talks-1", "aurelia", "Secret talks", "private");
  await action("bastia-1", "bastia", "Bastian census");
  expect(await homeIds()).toEqual(expect.arrayContaining(["dir-int1", "pact-1"]));
  expect(await homeIds()).not.toContain("talks-1");
  expect(await followingIds()).toEqual(expect.arrayContaining(["dir-int1", "pact-1"]));

  // Only her nation's public actions, up to the cap, from a nation's post
  const tooMany = Array.from(
    { length: MAX_ACTIONS_PER_POST + 1 },
    (_, i) => `[ixaction=a${i}]`
  ).join(" ");
  const refusals = await Promise.all(
    (
      [
        ["another nation's action", "aurelia", "[ixaction=bastia-1]"],
        ["a private action", "aurelia", "[ixaction=talks-1]"],
        ["more than the cap", "aurelia", tooMany],
        ["a player with no nation", null, "[ixaction=pact-1]"],
      ] as const
    ).map(async ([why, countryId, body]) => [
      why,
      await post("bad", countryId, body).then(
        () => "linked",
        (e: Error) => e.message
      ),
    ])
  );
  expect(refusals).toEqual([
    ["another nation's action", expect.stringMatching(/not one of your nation's public actions/)],
    ["a private action", expect.stringMatching(/not one of your nation's public actions/)],
    ["more than the cap", expect.stringMatching(/at most/)],
    ["a player with no nation", expect.stringMatching(/Only a nation's posts/)],
  ]);
  await post("p1", "aurelia", "<p>Jobs first: [ixaction=dir-int1]</p>");
  await post("p2", "aurelia", "<p>Signed today: [ixaction=pact-1]</p>");
  expect(await db.postActionLink.count({ where: { postRef: "bad" } })).toBe(0);

  // The chain: hers to build and submit to a page she may edit; a nation-less player builds none
  const anas = links(asOwner(db as never, ana));
  await expect(
    links(asOwner(db as never, nils)).createChain({ title: "Pact" })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const { id: chainId } = await anas.createChain({ title: "Pact\n== Fake ==\n__NOTOC__" });
  for (const postRef of ["p1", "p2"])
    await anas.addPostToChain({ storylineId: chainId, postSource: "native", postRef });
  jest.mocked(assertCanEditArticle).mockRejectedValueOnce(new TRPCError({ code: "FORBIDDEN" }));
  await expect(
    anas.submitChain({ storylineId: chainId, wikiPageTitle: "Main Page" })
  ).rejects.toBeInstanceOf(TRPCError);
  expect((await db.storyline.findUniqueOrThrow({ where: { id: chainId } })).status).toBe("open");
  await anas.submitChain({ storylineId: chainId, wikiPageTitle: "northern pact" });
  expect(await db.storyline.findUniqueOrThrow({ where: { id: chainId } })).toMatchObject({
    status: "submitted",
    wikiPageTitle: "Northern pact",
  });

  // Not Ana, not a member without the board power; the officer's approval wins once
  const approve = { storylineId: chainId, approve: true };
  await expect(anas.reviewChain(approve)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(links(asOwner(db as never, nils)).reviewChain(approve)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const olas = links(asOwner(db as never, ola));
  const outcomes = await Promise.allSettled([olas.reviewChain(approve), olas.reviewChain(approve)]);
  expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
  expect(await db.storyline.findUniqueOrThrow({ where: { id: chainId } })).toMatchObject({
    status: "approved",
    reviewedBy: ola.id,
  });
  expect(queueAchievementCheck).toHaveBeenCalledTimes(1);
  expect(queueAchievementCheck).toHaveBeenCalledWith(ana.clerkUserId, "aurelia");

  // Written once, as Aurelia, after the page's text, against its head; the player's title stays on one line
  expect(commitWikitextSave).toHaveBeenCalledTimes(1);
  const [author, save] = jest.mocked(commitWikitextSave).mock.calls[0]!;
  expect(author).toEqual({});
  expect(save).toMatchObject({
    title: "Northern pact",
    expectedHeadRef: "rev-9",
    authorLabel: "Aurelia",
  });
  const section = save.wikitext.split(`<!-- story-chain:${chainId} -->\n`)[1]!.split("\n");
  expect(save.wikitext.startsWith("Intro.\n\n")).toBe(true);
  expect(section[0]).toMatch(/^== Story chain: Pact == Fake == NOTOC ==$/);
  expect(section.filter((line) => line.startsWith("* "))).toHaveLength(2);
  expect(
    (await db.storyline.findUniqueOrThrow({ where: { id: chainId } })).wikiSyncedAt
  ).toBeInstanceOf(Date);
});

it("drops an abandoned directive from the feeds, the cards, new chains and their wiki sections", async () => {
  await declareDirectiveActivity(db as never, DIRECTIVE);
  await action("pact-1", "aurelia", "Signed the Northern Pact");
  await post("p1", "aurelia", "[ixaction=dir-int1]");
  await post("p2", "aurelia", "[ixaction=dir-int1]");
  const anas = links(asOwner(db as never, ana));
  const { id: before } = await anas.createChain({ title: "Reforms" });
  await anas.addPostToChain({ storylineId: before, postSource: "native", postRef: "p1" });
  await anas.submitChain({ storylineId: before, wikiPageTitle: "Aurelian reforms" });

  await withdrawDirectiveActivity(db as never, "int1");

  expect(await homeIds()).not.toContain("dir-int1");
  expect(await followingIds()).not.toContain("dir-int1");
  const cards = await links(createMockCallerContext({ db, auth: null, user: null })).activityCards({
    ids: ["dir-int1", "pact-1"],
  });
  expect(JSON.stringify(cards)).not.toContain("dir-int1");
  expect(JSON.stringify(cards)).toContain("pact-1");
  // A post whose only link was the directive joins no chain
  const { id: after } = await anas.createChain({ title: "Later" });
  await expect(
    anas.addPostToChain({ storylineId: after, postSource: "native", postRef: "p2" })
  ).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  // The chain approved after the withdrawal writes no section, and is marked done
  await links(asOwner(db as never, ola)).reviewChain({ storylineId: before, approve: true });
  expect(commitWikitextSave).not.toHaveBeenCalled();
  expect(
    (await db.storyline.findUniqueOrThrow({ where: { id: before } })).wikiSyncedAt
  ).toBeInstanceOf(Date);
});

it("keeps an approval whose wiki write failed, and the cron writes it later", async () => {
  await action("pact-1", "aurelia", "Signed the Northern Pact");
  await post("p1", "aurelia", "[ixaction=pact-1]");
  const anas = links(asOwner(db as never, ana));
  const { id } = await anas.createChain({ title: "Pact" });
  await anas.addPostToChain({ storylineId: id, postSource: "native", postRef: "p1" });
  await anas.submitChain({ storylineId: id, wikiPageTitle: "Northern Pact" });

  jest.mocked(commitWikitextSave).mockRejectedValueOnce(new Error("wiki down"));
  await links(asOwner(db as never, ola)).reviewChain({ storylineId: id, approve: true });
  expect(await db.storyline.findUniqueOrThrow({ where: { id } })).toMatchObject({
    status: "approved",
    wikiSyncedAt: null,
  });

  // A page that exists but cannot be read is never overwritten by the section alone
  jest.mocked(ArticleRepository.findBySlug).mockResolvedValueOnce(null);
  expect(await syncPendingChainWikis()).toEqual({ synced: 0, failed: 1 });
  expect(await syncPendingChainWikis()).toEqual({ synced: 1, failed: 0 });
  expect(commitWikitextSave).toHaveBeenCalledTimes(2);
  expect((await db.storyline.findUniqueOrThrow({ where: { id } })).wikiSyncedAt).toBeInstanceOf(
    Date
  );

  // An activity producer never throws into the action that triggered it
  jest.spyOn(db.activityFeed, "create").mockRejectedValueOnce(new Error("db down"));
  await expect(
    ActivityHooks.Diplomatic.onAllianceFormed("aurelia", "Pact", "economic")
  ).resolves.toBeUndefined();
});

it("skips, stamps and warns about a chain whose page is a MediaWiki: page: classic is its authority (A8)", async () => {
  await action("pact-1", "aurelia", "Signed the Northern Pact");
  await post("p1", "aurelia", "[ixaction=pact-1]");
  const anas = links(asOwner(db as never, ana));
  const { id } = await anas.createChain({ title: "Pact" });
  await anas.addPostToChain({ storylineId: id, postSource: "native", postRef: "p1" });
  // submitted before MediaWiki: pages were refused at submit (the gate is mocked open here)
  await anas.submitChain({ storylineId: id, wikiPageTitle: "MediaWiki:Sidebar" });
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

  await links(asOwner(db as never, ola)).reviewChain({ storylineId: id, approve: true });

  expect(commitWikitextSave).not.toHaveBeenCalled();
  expect(getHeadRevisionRefs).not.toHaveBeenCalled();
  expect((await db.storyline.findUniqueOrThrow({ where: { id } })).wikiSyncedAt).toBeInstanceOf(
    Date
  );
  expect(warn).toHaveBeenCalledWith(expect.stringContaining(`story chain ${id}`));
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("MediaWiki:Sidebar"));
  // stamped: the cron never picks it up again
  expect(await syncPendingChainWikis()).toEqual({ synced: 0, failed: 0 });
  warn.mockRestore();
});

it("names a player's activity by handle, else forum name, never by their old wiki name", async () => {
  await db.user.update({
    where: { id: "ana" },
    data: { handle: "ana_h", forumUsername: "AnaF" },
  });
  await db.user.update({ where: { id: "nils" }, data: { forumUsername: "NilsF" } });
  for (const [userId, name] of [
    ["ana", "Ana Wiki"],
    ["nils", "Nils Wiki"],
  ] as const) {
    await db.wikiNameClaim.create({
      data: {
        userId,
        name,
        status: "APPROVED",
        origin: "CONVERSION",
        requestedById: userId,
        decidedAt: new Date(),
      },
    });
  }
  for (const [id, owner] of [
    ["ana-row", ana],
    ["nils-row", nils],
  ] as const) {
    await db.activityFeed.create({
      data: {
        id,
        type: "social",
        category: "social",
        title: id,
        description: id,
        userId: owner.clerkUserId,
        visibility: "public",
        priority: "medium",
      },
    });
  }
  const { activities } = await globalFeed(
    createMockCallerContext({ db, auth: null, user: null })
  ).getGlobalFeed({ filter: "all", limit: 20 });
  const names = new Map(
    activities.map((a: { id: string; user: { name?: string } }) => [a.id, a.user.name])
  );
  expect([names.get("ana-row"), names.get("nils-row")]).toEqual(["ana_h", "NilsF"]);
});

describe("the action-token parser", () => {
  describe("chainWikiSection", () => {
    it("strips wikitext control characters from player text", () => {
      const text = chainWikiSection({
        title: "Bad ]] [[Title",
        approvedIxTime: 0,
        entries: [{ title: "x]] {{y}}", type: "t", ixTime: 0, url: "https://x" }],
      });
      expect(text).not.toMatch(/\]\]|\[\[|\{\{|\}\}/);
    });

    it("keeps newline and inline-markup injection on the heading's single line", () => {
      const text = chainWikiSection({
        title: "x\n== Fake ==\n__NOTOC__ ~~~~ '''bold &#91; '<'",
        approvedIxTime: 0,
        entries: [{ title: "a\n* b", type: "t\n== T ==", ixTime: 0, url: "https://x" }],
      });
      const lines = text.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("== Story chain: x == Fake == NOTOC bold #91; ==");
      expect([lines[0], lines[2]].join("\n")).not.toMatch(/__|~~~|''|&/);
      expect(lines[2]).toMatch(/^\* .*: \[https:\/\/x a \* b\] \(t == T ==\)$/);
    });
  });

  describe("splitActionTokens", () => {
    it("never cuts a token inside an attribute value", () => {
      const title = '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>';
      const href =
        '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>';
      expect(splitActionTokens(title)).toEqual([{ kind: "html", text: title }]);
      expect(splitActionTokens(href)).toEqual([{ kind: "html", text: href }]);
    });
  });

  describe("parseTextActionTokens (I7)", () => {
    it("lists the distinct ids in text runs only, in first-seen order", () => {
      const html =
        '<p title="[ixaction=attr]">[ixaction=b] then [ixaction=a]</p><!-- [ixaction=c] -->[ixaction=b]';
      expect(parseTextActionTokens(html)).toEqual(["b", "a"]);
    });
  });

  describe("withoutActionTokens", () => {
    it("removes every token, including one formed by a removal", () => {
      expect(withoutActionTokens("a [ixaction=x] b [ixaction=[ixaction=y]z]")).toBe("a  b ");
    });
  });
  describe("activity ids", () => {
    it.each([
      ["dir-abc_1", true],
      ["a".repeat(65), false],
      ["<script>", false],
      ["a]b", false],
    ])("isActivityId(%j) is %s", (value, expected) => {
      expect(isActivityId(value)).toBe(expected);
    });
  });
});
