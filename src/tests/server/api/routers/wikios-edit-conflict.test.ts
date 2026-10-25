/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Edit conflicts through the editing router, over the in-memory WikiOS tables (Prisma mode) with the real repository:
 * the save makes the check itself, atomically (`expectedHeadRef`, see article-repository.ts), and a stale base comes
 * back as the edit conflict with the page as it is now.
 *
 * Plan 2026-10-24 Task 13 (A6): a revert and a rollback carry the head they read. An edit that lands between their
 * read and their save makes them an edit conflict, and nothing is saved. Rollback finds the last editor among the
 * page's live revisions only (an overwritten one is history), and WikiOS's own conflict writes (a trail dummy edit, a
 * talk note) are nobody's edit: never the last editor, never the end of that editor's run, but one below the run is
 * where the page goes back to.
 *
 * The saveWikitext cases are restored from f5bf69fa9^ (they ran on a mocked repository then).
 */
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
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  SYSTEM_OWNER_IDS: [],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
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
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";
import { CONFLICT_NOTICE_AUTHOR } from "~/lib/wiki-os/services/conflict-sides";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

type Row = Record<string, unknown>;

/** A signed-in member with a handle, holding the rollback right. */
const member = () =>
  createMockRouterContext({
    auth: { userId: "clerk-member" },
    user: {
      id: "db-member",
      clerkUserId: "clerk-member",
      handle: "member",
      role: { name: "user", level: 100 },
    },
  }) as never;
const editing = () => createCallerFactory(wikiosEditingRouter)(member());

const page = (title = "Vesperia") => tables.wikiArticle.rows.find((row) => row.title === title)!;
const revisionsOf = (title = "Vesperia") =>
  tables.wikiRevision.rows.filter((row) => row.articleId === page(title).id);
const newest = () =>
  [...revisionsOf()]
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .at(-1)!;

let clock = Date.parse("2026-10-24T11:00:00Z");
/** A revision of Vesperia, each one a second after the last; a live one is the page's text. */
function revision(over: Row): Row {
  clock += 1000;
  const wikitext = String(over.wikitext ?? "text");
  const row = tables.wikiRevision.insert({
    articleId: page().id,
    byteSize: wikitext.length,
    sha1: mwSha1Base36(wikitext),
    parked: false,
    origin: "wikios",
    authorId: null,
    createdAt: new Date(clock),
    ...over,
    wikitext,
  });
  if (!row.parked) page().wikitext = wikitext;
  return row;
}

/** What the save was handed as `expectedHeadRef`, save by save. */
function watchSaves(): Array<string | null | undefined> {
  const seen: Array<string | null | undefined> = [];
  const save = ArticleRepository.saveArticle.bind(ArticleRepository);
  jest.spyOn(ArticleRepository, "saveArticle").mockImplementation((input, authorId, authorName) => {
    seen.push(input.expectedHeadRef);
    return save(input, authorId, authorName);
  });
  return seen;
}

/** Gamma saves between the caller's read of the head and its write; returns Gamma's ref once it is written. */
function gammaSavesFirst(): { ref: () => string } {
  const save = ArticleRepository.saveArticle.bind(ArticleRepository);
  let gammaRef = "";
  jest
    .spyOn(ArticleRepository, "saveArticle")
    .mockImplementationOnce(async (input, authorId, authorName) => {
      const gamma = await save(
        { slug: "Vesperia", title: "Vesperia", wikitext: "Gamma's text", editSummary: "" },
        "db-gamma",
        "gamma"
      );
      gammaRef = toRevisionRef({ id: gamma.revisionId });
      return save(input, authorId, authorName);
    });
  return { ref: () => gammaRef };
}

beforeEach(() => {
  fake.reset();
  jest.restoreAllMocks();
  clock = Date.parse("2026-10-24T11:00:00Z");
  tables.user.seed(
    { id: "db-member", clerkUserId: "clerk-member", handle: "member" },
    { id: "db-gamma", clerkUserId: "clerk-gamma", handle: "gamma" }
  );
  tables.wikiUserGroup.seed({ userId: "db-member", group: "rollbacker" });
  tables.wikiArticle.insert({ title: "Vesperia", slug: "vesperia", wikitext: "" });
});

describeEachWikiosMode("wikios.saveWikitext edit conflicts", () => {
  it("compares a revision synced from MediaWiki by its rev_id", async () => {
    revision({ wikitext: "Synced text", author: "Bob", mwRevId: 4321, origin: "classic" });

    const stale = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "x",
      baseRevisionRef: "4320",
    });
    expect(stale).toMatchObject({ editConflict: true, currentRevisionRef: "4321" });

    const saved = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "x",
      baseRevisionRef: "4321",
    });
    expect(saved).toMatchObject({ success: true });
  });

  it("does not conflict with its own revision once the export worker has stamped its rev_id", async () => {
    revision({ wikitext: "Base", author: "Bob", mwRevId: 4000, origin: "classic" });
    const first = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: "4000",
    });
    if (!first.success) throw new Error("the first save conflicted");
    // The editor was opened while the head was known by its row id; the worker stamps it meanwhile.
    tables.wikiRevision.rows.find((row) => row.id === first.revisionId)!.mwRevId = 4321;

    const result = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine again",
      baseRevisionRef: first.revisionId,
    });

    expect(result).toMatchObject({ success: true });
  });

  it("conflicts when a page the editor believed new was created in the meantime", async () => {
    const head = revision({ wikitext: "Created by somebody else", author: "Bob" });

    const result = await editing().saveWikitext({ title: "Vesperia", wikitext: "Mine" });

    expect(result).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Created by somebody else",
      currentRevisionRef: head.id,
    });
    expect(revisionsOf()).toHaveLength(1);
  });

  it("saves a really new page, with no base and no revision", async () => {
    const result = await editing().saveWikitext({ title: "Brand New Page", wikitext: "Mine" });

    expect(result).toMatchObject({ success: true, title: "Brand New Page" });
    expect(revisionsOf("Brand New Page")).toHaveLength(1);
  });

  it("conflicts when the editor had a base but the page has no revision any more", async () => {
    // the page's only revision is overwritten history: it has no live revision
    revision({ wikitext: "Old", author: "Bob", parked: true });
    page().wikitext = "Kept text";

    const result = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: "rev-1",
    });

    expect(result).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Kept text",
      currentRevisionRef: null,
    });
  });

  it("saves on top of the current version when the editor resends the ref it was given ('Save anyway')", async () => {
    revision({ wikitext: "Base", author: "Bob" });
    revision({ wikitext: "Newer", author: "Carol" });

    const first = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: "rev-1",
    });
    if (first.success || first.currentRevisionRef === null) throw new Error("no conflict ref");

    const second = await editing().saveWikitext({
      title: "Vesperia",
      wikitext: "Mine",
      baseRevisionRef: first.currentRevisionRef,
    });
    expect(second).toMatchObject({ success: true });
    expect(page().wikitext).toBe("Mine");
  });

  it("lets any other failure of the save through", async () => {
    const head = revision({ wikitext: "Base", author: "Bob" });
    jest.spyOn(ArticleRepository, "saveArticle").mockRejectedValue(new Error("database down"));

    await expect(
      editing().saveWikitext({ title: "Vesperia", wikitext: "x", baseRevisionRef: String(head.id) })
    ).rejects.toThrow("database down");
  });
});

describeEachWikiosMode("wikios.rollback carries the head it read", () => {
  it.each([
    ["stamped", 4321, "4321"],
    ["not yet stamped", null, null],
  ])(
    "passes the head it read as expectedHeadRef (a head %s by the mirror)",
    async (_, mwRevId, ref) => {
      revision({ wikitext: "Bob's text", author: "Bob" });
      const head = revision({ wikitext: "Vandal's text", author: "Vandal", mwRevId });
      const seen = watchSaves();

      const result = await editing().rollback({ title: "Vesperia" });

      expect(result).toMatchObject({ success: true, title: "Vesperia" });
      expect(seen).toEqual([ref ?? head.id]);
      expect(page().wikitext).toBe("Bob's text");
    }
  );

  it("an edit between the read and the save turns the rollback into an edit conflict, nothing saved", async () => {
    revision({ wikitext: "Bob's text", author: "Bob" });
    revision({ wikitext: "Vandal's text", author: "Vandal" });
    const gamma = gammaSavesFirst();

    const result = await editing().rollback({ title: "Vesperia" });

    expect(result).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Gamma's text",
      currentRevisionRef: gamma.ref(),
    });
    // Gamma's edit is the only new revision, and stays the page's text
    expect(revisionsOf()).toHaveLength(3);
    expect(page().wikitext).toBe("Gamma's text");
  });

  it("rollback skips overwritten revisions when finding the last editor", async () => {
    const bob = revision({ wikitext: "Bob's text", author: "Bob" });
    revision({ wikitext: "Alice one", author: "Alice" });
    const head = revision({ wikitext: "Alice two", author: "Alice" });
    // Carol's classic edit lost to Alice's: history only, though saved last
    revision({ wikitext: "Carol's text", author: "Carol", origin: "classic", parked: true });
    const seen = watchSaves();

    await editing().rollback({ title: "Vesperia" });

    expect(newest()).toMatchObject({
      wikitext: "Bob's text",
      summary: `Rolled back edits by Alice to revision ${String(bob.id)}`,
    });
    expect(seen).toEqual([head.id]);
  });

  it("a trail dummy edit on top is nobody's edit: the rollback undoes the person's edits beneath it", async () => {
    const bob = revision({ wikitext: "Bob's text", author: "Bob" });
    revision({ wikitext: "Alice's text", author: "Alice" });
    const trail = revision({
      wikitext: "Alice's text",
      author: CONFLICT_NOTICE_AUTHOR,
      minor: true,
    });
    const seen = watchSaves();

    const result = await editing().rollback({ title: "Vesperia" });

    expect(result).toMatchObject({ success: true });
    expect(newest()).toMatchObject({
      wikitext: "Bob's text",
      summary: `Rolled back edits by Alice to revision ${String(bob.id)}`,
    });
    // the head it read is the trail itself
    expect(seen).toEqual([trail.id]);
  });

  it("a trail between one editor's edits does not end their run", async () => {
    revision({ wikitext: "Bob's text", author: "Bob" });
    revision({ wikitext: "Alice one", author: "Alice" });
    revision({ wikitext: "Alice one", author: CONFLICT_NOTICE_AUTHOR, minor: true });
    revision({ wikitext: "Alice two", author: "Alice" });

    await editing().rollback({ title: "Vesperia" });

    expect(page().wikitext).toBe("Bob's text");
  });

  it("a talk note below the editor's run is where the page goes back to: the note is kept", async () => {
    revision({ wikitext: "Welcome.", author: "Carol", origin: "classic", mwRevId: 700 });
    const note = revision({
      wikitext: "Welcome.\n\nYour edit was replaced.",
      author: CONFLICT_NOTICE_AUTHOR,
    });
    revision({ wikitext: "Vandalised.", author: "Vandal" });

    await editing().rollback({ title: "Vesperia" });

    expect(newest()).toMatchObject({
      wikitext: "Welcome.\n\nYour edit was replaced.",
      summary: `Rolled back edits by Vandal to revision ${String(note.id)}`,
    });
  });

  it("of several WikiOS writes below the run, the newest is where the page goes back to", async () => {
    revision({ wikitext: "Welcome.", author: "Carol", origin: "classic", mwRevId: 700 });
    revision({ wikitext: "Welcome.\n\nFirst note.", author: CONFLICT_NOTICE_AUTHOR });
    revision({
      wikitext: "Welcome.\n\nFirst note.\n\nSecond note.",
      author: CONFLICT_NOTICE_AUTHOR,
    });
    revision({ wikitext: "Vandalised.", author: "Vandal" });

    await editing().rollback({ title: "Vesperia" });

    expect(page().wikitext).toBe("Welcome.\n\nFirst note.\n\nSecond note.");
  });

  it("a note as the page's first revision is where the page goes back to as well", async () => {
    revision({ wikitext: "Your edit was replaced.", author: CONFLICT_NOTICE_AUTHOR });
    revision({ wikitext: "Vandalised.", author: "Vandal" });

    await editing().rollback({ title: "Vesperia" });

    expect(page().wikitext).toBe("Your edit was replaced.");
  });

  it.each([
    ["a classic editor named WikiOS", { origin: "classic", mwRevId: 800 }],
    ["a player whose handle is WikiOS", { authorId: "db-gamma" }],
  ])("%s is a person: their edit is the one rolled back", async (_, over) => {
    revision({ wikitext: "Bob's text", author: "Bob" });
    revision({ wikitext: "Their text", author: CONFLICT_NOTICE_AUTHOR, ...over });
    // a realm's own WikiOS write that happens to carry the same MediaWiki id is another wiki's revision
    tables.wikiArticle.insert({
      title: "Elsewhere",
      slug: "elsewhere",
      source: "realm-x",
      wikitext: "x",
    });
    tables.wikiRevision.insert({
      articleId: tables.wikiArticle.rows.find((row) => row.title === "Elsewhere")!.id,
      source: "realm-x",
      mwRevId: 800,
      wikitext: "x",
      byteSize: 1,
      author: CONFLICT_NOTICE_AUTHOR,
      authorId: null,
      origin: "wikios",
      parked: false,
    });

    await editing().rollback({ title: "Vesperia" });

    expect(newest()).toMatchObject({
      wikitext: "Bob's text",
      summary: expect.stringContaining(`Rolled back edits by ${CONFLICT_NOTICE_AUTHOR} to`),
    });
  });

  it("refuses when only WikiOS's own writes stand beside the one editor, and saves nothing", async () => {
    revision({ wikitext: "Alice's text", author: "Alice" });
    revision({ wikitext: "Alice's text", author: CONFLICT_NOTICE_AUTHOR, minor: true });
    const before = revisionsOf().length;

    await expect(editing().rollback({ title: "Vesperia" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "All revisions are by the same user, so there is nothing to roll back to.",
    });
    expect(revisionsOf()).toHaveLength(before);
  });

  it("refuses when every revision is WikiOS's own", async () => {
    revision({ wikitext: "Note one.", author: CONFLICT_NOTICE_AUTHOR });
    revision({ wikitext: "Note two.", author: CONFLICT_NOTICE_AUTHOR });

    await expect(editing().rollback({ title: "Vesperia" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });
});

describeEachWikiosMode("wikios.revertToRevision carries the head it read", () => {
  it.each([
    ["stamped", 4321, "4321"],
    ["not yet stamped", null, null],
  ])(
    "passes the head it read as expectedHeadRef (a head %s by the mirror)",
    async (_, mwRevId, ref) => {
      const old = revision({ wikitext: "Old text", author: "Bob" });
      const head = revision({ wikitext: "New text", author: "Carol", mwRevId });
      const seen = watchSaves();

      const result = await editing().revertToRevision({ title: "Vesperia", revid: String(old.id) });

      expect(result).toMatchObject({ success: true, title: "Vesperia" });
      expect(seen).toEqual([ref ?? head.id]);
      expect(page().wikitext).toBe("Old text");
    }
  );

  it("an edit between the read and the save turns the revert into an edit conflict, nothing saved", async () => {
    const old = revision({ wikitext: "Old text", author: "Bob" });
    revision({ wikitext: "New text", author: "Carol" });
    const gamma = gammaSavesFirst();

    const result = await editing().revertToRevision({ title: "Vesperia", revid: String(old.id) });

    expect(result).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Gamma's text",
      currentRevisionRef: gamma.ref(),
    });
    expect(revisionsOf()).toHaveLength(3);
    expect(page().wikitext).toBe("Gamma's text");
  });

  it("signs the revert with the summary given, else names the revision", async () => {
    const old = revision({ wikitext: "Old text", author: "Bob" });
    revision({ wikitext: "New text", author: "Carol" });

    await editing().revertToRevision({ title: "Vesperia", revid: String(old.id), summary: "Undo" });
    expect(newest()).toMatchObject({ summary: "Undo" });
    revision({ wikitext: "Newer text", author: "Carol" });
    await editing().revertToRevision({ title: "Vesperia", revid: String(old.id) });
    expect(newest()).toMatchObject({
      summary: `Reverted to revision ${String(old.id)} via WikiOS`,
    });
  });

  it("refuses a rollback of a page with a single revision", async () => {
    revision({ wikitext: "Only text", author: "Alice" });

    await expect(editing().rollback({ title: "Vesperia" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("still reverts to an overwritten revision: its text is kept in the history", async () => {
    const lost = revision({
      wikitext: "Lost text",
      author: "Carol",
      origin: "classic",
      parked: true,
    });
    revision({ wikitext: "Winning text", author: "Bob" });

    const result = await editing().revertToRevision({ title: "Vesperia", revid: String(lost.id) });

    expect(result).toMatchObject({ success: true });
    expect(page().wikitext).toBe("Lost text");
  });
});
