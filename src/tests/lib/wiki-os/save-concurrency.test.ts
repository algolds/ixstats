/** @jest-environment node */
/**
 * Concurrent saves of one page (WK-2, F1, F5), on a model of PostgreSQL's row and advisory locks: two (or five) saves
 * on one base let exactly one land and give the others the conflict with the winner's text and reference; creators
 * queue on the advisory lock; saves with no base still run one at a time, each on top of the one before. The same
 * through api.php's action=edit (editconflict, articleexists, last-write-wins without a base).
 */
const mockTransaction = (...args: Parameters<typeof model.db.$transaction>) =>
  model.db.$transaction(...args);
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { $transaction: (...args: unknown[]) => (mockTransaction as (...a: unknown[]) => unknown)(...args) },
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));

import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { createLockingWikiDb } from "~/tests/helpers/locking-wiki-db";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { type FakeWikiData, loggedIn, makeWikiDeps } from "./api-compat/harness";

let model = createLockingWikiDb();

const save = (wikitext: string, expectedHeadRef?: string | null, title = "Foo") =>
  ArticleRepository.saveArticle({ slug: title, title, wikitext, expectedHeadRef });

/** The settled results of saves started together: [fulfilled values, EditConflictErrors]. */
async function raced(saves: Array<Promise<{ revisionId: string }>>) {
  const settled = await Promise.allSettled(saves);
  const wins = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failures = settled.flatMap((result) => (result.status === "rejected" ? [result.reason as unknown] : []));
  return { wins, failures };
}

beforeEach(() => {
  jest.clearAllMocks();
  model = createLockingWikiDb();
});

const revisionRows = () => model.committed.revisions;

describe("two saves of one page at the same time on the same base", () => {
  it("lets exactly one succeed; the other gets the conflict, with the winner's text and revision", async () => {
    const { revisionId: base } = await save("base text", null);

    const { wins, failures } = await raced([save("first edit", base), save("second edit", base)]);

    expect(wins).toHaveLength(1);
    expect(failures).toHaveLength(1);
    const failure = failures[0];
    expect(failure).toBeInstanceOf(EditConflictError);
    const winner = wins[0]!;
    const winningText = revisionRows().find((row) => row.id === winner.revisionId)!.wikitext;
    expect((failure as EditConflictError).conflict).toEqual({
      currentWikitext: winningText,
      currentRevisionRef: winner.revisionId,
    });
    // the ledger holds the base and the winner's revision, nothing from the loser, and the article has the winner's text
    expect(revisionRows()).toHaveLength(2);
    expect(revisionRows().find((row) => row.id === winner.revisionId)).toMatchObject({
      wikitext: winningText,
      parentRevisionId: base,
    });
    expect(model.committed.articles[0]).toMatchObject({ wikitext: winningText });
    // one mirror job per committed revision: the loser's rolled back with it
    expect(model.committed.jobs).toHaveLength(2);
  });

  it("lets one of five succeed, whichever the scheduler runs first", async () => {
    const { revisionId: base } = await save("base text", null);

    const { wins, failures } = await raced(
      ["a", "b", "c", "d", "e"].map((name) => save(`edit ${name}`, base))
    );

    expect(wins).toHaveLength(1);
    expect(failures).toHaveLength(4);
    expect(failures.every((failure) => failure instanceof EditConflictError)).toBe(true);
    expect(revisionRows()).toHaveLength(2);
  });

  it("lets the editor who lost save on top of the winner's revision with the ref the conflict gave", async () => {
    const { revisionId: base } = await save("base text", null);
    const { failures } = await raced([save("first edit", base), save("second edit", base)]);
    const { currentRevisionRef } = (failures[0] as EditConflictError).conflict;

    const again = await save("merged edit", currentRevisionRef);

    expect(revisionRows().find((row) => row.id === again.revisionId)).toMatchObject({
      parentRevisionId: currentRevisionRef,
    });
    expect(revisionRows()).toHaveLength(3);
  });
});

describe("two creations of one title at the same time", () => {
  it("lets exactly one succeed: the other finds the page the first made", async () => {
    const { wins, failures } = await raced([save("mine", null, "Brand new"), save("yours", null, "Brand new")]);

    expect(wins).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toBeInstanceOf(EditConflictError);
    expect((failures[0] as EditConflictError).conflict.currentRevisionRef).toBe(wins[0]!.revisionId);
    expect(model.committed.articles).toHaveLength(1);
    expect(revisionRows()).toHaveLength(1);
    expect(revisionRows()[0]).toMatchObject({ parentRevisionId: null });
  });
});

describe("saves that make no check (a revert, a rollback)", () => {
  it("still run one at a time: each is made on top of the one before, none on the same parent", async () => {
    const { revisionId: base } = await save("base text", null);

    const { wins, failures } = await raced([save("revert one"), save("revert two"), save("revert three")]);

    expect(failures).toEqual([]);
    expect(wins).toHaveLength(3);
    const parents = revisionRows().map((row) => row.parentRevisionId);
    expect(new Set(parents).size).toBe(parents.length); // a chain: no two revisions share a parent
    expect(parents.filter((parent) => parent === null)).toHaveLength(1);
    expect(parents).toContain(base);
  });
});

describe("the model itself: without the locks the same scenarios go wrong (the tests above can fail)", () => {
  beforeEach(() => {
    model = createLockingWikiDb({ locks: false });
  });

  it("lets both saves on one base succeed, the second silently overwriting the first", async () => {
    const { revisionId: base } = await save("base text", null);

    const { wins, failures } = await raced([save("first edit", base), save("second edit", base)]);

    expect(wins).toHaveLength(2);
    expect(failures).toEqual([]);
    const parents = revisionRows().filter((row) => row.parentRevisionId === base);
    expect(parents).toHaveLength(2); // a fork: both claim the base as their parent
  });
});

describe("through api.php", () => {
  type Body = Record<string, any>;

  const data = (): FakeWikiData => ({
    pages: [{ pageId: 1, title: "Alpha" }],
    revisions: [
      { revId: 101, page: "Alpha", timestamp: "2026-01-01T10:00:00Z", user: "Heku", content: "good text" },
    ],
  });

  /** The page as WikiOS holds it: one revision, stamped with MediaWiki's id 101 (its api.php `revid`, and its reference). */
  function seedAlpha() {
    model.committed.articles.push({
      id: "art-alpha",
      source: "ixwiki",
      title: "Alpha",
      wikitext: "good text",
      status: "PUBLISHED",
      protectionLevel: "ALL",
      protectionExpiry: null,
    });
    model.committed.revisions.push({
      id: "rev-alpha-1",
      articleId: "art-alpha",
      mwRevId: 101,
      parked: false,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      wikitext: "good text",
      byteSize: 9,
    });
  }

  async function setup() {
    const wiki = await makeWikiDeps(data(), {
      // the real save; the harness answers the module's own reads
      services: {
        saveWikitext: async (ctx, save) => ({ revisionRowId: (await commitWikitextSave(ctx, save)).revisionId }),
      },
    });
    const token = await loggedIn(wiki.bot);
    const edit = (params: Record<string, string>) =>
      wiki.bot.post({ action: "edit", token, formatversion: "2", ...params }) as Promise<Body>;
    return { edit };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    model = createLockingWikiDb();
    seedAlpha();
  });

  const articleText = () => model.committed.articles[0]!.wikitext;
  const revisions = () => model.committed.revisions;

  describe("two appendtext edits at the same moment, neither naming a base", () => {
    it("lands exactly one; the other gets editconflict and changes nothing", async () => {
      const { edit } = await setup();

      const [first, second] = await Promise.all([
        edit({ title: "Alpha", appendtext: "\nfirst" }),
        edit({ title: "Alpha", appendtext: "\nsecond" }),
      ]);

      const results = [first, second];
      const landed = results.filter((body) => body.edit?.result === "Success");
      const refused = results.filter((body) => body.error);
      expect(landed).toHaveLength(1);
      expect(refused).toHaveLength(1);
      expect(refused[0]!.error.code).toBe("editconflict");
      // no update was lost: the text is the base plus exactly the winner's append, and there is one new revision
      expect(["good text\nfirst", "good text\nsecond"]).toContain(articleText());
      expect(revisions()).toHaveLength(2);
      expect(model.committed.jobs).toHaveLength(1);
    });
  });

  describe("a whole new text without a base", () => {
    it("is the last write wins, as in MediaWiki: both land", async () => {
      const { edit } = await setup();

      const bodies = await Promise.all([
        edit({ title: "Alpha", text: "whole one" }),
        edit({ title: "Alpha", text: "whole two" }),
      ]);

      expect(bodies.every((body) => body.edit?.result === "Success")).toBe(true);
      expect(revisions()).toHaveLength(3);
    });
  });

  describe("two createonly edits of a page that does not exist, at the same moment", () => {
    it("lands one; the other gets articleexists", async () => {
      const { edit } = await setup();

      const bodies = await Promise.all([
        edit({ title: "Beta", text: "mine", createonly: "" }),
        edit({ title: "Beta", text: "yours", createonly: "" }),
      ]);

      expect(bodies.filter((body) => body.edit?.result === "Success")).toHaveLength(1);
      const refused = bodies.filter((body) => body.error);
      expect(refused).toHaveLength(1);
      expect(refused[0]!.error.code).toBe("articleexists");
      expect(model.committed.articles.filter((row) => row.title === "Beta")).toHaveLength(1);
    });
  });
});
