/** @jest-environment node */
/**
 * Plan 406 B: MediaWiki log events that change WikiOS state (delete, restore, move, protect, block,
 * rights). Each applied event writes one wiki_logs row carrying its MediaWiki log id; an event is applied
 * once; the mirror's own acts and the types WikiOS does not mirror are ignored.
 */
import { ConflictError } from "~/lib/app-error";
import { applyLogEvent } from "~/lib/wiki-os/services/inbound-log-events";
import type { LogEvent } from "~/lib/wiki-os/services/inbound-mediawiki";
import {
  claimedWikiUserId,
  evictCaches,
  isMirrorUser,
  syncLatestRevision,
} from "~/lib/wiki-os/services/inbound-revision-sync";
import { enqueueRender, invalidateTemplateDependents } from "~/lib/wiki-os/services/render-service";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const tx = {
  wikiArticle: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  // a restore points the page at its live head: these pages have no revision rows
  wikiRevision: { findFirst: jest.fn().mockResolvedValue(null) },
  wikiRestriction: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  wikiBlock: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  wikiUserGroup: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};
const mockLogFindUnique = jest.fn();
const mockLogCreate = jest.fn();
/**
 * Off: the handlers' transaction is the `tx` mock above and the log row goes to the mocks (the per-handler tests). On:
 * everything runs over the in-memory WikiOS tables (Prisma mode), for the conflict rule's cases.
 */
const mockFakeTables = { on: false };

jest.mock("~/server/db", () => {
  const fake = jest
    .requireActual("~/tests/helpers/fake-wiki-db")
    .createFakeWikiDb({ prisma: true });
  // describeEachWikiosMode answers the switch and marker rows through a mock
  fake.tables.systemConfig.findUnique = jest.fn();
  const legacyLog = new Proxy(fake.db.wikiLog, {
    get: (target, prop) => {
      if (prop === "findUnique") return (...a: unknown[]) => mockLogFindUnique(...a);
      if (prop === "create") return (...a: unknown[]) => mockLogCreate(...a);
      return target[prop];
    },
  });
  const db = new Proxy(fake.db, {
    get: (target, prop) => {
      if (!mockFakeTables.on && prop === "$transaction") {
        return (cb: (t: typeof tx) => unknown) => cb(tx);
      }
      if (!mockFakeTables.on && prop === "wikiLog") return legacyLog;
      return target[prop];
    },
  });
  return { __esModule: true, fake, db };
});
jest.mock("~/lib/wiki-os/services/inbound-revision-sync", () => ({
  evictCaches: jest.fn().mockResolvedValue(undefined),
  isMirrorUser: jest.fn().mockReturnValue(false),
  claimedWikiUserId: jest.fn().mockResolvedValue(null),
  syncLatestRevision: jest.fn().mockResolvedValue("known"),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateTemplateDependents: jest.fn(),
}));

const event = (
  over: Partial<LogEvent> & Pick<LogEvent, "type" | "action" | "title">
): LogEvent => ({
  logid: 501,
  user: "Admin",
  timestamp: "2026-09-27T10:00:00Z",
  comment: "because",
  params: {},
  ...over,
});

const loggedRow = () => mockLogCreate.mock.calls[0]?.[0].data;

beforeEach(() => {
  jest.clearAllMocks();
  fake.reset();
  jest.mocked(isMirrorUser).mockReturnValue(false);
  jest.mocked(claimedWikiUserId).mockResolvedValue(null);
  mockLogFindUnique.mockResolvedValue(null);
  mockLogCreate.mockResolvedValue({});
  tx.wikiArticle.findUnique.mockResolvedValue(null);
  tx.wikiArticle.update.mockResolvedValue({});
  tx.wikiArticle.delete.mockResolvedValue({});
  tx.wikiRestriction.findUnique.mockResolvedValue(null);
  tx.wikiBlock.findFirst.mockResolvedValue(null);
  tx.wikiUserGroup.findUnique.mockResolvedValue(null);
});

describe("which events are applied", () => {
  it("ignores what the mirror account did: WikiOS's own act coming back", async () => {
    jest.mocked(isMirrorUser).mockReturnValue(true);

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo", user: "Mirror" }))
    ).resolves.toBe("ignored");

    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("applies an event once: its MediaWiki log id is looked up in wiki_logs first", async () => {
    mockLogFindUnique.mockResolvedValue({ id: "log-1" });

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo" }))
    ).resolves.toBe("ignored");

    expect(mockLogFindUnique).toHaveBeenCalledWith({
      where: { mwLogId: 501 },
      select: { id: true },
    });
    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });
});

describe("delete and restore", () => {
  it("archives the page, evicts its caches and logs the event with its MediaWiki log id", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "PUBLISHED" });

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "foo_bar" }))
    ).resolves.toBe("applied");

    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { status: "ARCHIVED" },
    });
    expect(evictCaches).toHaveBeenCalledWith("Foo bar", "art-1");
    expect(loggedRow()).toMatchObject({
      logType: "delete",
      action: "delete",
      title: "Foo bar",
      actorName: "Admin",
      comment: "because",
      articleId: "art-1",
      mwLogId: 501,
      params: {},
      createdAt: new Date("2026-09-27T10:00:00Z"),
    });
  });

  it("treats the deletion of a redirect by a move as a deletion", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "PUBLISHED" });

    await applyLogEvent(event({ type: "delete", action: "delete_redir", title: "Foo" }));

    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { status: "ARCHIVED" },
    });
  });
  it("ignores a revision deletion (the page itself stays)", async () => {
    await expect(
      applyLogEvent(event({ type: "delete", action: "revision", title: "Foo" }))
    ).resolves.toBe("ignored");
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("restores a deleted page, imports its latest revision and evicts its caches", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "ARCHIVED" });

    await expect(
      applyLogEvent(event({ type: "delete", action: "restore", title: "Foo" }))
    ).resolves.toBe("applied");

    // the view is stale, and its render is queued (behind any save) once the restore is committed
    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { status: "PUBLISHED", htmlSyncedAt: null },
    });
    expect(enqueueRender).toHaveBeenCalledWith("art-1", { background: true });
    expect(syncLatestRevision).toHaveBeenCalledWith("Foo", expect.anything());
    expect(evictCaches).toHaveBeenCalledWith("Foo", "art-1");
    expect(loggedRow()).toMatchObject({ action: "restore", articleId: "art-1" });
  });
  it("writes no log row, so the event is retried, when bringing the page over fails", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "ARCHIVED" });
    jest.mocked(syncLatestRevision).mockRejectedValueOnce(new Error("MediaWiki returned HTTP 503"));

    await expect(
      applyLogEvent(event({ type: "delete", action: "restore", title: "Foo" }))
    ).rejects.toThrow("HTTP 503");

    expect(mockLogCreate).not.toHaveBeenCalled();
  });
});

describe("move", () => {
  const moveEvent = (
    params: LogEvent["params"] = { target_title: "New name", target_ns: 0 },
    action = "move"
  ) => event({ type: "move", action, title: "Old name", params });

  it("renames the page (its revisions stay attached), marks it stale, moves its protections and imports the redirect left behind", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name" ? { id: "art-1" } : null
    );
    tx.wikiRestriction.findUnique.mockResolvedValue({ level: "sysop", expiresAt: null });

    await expect(applyLogEvent(moveEvent())).resolves.toBe("applied");

    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: {
        title: "New name",
        slug: "new_name",
        namespace: 0,
        namespacePrefix: null,
        protectionLevel: "SYSOP",
        protectionExpiry: null,
        htmlSyncedAt: null,
      },
    });
    expect(tx.wikiRestriction.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ source: "ixwiki", title: "Old name" }),
      data: { title: "New name" },
    });
    expect(enqueueRender).toHaveBeenCalledWith("art-1", { background: true });
    expect(syncLatestRevision).toHaveBeenCalledWith("Old name");
    expect(evictCaches).toHaveBeenCalledWith("Old name", "art-1");
    expect(evictCaches).toHaveBeenCalledWith("New name", "art-1");
    expect(loggedRow()).toMatchObject({ logType: "move", title: "Old name", articleId: "art-1" });
  });
  it("refuses to rename onto a page WikiOS has (and logs nothing)", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name"
        ? { id: "art-1" }
        : { id: "art-2", status: "PUBLISHED", redirectTargetSlug: null }
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(applyLogEvent(moveEvent())).resolves.toBe("skipped");

    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("moves a page over a redirect: the redirect is archived and renamed out of the way, never deleted, so its revisions and watchers survive", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name"
        ? { id: "art-1" }
        : { id: "art-2", status: "PUBLISHED", redirectTargetSlug: "Old name" }
    );

    await expect(applyLogEvent(moveEvent(undefined, "move_redir"))).resolves.toBe("applied");

    expect(tx.wikiArticle.delete).not.toHaveBeenCalled();
    expect(tx.wikiArticle.update.mock.calls.map(([args]) => args.where.id)).toEqual([
      "art-2",
      "art-1",
    ]);
    expect(tx.wikiArticle.update.mock.calls[0]?.[0].data).toMatchObject({
      title: "New name (deleted 501)",
      slug: "new_name_(deleted_501)",
      status: "ARCHIVED",
    });
    expect(tx.wikiArticle.update.mock.calls[1]?.[0].data).toMatchObject({ title: "New name" });
  });

  it("swaps two titles: B is deleted in MediaWiki (archived here), then A is moved onto B's title", async () => {
    // WikiOS archived B when it read the delete event; the move of A to B now finds that archived row.
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name"
        ? { id: "art-A" }
        : { id: "art-B", status: "ARCHIVED", redirectTargetSlug: null }
    );

    await expect(applyLogEvent(moveEvent())).resolves.toBe("applied");

    expect(tx.wikiArticle.delete).not.toHaveBeenCalled();
    // B keeps its row (and so its revisions and watchers) as an archived page under an internal title; A takes B's title.
    expect(tx.wikiArticle.update.mock.calls[0]?.[0]).toEqual({
      where: { id: "art-B" },
      data: {
        title: "New name (deleted 501)",
        slug: "new_name_(deleted_501)",
        status: "ARCHIVED",
        htmlSyncedAt: null,
      },
    });
    expect(tx.wikiArticle.update.mock.calls[1]?.[0]).toMatchObject({
      where: { id: "art-A" },
      data: { title: "New name", slug: "new_name" },
    });
    expect(loggedRow()).toMatchObject({ logType: "move", articleId: "art-A" });
    // The archived page's caches go too.
    expect(evictCaches).toHaveBeenCalledWith("New name", "art-B");
  });

  it("is applied again harmlessly: the page is already at its new name, only the redirect is still to come", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "New name" ? { id: "art-1" } : null
    );

    await expect(applyLogEvent(moveEvent())).resolves.toBe("applied");

    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(syncLatestRevision).toHaveBeenCalledWith("Old name");
    expect(loggedRow()).toMatchObject({ articleId: "art-1" });
  });
});

describe("protect", () => {
  const protectEvent = (params: LogEvent["params"], action = "protect", title = "Foo") =>
    event({ type: "protect", action, title, params });

  it("sets each restriction MediaWiki lists, clears the others, and mirrors the edit level on the article", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1" });

    await expect(
      applyLogEvent(
        protectEvent({
          description: "[Edit=Allow only administrators] [Move=Allow only administrators]",
          cascade: false,
          details: [
            { type: "edit", level: "sysop", expiry: "infinity", cascade: false },
            {
              type: "move",
              level: "autoconfirmed",
              expiry: "2030-01-01T00:00:00Z",
              cascade: false,
            },
          ],
        })
      )
    ).resolves.toBe("applied");

    const upserts = tx.wikiRestriction.upsert.mock.calls.map(([args]) => args);
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toMatchObject({
      where: { source_title_action: { source: "ixwiki", title: "Foo", action: "edit" } },
      create: { level: "sysop", expiresAt: null, cascade: false, reason: "because" },
    });
    expect(upserts[1]).toMatchObject({
      where: { source_title_action: { source: "ixwiki", title: "Foo", action: "move" } },
      create: { level: "autoconfirmed", expiresAt: new Date("2030-01-01T00:00:00Z") },
    });
    expect(tx.wikiRestriction.deleteMany.mock.calls.map(([args]) => args.where.action)).toEqual([
      "create",
      "upload",
    ]);
    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { protectionLevel: "SYSOP", protectionExpiry: null },
    });
    expect(loggedRow()).toMatchObject({
      logType: "protect",
      action: "protect",
      articleId: "art-1",
    });
  });
  it("unprotects: every restriction goes and the article is open again", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1" });

    await expect(applyLogEvent(protectEvent({}, "unprotect"))).resolves.toBe("applied");

    expect(tx.wikiRestriction.upsert).not.toHaveBeenCalled();
    expect(tx.wikiRestriction.deleteMany).toHaveBeenCalledTimes(4);
    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { protectionLevel: "ALL", protectionExpiry: null },
    });
  });

  it("reads a level WikiOS does not know as sysop, and a cascade flag from the list", async () => {
    await applyLogEvent(
      protectEvent({
        details: [{ type: "edit", level: "templateeditor", expiry: "infinity", cascade: true }],
      })
    );

    expect(tx.wikiRestriction.upsert.mock.calls[0]?.[0].create).toMatchObject({
      level: "sysop",
      cascade: true,
    });
  });
  it("is tolerant of a details list it cannot read: it applies nothing, writes no row and says so", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(applyLogEvent(protectEvent({ details: "nonsense" }))).resolves.toBe("skipped");
    await expect(applyLogEvent(protectEvent({ details: [{ type: "edit" }] }))).resolves.toBe(
      "skipped"
    );

    expect(tx.wikiRestriction.upsert).not.toHaveBeenCalled();
    expect(tx.wikiRestriction.deleteMany).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("block", () => {
  const blockEvent = (params: LogEvent["params"], action = "block", title = "User:Troll") =>
    event({ type: "block", action, title, params });

  it("records a sitewide block of the wiki account, with its expiry and reason", async () => {
    await expect(
      applyLogEvent(
        blockEvent({
          duration: "1 week",
          expiry: "2026-10-04T10:00:00Z",
          flags: ["nocreate"],
          sitewide: true,
        })
      )
    ).resolves.toBe("applied");

    expect(tx.wikiBlock.create).toHaveBeenCalledWith({
      data: {
        wikiUsername: "Troll",
        source: "mw-import",
        reason: "because",
        expiresAt: new Date("2026-10-04T10:00:00Z"),
        allowUserTalk: true,
      },
    });
    expect(loggedRow()).toMatchObject({ logType: "block", title: "User:Troll" });
  });

  it("credits the block to the account holding the approved claim of the blocking admin's name", async () => {
    jest
      .mocked(claimedWikiUserId)
      .mockImplementation(async (name) => (name === "Admin" ? "user-7" : null));

    await expect(applyLogEvent(blockEvent({ sitewide: true }))).resolves.toBe("applied");

    expect(claimedWikiUserId).toHaveBeenCalledWith("Admin");
    expect(loggedRow()).toMatchObject({ logType: "block", userId: "user-7", actorName: "Admin" });
  });

  it("credits nobody when no approved claim holds the admin's name", async () => {
    await applyLogEvent(blockEvent({ sitewide: true }));

    expect(loggedRow()).toMatchObject({ logType: "block", userId: null, actorName: "Admin" });
  });
  it("lifts only the blocks this sync recorded", async () => {
    await expect(applyLogEvent(blockEvent({}, "unblock"))).resolves.toBe("applied");

    expect(tx.wikiBlock.deleteMany).toHaveBeenCalledWith({
      where: { wikiUsername: "Troll", source: "mw-import" },
    });
  });

  it("ignores a partial block, a block of an IP address and a block that is not about a user", async () => {
    await expect(applyLogEvent(blockEvent({ sitewide: false }))).resolves.toBe("ignored");
    await expect(applyLogEvent(blockEvent({}, "block", "User:192.0.2.5"))).resolves.toBe("ignored");
    await expect(applyLogEvent(blockEvent({}, "block", "User:2001:db8::1"))).resolves.toBe(
      "ignored"
    );
    await expect(applyLogEvent(blockEvent({}, "block", "Foo"))).resolves.toBe("ignored");

    expect(tx.wikiBlock.create).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("does not take a user whose name is only hexadecimal letters for an IP address", async () => {
    await expect(
      applyLogEvent(blockEvent({ expiry: "infinity" }, "block", "User:Dead"))
    ).resolves.toBe("applied");
    expect(tx.wikiBlock.create.mock.calls[0]?.[0].data.wikiUsername).toBe("Dead");
  });
});

describe("rights", () => {
  const rightsEvent = (params: LogEvent["params"], title = "User:Jane") =>
    event({ type: "rights", action: "rights", title, params });

  it("adds the groups WikiOS maps (with their expiry) and ignores the rest", async () => {
    await expect(
      applyLogEvent(
        rightsEvent({
          oldgroups: [],
          newgroups: ["sysop", "bot", "autopatrolled"],
          newmetadata: [
            { group: "sysop", expiry: null },
            { group: "bot", expiry: "2027-01-01T00:00:00Z" },
            { group: "autopatrolled", expiry: null },
          ],
        })
      )
    ).resolves.toBe("applied");

    const created = tx.wikiUserGroup.create.mock.calls.map(([args]) => args.data);
    expect(created).toEqual([
      { wikiUsername: "Jane", group: "sysop", expiresAt: null, source: "mw-import" },
      {
        wikiUsername: "Jane",
        group: "bot",
        expiresAt: new Date("2027-01-01T00:00:00Z"),
        source: "mw-import",
      },
    ]);
    expect(loggedRow()).toMatchObject({ logType: "rights", title: "User:Jane" });
  });

  it("removes the mapped groups MediaWiki took away, but only memberships this sync granted", async () => {
    await applyLogEvent(
      rightsEvent({
        oldgroups: ["sysop", "bureaucrat", "autopatrolled"],
        newgroups: ["bureaucrat"],
      })
    );

    expect(tx.wikiUserGroup.deleteMany).toHaveBeenCalledWith({
      where: { wikiUsername: "Jane", group: { in: ["sysop"] }, source: "mw-import" },
    });
  });

  it("never rewrites a membership a WikiOS administrator granted", async () => {
    tx.wikiUserGroup.findUnique.mockResolvedValue({ id: "g1", source: "wikios" });

    await applyLogEvent(rightsEvent({ oldgroups: [], newgroups: ["sysop"] }));

    expect(tx.wikiUserGroup.create).not.toHaveBeenCalled();
    expect(tx.wikiUserGroup.update).not.toHaveBeenCalled();
  });
});

describe("a template or module that is deleted, restored or moved makes the pages that use it stale (plan 406)", () => {
  it("on a deletion", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "PUBLISHED" });

    await applyLogEvent(
      event({ type: "delete", action: "delete", title: "Template:Infobox country" })
    );

    expect(invalidateTemplateDependents).toHaveBeenCalledWith("Template:Infobox country");
  });

  it("on a restore", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "ARCHIVED" });

    await applyLogEvent(event({ type: "delete", action: "restore", title: "Module:Infobox" }));

    expect(invalidateTemplateDependents).toHaveBeenCalledWith("Module:Infobox");
  });

  it("on a move, under both names", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Template:Old" ? { id: "art-1" } : null
    );

    await applyLogEvent(
      event({
        type: "move",
        action: "move",
        title: "Template:Old",
        params: { target_title: "Template:New", target_ns: 10 },
      })
    );

    expect(invalidateTemplateDependents).toHaveBeenCalledWith("Template:Old");
    expect(invalidateTemplateDependents).toHaveBeenCalledWith("Template:New");
  });
});

describe("the log row and the unique MediaWiki log id", () => {
  it("a writer that loses the race for the unique mwLogId has found the event already applied", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "PUBLISHED" });
    // What the production `db` throws for a unique violation (~/lib/prisma-error), not a Prisma error.
    mockLogCreate.mockRejectedValue(
      new ConflictError("Unique constraint violation on WikiLog (mwLogId)")
    );

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo" }))
    ).resolves.toBe("applied");
  });

  it("a Prisma unique error that the db wrapper did not convert is not mistaken for the race", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "PUBLISHED" });
    const { Prisma } = jest.requireActual("@prisma/client");
    mockLogCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo" }))
    ).rejects.toThrow("Unique constraint failed");
  });

  it("any other failure of the log write is the event's failure (it is retried)", async () => {
    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "PUBLISHED" });
    mockLogCreate.mockRejectedValue(new Error("db down"));

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo" }))
    ).rejects.toThrow("db down");
  });
});

// ---------------------------------------------------------------------------
// The conflict rule: a classic delete, move or restore against what WikiOS changed and MediaWiki has not seen yet
// ---------------------------------------------------------------------------

const BASE_AT = new Date("2026-09-01T00:00:00Z");

const pageOf = (title: string) => tables.wikiArticle.rows.find((row) => row.title === title);
const revisionRow = (id: string) => tables.wikiRevision.rows.find((row) => row.id === id)!;
const conflictRows = () => tables.wikiConflict.rows;

/** A page both wikis have: WikiOS's head is MediaWiki's revision `mwRevId`. */
function seedPage(title: string, mwRevId: number): string {
  const row = tables.wikiArticle.insert({
    title,
    slug: title.replace(/ /g, "_").toLowerCase(),
    wikitext: `${title} text.`,
    mwLatestRevId: mwRevId,
  });
  tables.wikiRevision.insert({
    articleId: row.id,
    wikitext: `${title} text.`,
    mwRevId,
    author: "Founder",
    origin: "classic",
    createdAt: BASE_AT,
  });
  return row.id;
}

/** A WikiOS save of the page by Kir, not mirrored yet (no MediaWiki id). */
function wikiosEdit(articleId: string, at: string): string {
  return tables.wikiRevision.insert({
    articleId,
    wikitext: "Kir's text.",
    author: "Kir",
    authorId: "db-kir",
    createdAt: new Date(at),
  }).id;
}

/** A WikiOS page operation by Kir at `at` with its mirror job still queued; returns its log row's id. */
function wikiosOperation(
  articleId: string,
  kind: "move" | "delete" | "undelete",
  title: string,
  at: string,
  payload: Record<string, unknown> = { reason: "" }
): string {
  const log = tables.wikiLog.insert({
    logType: kind === "move" ? "move" : "delete",
    action: kind === "undelete" ? "restore" : kind,
    title,
    actorName: "Kir",
    userId: "db-kir",
    articleId,
    mwLogId: null,
    createdAt: new Date(at),
  });
  tables.wikiMirrorJob.insert({ kind, title, articleId, logId: log.id, payload });
  return log.id;
}

/** WikiOS moved `from` to `to` at `at` (leaving a redirect), and MediaWiki has not been told yet. */
function wikiosMove(articleId: string, from: string, to: string, at: string) {
  Object.assign(pageOf(from)!, { title: to, slug: to.replace(/ /g, "_").toLowerCase() });
  const redirect = tables.wikiArticle.insert({
    title: from,
    slug: from.replace(/ /g, "_").toLowerCase(),
    wikitext: `#REDIRECT [[${to}]]`,
    redirectTargetSlug: to,
  });
  tables.wikiRevision.insert({
    articleId: redirect.id,
    wikitext: `#REDIRECT [[${to}]]`,
    author: "Kir",
    authorId: "db-kir",
    createdAt: new Date(at),
  });
  const logId = wikiosOperation(articleId, "move", from, at, {
    to,
    reason: "",
    leaveRedirect: true,
  });
  return { logId, redirectId: redirect.id };
}

const KIR = { userId: "db-kir", classicName: null, ip: null, label: "Kir" };
const ADMIN = { userId: null, classicName: "Admin", ip: null, label: null };

describeEachWikiosMode("classic deletes, moves and restores through the conflict rule", () => {
  beforeEach(() => {
    mockFakeTables.on = true;
  });
  afterEach(() => {
    mockFakeTables.on = false;
  });

  const deleteAt = (title: string, timestamp: string, logid = 501) =>
    event({ type: "delete", action: "delete", title, timestamp, logid });

  it("a classic delete after an unmirrored WikiOS edit removes the page; the WikiOS author is listed overwritten", async () => {
    const id = seedPage("Caphiria", 100);
    const edit = wikiosEdit(id, "2026-10-24T11:00:00Z");

    await expect(applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"))).resolves.toBe(
      "applied"
    );

    expect(pageOf("Caphiria")?.status).toBe("ARCHIVED");
    expect(conflictRows()).toHaveLength(1);
    expect(conflictRows()[0]).toMatchObject({
      articleId: id,
      title: "Caphiria",
      winnerSide: "classic",
      winnerAction: "delete",
      winnerRef: "mwlog:501",
      winnerAt: new Date("2026-10-24T12:00:00Z"),
      overwritten: [
        {
          side: "wikios",
          action: "edit",
          ref: edit,
          at: "2026-10-24T11:00:00.000Z",
          author: KIR,
        },
      ],
    });
    // overwritten: history only, under the winner's ref
    expect(revisionRow(edit)).toMatchObject({ parked: true, parkReason: "overwritten:mwlog:501" });
    expect(tables.wikiLog.rows.find((row) => row.mwLogId === 501)).toMatchObject({
      articleId: id,
      action: "delete",
    });
  });

  it("a classic delete before a WikiOS edit MediaWiki had not seen does not archive; the deleter is listed overwritten", async () => {
    const id = seedPage("Caphiria", 100);
    const edit = wikiosEdit(id, "2026-10-24T13:00:00Z");

    await expect(applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"))).resolves.toBe(
      "applied"
    );

    expect(pageOf("Caphiria")?.status).toBe("PUBLISHED");
    expect(revisionRow(edit)).toMatchObject({ parked: false, parkReason: null });
    expect(conflictRows()).toHaveLength(1);
    expect(conflictRows()[0]).toMatchObject({
      winnerSide: "wikios",
      winnerAction: "edit",
      winnerRef: edit,
      overwritten: [
        {
          side: "classic",
          action: "delete",
          ref: "mwlog:501",
          at: "2026-10-24T12:00:00.000Z",
          author: ADMIN,
        },
      ],
    });
    // the event is applied all the same: its log row is written, so it is never judged again
    expect(tables.wikiLog.rows.find((row) => row.mwLogId === 501)).toMatchObject({
      articleId: id,
    });
    expect(evictCaches).not.toHaveBeenCalled();
  });

  it("a classic delete earlier than a WikiOS move MediaWiki has not had does not archive; the move wins", async () => {
    const id = seedPage("Caphiria", 100);
    const move = wikiosOperation(id, "move", "Caphiria", "2026-10-24T13:00:00Z", {
      to: "Caphiria Empire",
      reason: "",
      leaveRedirect: true,
    });

    await applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"));

    expect(pageOf("Caphiria")?.status).toBe("PUBLISHED");
    expect(conflictRows()).toEqual([
      expect.objectContaining({
        winnerSide: "wikios",
        winnerAction: "move",
        winnerRef: `log:${move}`,
      }),
    ]);
  });

  it("a classic delete later than a WikiOS save the mirror already sent in an earlier second records no conflict", async () => {
    const id = seedPage("Caphiria", 100);
    const sent = wikiosEdit(id, "2026-10-24T11:00:00Z");
    revisionRow(sent).mwRevId = 101;

    await applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"));

    expect(pageOf("Caphiria")?.status).toBe("ARCHIVED");
    expect(conflictRows()).toEqual([]);
  });

  it("a classic delete earlier than a WikiOS save the mirror already sent does not archive: the save wins", async () => {
    const id = seedPage("Caphiria", 100);
    const sent = wikiosEdit(id, "2026-10-24T13:00:00Z");
    revisionRow(sent).mwRevId = 101;

    await applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"));

    expect(pageOf("Caphiria")?.status).toBe("PUBLISHED");
    expect(conflictRows()).toEqual([
      expect.objectContaining({ winnerSide: "wikios", winnerRef: sent }),
    ]);
  });

  it("a settler's trail dummy edit dated after a classic delete never keeps the page: it is archived", async () => {
    const id = seedPage("Caphiria", 100);
    tables.wikiRevision.insert({
      articleId: id,
      wikitext: "Caphiria text.",
      author: "WikiOS",
      authorId: null,
      summary: "Overwrote revision 99 by Zed, saved from the same version (conflict c1)",
      createdAt: new Date("2026-10-24T13:00:00Z"),
    });

    await applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"));

    expect(pageOf("Caphiria")?.status).toBe("ARCHIVED");
    expect(conflictRows()).toEqual([]);
  });

  it("a person's save whose label happens to be WikiOS's still keeps the page", async () => {
    const id = seedPage("Caphiria", 100);
    tables.wikiRevision.insert({
      articleId: id,
      wikitext: "A person's text.",
      author: "WikiOS",
      authorId: "db-kir",
      createdAt: new Date("2026-10-24T13:00:00Z"),
    });

    await applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"));

    expect(pageOf("Caphiria")?.status).toBe("PUBLISHED");
  });

  it("an overwritten WikiOS revision never keeps a page classic deleted", async () => {
    const id = seedPage("Caphiria", 100);
    const lost = wikiosEdit(id, "2026-10-24T13:00:00Z");
    Object.assign(revisionRow(lost), { parked: true, parkReason: "overwritten:200" });

    await applyLogEvent(deleteAt("Caphiria", "2026-10-24T12:00:00Z"));

    expect(pageOf("Caphiria")?.status).toBe("ARCHIVED");
    expect(conflictRows()).toEqual([]);
  });

  it("a classic delete or restore that meets nothing MediaWiki has not seen records no conflict", async () => {
    const quiet = seedPage("Quiet", 100);
    // a page's text from before revisions were kept is classic's own, not a WikiOS change
    tables.wikiRevision.insert({
      articleId: quiet,
      wikitext: "Quiet text.",
      author: null,
      origin: "classic",
      createdAt: new Date("2026-10-24T11:00:00Z"),
    });
    const both = seedPage("Both", 101);
    wikiosOperation(both, "delete", "Both", "2026-10-24T13:00:00Z");
    pageOf("Both")!.status = "ARCHIVED";
    // WikiOS's delete reached MediaWiki before the classic restore did
    const mirrored = seedPage("Mirrored", 102);
    wikiosOperation(mirrored, "delete", "Mirrored", "2026-10-24T13:00:00Z");
    tables.wikiMirrorJob.rows.at(-1)!.state = "done";
    pageOf("Mirrored")!.status = "ARCHIVED";

    await applyLogEvent(deleteAt("Quiet", "2026-10-24T12:00:00Z", 601));
    await applyLogEvent(deleteAt("Both", "2026-10-24T12:00:00Z", 602));
    await applyLogEvent(
      event({
        type: "delete",
        action: "restore",
        title: "Mirrored",
        timestamp: "2026-10-24T12:00:00Z",
        logid: 603,
      })
    );

    expect(pageOf("Quiet")?.status).toBe("ARCHIVED");
    expect(pageOf("Both")?.status).toBe("ARCHIVED");
    expect(pageOf("Mirrored")?.status).toBe("PUBLISHED");
    expect(conflictRows()).toEqual([]);
    expect(tables.wikiRevision.rows.filter((row) => row.parked)).toEqual([]);
  });

  it("a restore brings the latest revision over counting at the restore's time", async () => {
    seedPage("Caphiria", 100);
    pageOf("Caphiria")!.status = "ARCHIVED";

    await expect(
      applyLogEvent(
        event({
          type: "delete",
          action: "restore",
          title: "Caphiria",
          timestamp: "2026-10-24T12:00:00Z",
        })
      )
    ).resolves.toBe("applied");

    expect(pageOf("Caphiria")?.status).toBe("PUBLISHED");
    // judged by the cycle (it holds the lock), at the restore's time
    expect(syncLatestRevision).toHaveBeenCalledWith("Caphiria", {
      effectiveAt: new Date("2026-10-24T12:00:00Z"),
      judgeCollisions: true,
    });
    expect(conflictRows()).toEqual([]);
  });

  it("a classic restore later than WikiOS's unsent delete brings the page back; an earlier one leaves it deleted", async () => {
    const later = seedPage("Later", 100);
    // an edit before WikiOS's delete comes back with the page: a restore overwrites only the delete
    wikiosEdit(later, "2026-10-24T10:00:00Z");
    const laterDelete = wikiosOperation(later, "delete", "Later", "2026-10-24T11:00:00Z");
    const earlier = seedPage("Earlier", 101);
    const earlierDelete = wikiosOperation(earlier, "delete", "Earlier", "2026-10-24T13:00:00Z");
    for (const title of ["Later", "Earlier"]) pageOf(title)!.status = "ARCHIVED";
    const restore = (title: string, logid: number) =>
      event({ type: "delete", action: "restore", title, timestamp: "2026-10-24T12:00:00Z", logid });

    await expect(applyLogEvent(restore("Later", 701))).resolves.toBe("applied");
    await expect(applyLogEvent(restore("Earlier", 702))).resolves.toBe("applied");

    expect(pageOf("Later")?.status).toBe("PUBLISHED");
    expect(pageOf("Earlier")?.status).toBe("ARCHIVED");
    expect(syncLatestRevision).toHaveBeenCalledTimes(1);
    expect(syncLatestRevision).toHaveBeenCalledWith("Later", expect.anything());
    const byArticle = (articleId: string) =>
      conflictRows().find((row) => row.articleId === articleId);
    expect(byArticle(later)).toMatchObject({
      winnerSide: "classic",
      winnerAction: "undelete",
      winnerRef: "mwlog:701",
      overwritten: [{ side: "wikios", action: "delete", ref: `log:${laterDelete}`, author: KIR }],
    });
    expect(byArticle(earlier)).toMatchObject({
      winnerSide: "wikios",
      winnerAction: "delete",
      winnerRef: `log:${earlierDelete}`,
      overwritten: [{ side: "classic", action: "undelete", ref: "mwlog:702", author: ADMIN }],
    });
  });

  it("a classic move later than a pending WikiOS move wins; an earlier one loses", async () => {
    const won = seedPage("Old A", 100);
    const lostMove = wikiosMove(won, "Old A", "WikiOS A", "2026-10-24T11:00:00Z");
    const lost = seedPage("Old B", 101);
    const keptMove = wikiosMove(lost, "Old B", "WikiOS B", "2026-10-24T13:00:00Z");
    const classicMove = (title: string, target: string, logid: number) =>
      event({
        type: "move",
        action: "move",
        title,
        timestamp: "2026-10-24T12:00:00Z",
        logid,
        params: { target_title: target, target_ns: 0 },
      });

    await expect(applyLogEvent(classicMove("Old A", "Classic A", 801))).resolves.toBe("applied");
    await expect(applyLogEvent(classicMove("Old B", "Classic B", 802))).resolves.toBe("applied");

    const byArticle = (articleId: string) =>
      conflictRows().find((row) => row.articleId === articleId);
    // the later classic move renames the page from where WikiOS put it; WikiOS's move is overwritten
    expect(tables.wikiArticle.rows.find((row) => row.id === won)?.title).toBe("Classic A");
    expect(pageOf("WikiOS A")).toBeUndefined();
    expect(byArticle(won)).toMatchObject({
      title: "Classic A",
      winnerSide: "classic",
      winnerAction: "move",
      winnerRef: "mwlog:801",
      overwritten: [{ side: "wikios", action: "move", ref: `log:${lostMove.logId}`, author: KIR }],
    });
    // the redirect WikiOS left points nowhere now: it goes, and classic's redirect is brought over in its place
    expect(tables.wikiArticle.rows.find((row) => row.id === lostMove.redirectId)?.status).toBe(
      "ARCHIVED"
    );
    expect(syncLatestRevision).toHaveBeenCalledWith("Old A");
    expect(evictCaches).toHaveBeenCalledWith("WikiOS A", won);

    // the earlier classic move leaves the title as WikiOS has it; the classic mover is overwritten
    expect(tables.wikiArticle.rows.find((row) => row.id === lost)?.title).toBe("WikiOS B");
    expect(pageOf("Classic B")).toBeUndefined();
    expect(tables.wikiArticle.rows.find((row) => row.id === keptMove.redirectId)?.status).toBe(
      "PUBLISHED"
    );
    expect(byArticle(lost)).toMatchObject({
      title: "WikiOS B",
      winnerSide: "wikios",
      winnerAction: "move",
      winnerRef: `log:${keptMove.logId}`,
      overwritten: [{ side: "classic", action: "move", ref: "mwlog:802", author: ADMIN }],
    });
    expect(syncLatestRevision).not.toHaveBeenCalledWith("Old B");
    expect(tables.wikiLog.rows.filter((row) => row.mwLogId !== null)).toHaveLength(2);
  });

  it("a winning classic move whose redirect import failed is applied again harmlessly", async () => {
    const id = seedPage("Old A", 100);
    wikiosMove(id, "Old A", "WikiOS A", "2026-10-24T11:00:00Z");
    tables.wikiRestriction.insert({
      source: "ixwiki",
      title: "WikiOS A",
      action: "edit",
      level: "sysop",
    });
    const classicMove = event({
      type: "move",
      action: "move",
      title: "Old A",
      timestamp: "2026-10-24T12:00:00Z",
      params: { target_title: "Classic A", target_ns: 0 },
    });
    jest.mocked(syncLatestRevision).mockRejectedValueOnce(new Error("MediaWiki returned HTTP 503"));

    await expect(applyLogEvent(classicMove)).rejects.toThrow("HTTP 503");
    await expect(applyLogEvent(classicMove)).resolves.toBe("applied");

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("Classic A");
    expect(tables.wikiRestriction.rows).toEqual([
      expect.objectContaining({ title: "Classic A", action: "edit", level: "sysop" }),
    ]);
    expect(conflictRows()).toHaveLength(1);
    expect(tables.wikiLog.rows.filter((row) => row.mwLogId === 501)).toHaveLength(1);
  });

  it("against several pending WikiOS moves away from the title, the newest one stands", async () => {
    const id = seedPage("Old A", 100);
    wikiosOperation(id, "move", "Old A", "2026-10-24T10:00:00Z", {
      to: "Far A",
      reason: "",
      leaveRedirect: false,
    });
    wikiosOperation(id, "move", "Far A", "2026-10-24T10:30:00Z", {
      to: "Old A",
      reason: "",
      leaveRedirect: false,
    });
    const newest = wikiosOperation(id, "move", "Old A", "2026-10-24T11:00:00Z", {
      to: "Near A",
      reason: "",
      leaveRedirect: false,
    });
    Object.assign(pageOf("Old A")!, { title: "Near A", slug: "near_a" });

    await expect(
      applyLogEvent(
        event({
          type: "move",
          action: "move",
          title: "Old A",
          timestamp: "2026-10-24T12:00:00Z",
          params: { target_title: "Classic A", target_ns: 0 },
        })
      )
    ).resolves.toBe("applied");

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("Classic A");
    expect(conflictRows()[0]).toMatchObject({
      overwritten: [{ side: "wikios", action: "move", ref: `log:${newest}` }],
    });
  });

  it("a classic move to the title WikiOS moved the page to records no conflict and renames nothing", async () => {
    const id = seedPage("Old C", 100);
    const move = wikiosMove(id, "Old C", "New C", "2026-10-24T11:00:00Z");

    await expect(
      applyLogEvent(
        event({
          type: "move",
          action: "move",
          title: "Old C",
          timestamp: "2026-10-24T12:00:00Z",
          params: { target_title: "New C", target_ns: 0 },
        })
      )
    ).resolves.toBe("applied");

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("New C");
    expect(tables.wikiArticle.rows.find((row) => row.id === move.redirectId)).toMatchObject({
      title: "Old C",
      status: "PUBLISHED",
    });
    expect(conflictRows()).toEqual([]);
    expect(tables.wikiLog.rows.find((row) => row.mwLogId === 501)).toMatchObject({ articleId: id });
  });

  /**
   * WikiOS moved `from` to `to` at `at` as PageManagementService logs it (the titles in the log entry's params), leaving a
   * redirect; `state` is its mirror job's ("done": MediaWiki has had it).
   */
  function loggedMove(articleId: string, from: string, to: string, at: string, state = "pending") {
    const logId = wikiosMove(articleId, from, to, at).logId;
    Object.assign(
      tables.wikiLog.rows.find((row) => row.id === logId)!,
      {
        title: to,
        params: { oldTitle: from, newTitle: to },
      }
    );
    tables.wikiMirrorJob.rows.find((job) => job.logId === logId)!.state = state;
    return logId;
  }
  const classicMoveAt = (title: string, target: string, timestamp: string, logid = 801) =>
    event({
      type: "move",
      action: "move",
      title,
      timestamp,
      logid,
      params: { target_title: target, target_ns: 0 },
    });
  /** Published WikiOS redirects that point at a title no published page has. */
  const danglingRedirects = () =>
    tables.wikiArticle.rows
      .filter((row) => row.status !== "ARCHIVED" && row.redirectTargetSlug)
      .filter(
        (row) =>
          !tables.wikiArticle.rows.some(
            (page) => page.title === row.redirectTargetSlug && page.status !== "ARCHIVED"
          )
      )
      .map((row) => row.title);

  it("a classic move earlier than a WikiOS move the mirror already sent loses: the page stays where WikiOS moved it", async () => {
    const id = seedPage("Old A", 100);
    const move = loggedMove(id, "Old A", "WikiOS A", "2026-10-24T12:00:00Z", "done");

    await expect(
      applyLogEvent(classicMoveAt("Old A", "Classic A", "2026-10-24T11:00:00Z"))
    ).resolves.toBe("applied");

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("WikiOS A");
    expect(pageOf("Old A")).toMatchObject({ redirectTargetSlug: "WikiOS A", status: "PUBLISHED" });
    expect(pageOf("Classic A")).toBeUndefined();
    expect(conflictRows()).toEqual([
      expect.objectContaining({
        winnerSide: "wikios",
        winnerRef: `log:${move}`,
        overwritten: [expect.objectContaining({ ref: "mwlog:801" })],
      }),
    ]);
    expect(syncLatestRevision).not.toHaveBeenCalled();
  });

  it("a classic move of a redirect WikiOS's sent move left, made after that move, renames the redirect", async () => {
    const id = seedPage("Old A", 100);
    loggedMove(id, "Old A", "WikiOS A", "2026-10-24T11:00:00Z", "done");

    await applyLogEvent(classicMoveAt("Old A", "Classic A", "2026-10-24T12:00:00Z"));

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("WikiOS A");
    expect(pageOf("Classic A")).toMatchObject({ redirectTargetSlug: "WikiOS A" });
    expect(conflictRows()).toEqual([]);
  });

  it("a classic delete of a title WikiOS moved its page away from is judged against the move: a later one removes the page and its redirect", async () => {
    const won = seedPage("Old A", 100);
    const lostMove = loggedMove(won, "Old A", "WikiOS A", "2026-10-24T11:00:00Z");
    const kept = seedPage("Old B", 101);
    const keptMove = loggedMove(kept, "Old B", "WikiOS B", "2026-10-24T13:00:00Z");

    await applyLogEvent(deleteAt("Old A", "2026-10-24T12:00:00Z", 501));
    await applyLogEvent(deleteAt("Old B", "2026-10-24T12:00:00Z", 502));

    expect(tables.wikiArticle.rows.find((row) => row.id === won)?.status).toBe("ARCHIVED");
    expect(pageOf("Old A")?.status).toBe("ARCHIVED");
    expect(tables.wikiArticle.rows.find((row) => row.id === kept)?.status).toBe("PUBLISHED");
    expect(pageOf("Old B")?.status).toBe("PUBLISHED");
    expect(danglingRedirects()).toEqual([]);
    expect(conflictRows()).toEqual([
      expect.objectContaining({
        articleId: won,
        winnerRef: "mwlog:501",
        overwritten: [expect.objectContaining({ ref: `log:${lostMove}` })],
      }),
      expect.objectContaining({
        articleId: kept,
        winnerRef: `log:${keptMove}`,
        overwritten: [expect.objectContaining({ ref: "mwlog:502" })],
      }),
    ]);
  });

  it("a classic delete of a title WikiOS moved away from records nothing when WikiOS deleted the moved page too", async () => {
    const id = seedPage("Old A", 100);
    loggedMove(id, "Old A", "WikiOS A", "2026-10-24T11:00:00Z");
    Object.assign(
      tables.wikiArticle.rows.find((row) => row.id === id)!,
      { status: "ARCHIVED" }
    );
    wikiosOperation(id, "delete", "WikiOS A", "2026-10-24T13:00:00Z");

    await expect(applyLogEvent(deleteAt("Old A", "2026-10-24T12:00:00Z"))).resolves.toBe("applied");

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.status).toBe("ARCHIVED");
    expect(conflictRows()).toEqual([]);
  });

  it("a winning classic move over a chain of WikiOS moves archives every redirect they left, and all of them are overwritten", async () => {
    const id = seedPage("Old A", 100);
    const first = loggedMove(id, "Old A", "Mid A", "2026-10-24T10:00:00Z");
    const second = loggedMove(id, "Mid A", "Far A", "2026-10-24T10:30:00Z");

    await applyLogEvent(classicMoveAt("Old A", "Classic A", "2026-10-24T12:00:00Z"));

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("Classic A");
    expect(pageOf("Old A")?.status).toBe("ARCHIVED");
    expect(pageOf("Mid A")?.status).toBe("ARCHIVED");
    expect(danglingRedirects()).toEqual([]);
    expect(conflictRows()[0]).toMatchObject({
      winnerRef: "mwlog:801",
      overwritten: [
        expect.objectContaining({ ref: `log:${first}` }),
        expect.objectContaining({ ref: `log:${second}` }),
      ],
    });
  });

  it("a classic move the mirror already ruled the winner (its WikiOS move held back) renames the page from where WikiOS put it", async () => {
    const id = seedPage("Old A", 100);
    const move = loggedMove(id, "Old A", "WikiOS A", "2026-10-24T11:00:00Z", "done");
    tables.wikiConflict.insert({
      key: `ixwiki:${id}:mwlog:801`,
      articleId: id,
      title: "Classic A",
      winnerSide: "classic",
      winnerAction: "move",
      winnerRef: "mwlog:801",
      winnerAt: new Date("2026-10-24T12:00:00Z"),
      overwritten: [
        {
          side: "wikios",
          action: "move",
          ref: `log:${move}`,
          at: "2026-10-24T11:00:00.000Z",
          author: KIR,
        },
      ],
    });

    await applyLogEvent(classicMoveAt("Old A", "Classic A", "2026-10-24T12:00:00Z"));

    expect(tables.wikiArticle.rows.find((row) => row.id === id)?.title).toBe("Classic A");
    expect(pageOf("Old A")?.status).toBe("ARCHIVED");
    expect(conflictRows()).toHaveLength(1);
  });

  it("the mirror account's log events stay ignored", async () => {
    jest.mocked(isMirrorUser).mockReturnValue(true);
    const id = seedPage("Caphiria", 100);
    wikiosEdit(id, "2026-10-24T11:00:00Z");

    await expect(
      applyLogEvent({ ...deleteAt("Caphiria", "2026-10-24T12:00:00Z"), user: "WikiOSMirror" })
    ).resolves.toBe("ignored");

    expect(pageOf("Caphiria")?.status).toBe("PUBLISHED");
    expect(conflictRows()).toEqual([]);
    expect(tables.wikiLog.rows).toEqual([]);
  });
});
