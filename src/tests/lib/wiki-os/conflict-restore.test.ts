/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Plan 2026-10-24 Task 10: "Restore my text" and the admin conflict log. An author whose text a collision overwrote
 * brings it back with one click: a new edit on the page's current head, through the one save path (permissions, the
 * edit-conflict check, the mirror job), never a rewrite of history. Who may restore, and what, is read from the conflict
 * row's overwritten list (never from a revision's park reason): its author, by account or by an approved claim of the
 * classic name it was saved under; only a text revision WikiOS has. The admin log lists every row readably.
 *
 * Real conflict log, edit service, permissions and ArticleRepository over the in-memory WikiOS tables (Prisma mode).
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

import { db } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosEditingRouter } from "~/server/api/routers/wikios/editing";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { toRevisionRef } from "~/lib/wiki-os/core/domain-types";
import {
  conflictKey,
  type ChangeAction,
  type ChangeAuthor,
  type PageChange,
  type WikiSide,
} from "~/lib/wiki-os/services/conflict-rule";
import { markNotified, recordConflict, shortConflictId } from "~/lib/wiki-os/services/conflict-log";
import {
  overwrittenRestorable,
  restoreOverwrittenText,
} from "~/lib/wiki-os/services/conflict-restore";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

type Row = Record<string, unknown>;

const UNAVAILABLE = { state: "unavailable" };
const EDIT_HREF = "/wiki/Caphiria?action=edit";

/** A signed-in member (or an administrator) as the routers see them. */
const as = (name: string, level = 100) =>
  createMockRouterContext({
    auth: { userId: `clerk-${name}` },
    user: {
      id: `db-${name}`,
      clerkUserId: `clerk-${name}`,
      handle: name,
      role: { name: level <= 10 ? "admin" : "user", level },
    },
  }) as never;
const signedOut = () => createMockRouterContext({ auth: null, user: null }) as never;
const editing = (ctx: never) => createCallerFactory(wikiosEditingRouter)(ctx);
const utilities = (ctx: never) => createCallerFactory(wikiosUtilitiesRouter)(ctx);

const page = () => tables.wikiArticle.rows.find((row) => row.title === "Caphiria")!;
const revisionsOf = () => tables.wikiRevision.rows.filter((row) => row.articleId === page().id);
const headOf = () =>
  revisionsOf()
    .filter((row) => !row.parked)
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime())
    .at(-1)!;
const revisionRow = (id: unknown) => tables.wikiRevision.rows.find((row) => row.id === id)!;
const conflictRow = (id: string) => tables.wikiConflict.rows.find((row) => row.id === id)!;
const revisionJobs = () =>
  tables.wikiMirrorJob.rows.filter((job) => job.kind === "revision").map((job) => job.title);

const author = (over: Partial<ChangeAuthor>): ChangeAuthor => ({
  userId: null,
  classicName: null,
  ip: null,
  label: null,
  ...over,
});
const change = (
  side: WikiSide,
  ref: string,
  by: ChangeAuthor,
  action: ChangeAction = "edit"
): PageChange => ({ side, action, ref, at: new Date("2026-10-24T12:00:00Z"), author: by });

let clock = Date.parse("2026-10-24T11:00:00Z");
/** A revision of Caphiria, each one a second after the last. */
function revision(over: Row): Row {
  clock += 1000;
  const wikitext = String(over.wikitext ?? "text");
  return tables.wikiRevision.insert({
    articleId: page().id,
    byteSize: wikitext.length,
    sha1: mwSha1Base36(wikitext),
    parked: false,
    origin: "wikios",
    createdAt: new Date(clock),
    ...over,
    wikitext,
  });
}

/** Makes `row` the page's head: its text is the page's. */
function makeHead(row: Row): Row {
  page().wikitext = row.wikitext;
  return row;
}

async function collide(winner: PageChange, overwritten: PageChange[]): Promise<string> {
  const recorded = await recordConflict(db, {
    source: "ixwiki",
    articleId: page().id as string,
    title: "Caphiria",
    verdict: {
      winner,
      overwritten,
      incomingWins: true,
      key: conflictKey("ixwiki", page().id as string, winner.ref),
    },
    baseRef: "100",
  });
  return recorded.id;
}

/**
 * Alpha's WikiOS save lost to Bob's later classic edit (revision 101, now the head): kept as history only, under
 * Bob's ref.
 */
async function alphaLostToBob(alphaOver: Row = {}) {
  const lost = revision({
    wikitext: "Alpha's text",
    author: "alpha",
    authorId: "db-alpha",
    parked: true,
    parkReason: "overwritten:101",
    ...alphaOver,
  });
  const bob = makeHead(
    revision({ wikitext: "Bob's text", author: "Bob", mwRevId: 101, origin: "classic" })
  );
  const conflictId = await collide(change("classic", "101", author({ classicName: "Bob" })), [
    change("wikios", lost.id as string, author({ userId: "db-alpha", label: "alpha" })),
  ]);
  return { lost, bob, conflictId };
}

/** Carol's classic edit (revision 102) lost to Beta's later WikiOS save, now the head. */
async function carolLostToBeta() {
  const lost = revision({
    wikitext: "Carol's text",
    author: "Carol",
    mwRevId: 102,
    origin: "classic",
    parked: true,
  });
  const beta = makeHead(revision({ wikitext: "Beta's text", author: "beta", authorId: "db-beta" }));
  lost.parkReason = `overwritten:${String(beta.id)}`;
  const conflictId = await collide(
    change("wikios", beta.id as string, author({ userId: "db-beta", label: "beta" })),
    [change("classic", "102", author({ classicName: "Carol" }))]
  );
  return { lost, beta, conflictId };
}

beforeEach(() => {
  fake.reset();
  jest.restoreAllMocks();
  clock = Date.parse("2026-10-24T11:00:00Z");
  tables.user.seed(
    { id: "db-alpha", clerkUserId: "clerk-alpha", handle: "alpha" },
    { id: "db-beta", clerkUserId: "clerk-beta", handle: "beta" },
    { id: "db-gamma", clerkUserId: "clerk-gamma", handle: "gamma" },
    { id: "db-admin", clerkUserId: "clerk-admin", handle: "admin" }
  );
  tables.wikiArticle.insert({ title: "Caphiria", slug: "caphiria", wikitext: "Founded." });
  makeHead(revision({ wikitext: "Founded.", author: "Founder", mwRevId: 100, origin: "classic" }));
});

describeEachWikiosMode("restoreOverwrittenText", () => {
  it("restores the author's overwritten text as a new edit on the current head", async () => {
    const { lost, bob, conflictId } = await alphaLostToBob();

    const result = await restoreOverwrittenText(as("alpha"), {
      conflictId,
      ref: lost.id as string,
    });

    expect(result).toEqual({ success: true, revisionId: expect.any(String) });
    const restored = revisionRow(result.success ? result.revisionId : "");
    expect(headOf().id).toBe(restored.id);
    expect(restored).toMatchObject({
      wikitext: "Alpha's text",
      authorId: "db-alpha",
      summary: `Restored my text replaced in conflict ${shortConflictId(conflictId)}`,
      parentRevisionId: bob.id,
      parked: false,
    });
    expect(page().wikitext).toBe("Alpha's text");
    // the one save path: its mirror job goes out like any edit's
    expect(revisionJobs()).toEqual(["Caphiria"]);
    // nothing is rewritten: the overwritten revision stays history with its text, the row keeps its winner
    expect(revisionRow(lost.id)).toMatchObject({ parked: true, wikitext: "Alpha's text" });
    expect(conflictRow(conflictId)).toMatchObject({ winnerRef: "101" });
  });

  it("an author restores a classic edit through an approved claim of the name it was saved under", async () => {
    const { conflictId } = await carolLostToBeta();
    tables.wikiNameClaim.seed({ userId: "db-alpha", name: "Carol" });
    // an old park dated after the head: history only, never the head the restore saves on
    revision({ wikitext: "An old park.", author: "Old", origin: "classic", parked: true });

    const result = await restoreOverwrittenText(as("alpha"), { conflictId, ref: "102" });

    expect(result.success).toBe(true);
    expect(headOf()).toMatchObject({ wikitext: "Carol's text", authorId: "db-alpha" });
  });

  it.each(["PENDING", "REVOKED", "REJECTED"])(
    "a %s claim of the classic name restores nothing (FORBIDDEN)",
    async (status) => {
      const { conflictId } = await carolLostToBeta();
      tables.wikiNameClaim.seed({ userId: "db-alpha", name: "Carol", status });
      const before = revisionsOf().length;

      await expect(
        restoreOverwrittenText(as("alpha"), { conflictId, ref: "102" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(revisionsOf()).toHaveLength(before);
    }
  );

  it("refuses someone who did not write it (FORBIDDEN)", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const before = revisionsOf().length;

    await expect(
      restoreOverwrittenText(as("beta"), { conflictId, ref: lost.id as string })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(revisionsOf()).toHaveLength(before);
    expect(page().wikitext).toBe("Bob's text");
  });

  it("refuses a classic edit by a name nobody holds, and one whose editor MediaWiki hides", async () => {
    const { conflictId } = await carolLostToBeta();
    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: "102" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // a name someone else holds is theirs, not the caller's
    tables.wikiNameClaim.seed({ userId: "db-gamma", name: "Carol" });
    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: "102" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    tables.wikiNameClaim.rows.find((claim) => claim.userId === "db-gamma")!.status = "REVOKED";

    tables.wikiNameClaim.seed({ userId: "db-alpha", name: "Carol" });
    const carol = revisionRow(revisionsOf().find((row) => row.mwRevId === 102)!.id);
    carol.userDeleted = true;
    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: "102" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // a classic revision with no name at all is nobody's to restore
    carol.userDeleted = false;
    carol.author = null;
    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: "102" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a WikiOS save's handle is no classic name: a claim of it restores nothing", async () => {
    const { lost, conflictId } = await alphaLostToBob({ authorId: null });
    tables.wikiNameClaim.seed({ userId: "db-beta", name: "Alpha" });

    await expect(
      restoreOverwrittenText(as("beta"), { conflictId, ref: lost.id as string })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an edit since the notice returns the edit conflict, nothing saved", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const save = ArticleRepository.saveArticle.bind(ArticleRepository);
    let gammaRef = "";
    // Gamma saves between the restore's read of the head and its write
    jest
      .spyOn(ArticleRepository, "saveArticle")
      .mockImplementationOnce(async (input, authorId, authorName) => {
        const gamma = await save(
          { slug: "Caphiria", title: "Caphiria", wikitext: "Gamma's text", editSummary: "" },
          "db-gamma",
          "gamma"
        );
        gammaRef = toRevisionRef({ id: gamma.revisionId });
        return save(input, authorId, authorName);
      });

    const result = await restoreOverwrittenText(as("alpha"), {
      conflictId,
      ref: lost.id as string,
    });

    expect(result).toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Gamma's text",
      currentRevisionRef: gammaRef,
    });
    expect(revisionsOf().filter((row) => row.wikitext === "Alpha's text")).toHaveLength(1);
    expect(page().wikitext).toBe("Gamma's text");
  });

  it("finds a WikiOS revision the mirror stamped by its MediaWiki id too", async () => {
    const { conflictId } = await alphaLostToBob({ mwRevId: 140 });

    const result = await restoreOverwrittenText(as("alpha"), { conflictId, ref: "140" });

    expect(result.success).toBe(true);
    expect(page().wikitext).toBe("Alpha's text");
  });

  it("goes by the row's overwritten list, never by a revision's park reason", async () => {
    // Alpha's revision was parked under a later winner (W2) than the one its row names (Bob's 101): valid
    const { lost, conflictId } = await alphaLostToBob({ parkReason: "overwritten:w2" });
    // Delta's revision names Bob's 101 as its winner, but the row does not list it
    const stray = revision({
      wikitext: "Delta's text",
      author: "alpha",
      authorId: "db-alpha",
      parked: true,
      parkReason: "overwritten:101",
      createdAt: new Date("2026-10-24T11:00:00Z"),
    });

    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: stray.id as string })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const result = await restoreOverwrittenText(as("alpha"), {
      conflictId,
      ref: lost.id as string,
    });
    expect(result.success).toBe(true);
  });

  it("a deletion, move or restore that was overwritten has no text to restore; classic text WikiOS lacks is refused cleanly", async () => {
    const { conflictId } = await alphaLostToBob();
    const kir = author({ userId: "db-alpha", label: "alpha" });
    // more losers of Bob's edit: a WikiOS delete, a classic move, and a classic edit whose text only classic's
    // deleted archive holds
    await collide(change("classic", "101", author({ classicName: "Bob" })), [
      change("wikios", "log:wl-1", kir, "delete"),
      change("classic", "mwlog:7", author({ classicName: "Alpha" }), "move"),
      change("classic", "105", author({ classicName: "Alpha" })),
    ]);
    tables.wikiNameClaim.seed({ userId: "db-alpha", name: "Alpha" });

    for (const ref of ["log:wl-1", "mwlog:7"]) {
      await expect(restoreOverwrittenText(as("alpha"), { conflictId, ref })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual(
        UNAVAILABLE
      );
    }
    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: "105" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref: "105" })).resolves.toEqual(
      UNAVAILABLE
    );
  });

  it("never asks the revisions for a ref no revision can have (MediaWiki's id column would overflow)", async () => {
    const { conflictId } = await alphaLostToBob();
    // the database refuses an id past rev_id's 32-bit column, as Postgres does
    const findFirst = db.wikiRevision.findFirst.bind(db.wikiRevision);
    jest.spyOn(db.wikiRevision, "findFirst").mockImplementation(((args: {
      where?: { mwRevId?: number };
    }) => {
      if ((args.where?.mwRevId ?? 0) > 2_147_483_647) throw new Error("integer out of range");
      return findFirst(args as never);
    }) as never);

    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: "99999999999" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("a row whose page is gone has no text to restore", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    conflictRow(conflictId).articleId = null;

    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: lost.id as string })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("a failure that is no refusal is not hidden behind a missing button", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    jest.spyOn(db.wikiConflict, "findUnique").mockRejectedValueOnce(new Error("database down"));

    await expect(
      overwrittenRestorable(as("alpha"), { conflictId, ref: lost.id as string })
    ).rejects.toThrow("database down");
  });

  it("refuses text MediaWiki hid, a deleted page, and a conflict that does not exist", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const ref = lost.id as string;

    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId: "nope", ref })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    revisionRow(lost.id).textDeleted = true;
    await expect(restoreOverwrittenText(as("alpha"), { conflictId, ref })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    revisionRow(lost.id).textDeleted = false;

    page().status = "ARCHIVED";
    await expect(restoreOverwrittenText(as("alpha"), { conflictId, ref })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("a third party's edit since the notice: the edit conflict, nothing saved, and the offer becomes editing the page", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const ref = lost.id as string;
    // Gamma edits on top of Bob's winner before Alpha clicks
    const gamma = await ArticleRepository.saveArticle(
      {
        slug: "Caphiria",
        title: "Caphiria",
        wikitext: "Gamma's text",
        editSummary: "",
        expectedHeadRef: "101",
      },
      "db-gamma",
      "gamma"
    );

    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual({
      state: "stale",
      editHref: EDIT_HREF,
    });
    await expect(restoreOverwrittenText(as("alpha"), { conflictId, ref })).resolves.toEqual({
      success: false,
      editConflict: true,
      currentWikitext: "Gamma's text",
      currentRevisionRef: toRevisionRef({ id: gamma.revisionId }),
    });
    expect(revisionsOf().filter((row) => row.wikitext === "Alpha's text")).toHaveLength(1);
    expect(page().wikitext).toBe("Gamma's text");
    expect(revisionJobs()).toEqual(["Caphiria"]);
  });

  it("the trail written after a classic winner is still the conflict's own page: the restore goes on top of it", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const trail = makeHead(
      revision({ wikitext: "Bob's text", author: "WikiOS", summary: "Overwrote ..." })
    );
    conflictRow(conflictId).trailRevisionId = trail.id;
    const ref = lost.id as string;

    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual({
      state: "restorable",
      editHref: EDIT_HREF,
    });
    const result = await restoreOverwrittenText(as("alpha"), { conflictId, ref });

    expect(result.success).toBe(true);
    expect(headOf()).toMatchObject({ wikitext: "Alpha's text", parentRevisionId: trail.id });
  });

  it("a trail that is a log entry is never a base: the winner is", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    conflictRow(conflictId).trailRevisionId = "log:wl-3";

    const result = await restoreOverwrittenText(as("alpha"), {
      conflictId,
      ref: lost.id as string,
    });

    expect(result.success).toBe(true);
  });

  it("text that is already the page's is no restore: no button, a clean refusal, no empty revision and no job", async () => {
    // Bob's winning edit put back exactly what Alpha wrote
    const { lost, conflictId } = await alphaLostToBob();
    revisionRow(revisionsOf().find((row) => row.mwRevId === 101)!.id).wikitext = "Alpha's text";
    page().wikitext = "Alpha's text";
    const before = revisionsOf().length;
    const ref = lost.id as string;

    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual(
      UNAVAILABLE
    );
    await expect(restoreOverwrittenText(as("alpha"), { conflictId, ref })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(revisionsOf()).toHaveLength(before);
    expect(revisionJobs()).toEqual([]);
  });

  it("a revision whose editor MediaWiki hides is nobody's to restore, by account as by claim", async () => {
    const { lost, conflictId } = await alphaLostToBob({ userDeleted: true });

    await expect(
      restoreOverwrittenText(as("alpha"), { conflictId, ref: lost.id as string })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      overwrittenRestorable(as("alpha"), { conflictId, ref: lost.id as string })
    ).resolves.toEqual(UNAVAILABLE);
  });

  it("offers nothing to a blocked author, on a page they may not edit, or on a deleted page", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const ref = lost.id as string;

    tables.wikiBlock.seed({ userId: "db-alpha", reason: "vandalism" });
    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual(
      UNAVAILABLE
    );
    tables.wikiBlock.rows.find((block) => block.userId === "db-alpha")!.userId = "db-nobody";

    tables.wikiRestriction.seed({
      source: "ixwiki",
      title: "Caphiria",
      action: "edit",
      level: "sysop",
    });
    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual(
      UNAVAILABLE
    );
    tables.wikiRestriction.rows.find((r) => r.title === "Caphiria")!.title = "Elsewhere";
    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toMatchObject({
      state: "restorable",
    });

    page().status = "ARCHIVED";
    await expect(overwrittenRestorable(as("alpha"), { conflictId, ref })).resolves.toEqual(
      UNAVAILABLE
    );
  });

  it("a signed-out visitor is asked to sign in", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    await expect(
      restoreOverwrittenText(signedOut(), { conflictId, ref: lost.id as string })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    // asked of nobody: no conflict row is even read
    const findConflict = jest.spyOn(db.wikiConflict, "findUnique");
    await expect(
      overwrittenRestorable(signedOut(), { conflictId, ref: lost.id as string })
    ).resolves.toEqual(UNAVAILABLE);
    expect(findConflict).not.toHaveBeenCalled();
  });
});

describeEachWikiosMode("wikios.restoreOverwritten and wikios.overwrittenRestorable", () => {
  it("restores for the author through the router, and says whom the button is for", async () => {
    const { lost, conflictId } = await alphaLostToBob();
    const ref = lost.id as string;

    await expect(editing(as("alpha")).overwrittenRestorable({ conflictId, ref })).resolves.toEqual({
      state: "restorable",
      editHref: EDIT_HREF,
    });
    await expect(editing(as("beta")).overwrittenRestorable({ conflictId, ref })).resolves.toEqual(
      UNAVAILABLE
    );
    await expect(editing(signedOut()).overwrittenRestorable({ conflictId, ref })).resolves.toEqual(
      UNAVAILABLE
    );

    await expect(editing(as("alpha")).restoreOverwritten({ conflictId, ref })).resolves.toEqual({
      success: true,
      revisionId: expect.any(String),
    });
    await expect(editing(signedOut()).restoreOverwritten({ conflictId, ref })).rejects.toThrow(
      /Authentication required/
    );
    await expect(
      editing(as("alpha")).restoreOverwritten({ conflictId: "x".repeat(65), ref })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("wikios.listConflicts", () => {
  it("is for administrators only", async () => {
    await expect(utilities(as("alpha")).listConflicts({ limit: 10 })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(utilities(signedOut()).listConflicts({ limit: 10 })).rejects.toThrow(
      /Authentication required/
    );
  });

  it("lists page, winner, overwritten, notices and legacy rows, every kind of change readably", async () => {
    // a stamped WikiOS revision (shown by its MediaWiki id), an unmirrored one, and a classic move lost to Bob
    const stamped = revision({ author: "alpha", authorId: "db-alpha", mwRevId: 140, parked: true });
    const unmirrored = revision({ author: "alpha", authorId: "db-alpha", parked: true });
    const bobWon = await collide(change("classic", "101", author({ classicName: "Bob" })), [
      // a claimed author is named by their classic name
      change(
        "wikios",
        stamped.id as string,
        author({ userId: "db-alpha", label: "alpha", classicName: "Alpha" })
      ),
      change("wikios", unmirrored.id as string, author({ userId: "db-alpha", label: "alpha" })),
      change("classic", "mwlog:7", author({ classicName: "Carol" }), "move"),
      change("wikios", "job:j1", author({ userId: "db-alpha", label: "alpha" }), "move"),
      // a label is the name a save went under; an address only names an editor with none
      change("classic", "103", author({ label: "Relay", ip: "10.0.0.2" })),
    ]);
    await markNotified(bobWon, "user:db-alpha", "in-app");
    await markNotified(bobWon, "name:Carol", "talk-page");
    await markNotified(bobWon, "user:db-ghost", "in-app");
    // a WikiOS undelete won over a classic delete; its trail is a log entry, never a revision
    const undeleteWon = await collide(
      change("wikios", "log:wl-9", author({ userId: "db-beta", label: "beta" }), "undelete"),
      [change("classic", "mwlog:8", author({ ip: "10.0.0.1" }), "delete")]
    );
    conflictRow(undeleteWon).trailRevisionId = "log:wl-9";
    conflictRow(undeleteWon).settledAt = new Date("2026-10-24T13:00:00Z");
    await markNotified(undeleteWon, "ip:10.0.0.1", "talk-page");
    tables.wikiConflict.insert({
      key: "legacy-park:r1",
      source: "ixwiki",
      articleId: page().id,
      title: "Caphiria",
      winnerSide: "wikios",
      winnerAction: "edit",
      winnerRef: "w-legacy",
      winnerAt: new Date("2026-09-01"),
      baseRef: null,
      // stored as the recorder writes JSON: the time as text
      overwritten: [
        { ...change("classic", "90", author({ classicName: "Old" })), at: "2026-09-01T00:00:00Z" },
      ],
      notified: [],
      trailRevisionId: null,
      legacyPark: true,
      createdAt: new Date("2026-09-02"),
      updatedAt: new Date("2026-09-02"),
    });

    const { items, nextCursor } = await utilities(as("admin", 10)).listConflicts({ limit: 10 });

    expect(nextCursor).toBeNull();
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get(bobWon)).toMatchObject({
      title: "Caphiria",
      shortId: shortConflictId(bobWon),
      state: "pending",
      winner: { side: "classic", label: "revision 101", author: null },
      overwritten: [
        { label: "revision 140", author: "Alpha" },
        { label: expect.stringMatching(/^WikiOS revision .{8}, not in MediaWiki yet$/) },
        { side: "classic", action: "move", label: "move, log 7", author: "Carol" },
        { side: "wikios", action: "move", label: "WikiOS move, not logged", author: "alpha" },
        { label: "revision 103", author: "Relay" },
      ],
      notices: [
        { who: "Alpha", channel: "in-app" },
        { who: "Carol", channel: "talk-page" },
        { who: "db-ghost", channel: "in-app" },
      ],
      trail: null,
    });
    expect(byId.get(undeleteWon)).toMatchObject({
      state: "settled",
      notices: [{ who: "10.0.0.1", channel: "talk-page" }],
      winner: { side: "wikios", action: "undelete", label: "WikiOS restore" },
      overwritten: [{ label: "deletion, log 8", author: "10.0.0.1" }],
      trail: "WikiOS log entry",
    });
    expect(items.find((item) => item.legacy)).toMatchObject({
      state: "legacy",
      overwritten: [{ label: "revision 90", author: "Old" }],
    });
  });

  it("pages newest first, by cursor, and names a trail revision by its MediaWiki id once mirrored", async () => {
    const first = await collide(change("classic", "101", author({ classicName: "Bob" })), []);
    const trail = revision({ author: "WikiOS", mwRevId: 150 });
    conflictRow(first).trailRevisionId = trail.id;
    conflictRow(first).createdAt = new Date("2026-10-01");
    const second = await collide(change("classic", "102", author({ classicName: "Bob" })), []);

    const one = await utilities(as("admin", 10)).listConflicts({ limit: 1 });
    expect(one.items.map((item) => item.id)).toEqual([second]);
    const two = await utilities(as("admin", 10)).listConflicts({
      limit: 1,
      cursor: one.nextCursor!,
    });
    expect(two).toMatchObject({ items: [{ id: first, trail: "revision 150" }], nextCursor: null });
  });
});
