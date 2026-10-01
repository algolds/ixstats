/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * F1: saves of one page run one at a time, and the edit-conflict check is part of the save. Two saves made at the
 * same moment on the same base: exactly one succeeds, the other gets the conflict (with the winner's text), and the
 * ledger holds the base plus the one revision. Runs the real `ArticleRepository.saveArticle` against a model of
 * PostgreSQL's transactions and locks (helpers/locking-wiki-db.ts); the same scenarios against the real database
 * were run on a scratch copy (see the F1 commit message).
 */
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { createLockingWikiDb } from "~/tests/helpers/locking-wiki-db";

let model = createLockingWikiDb();
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
