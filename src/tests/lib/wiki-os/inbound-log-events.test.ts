/** @jest-environment node */
/**
 * Plan 406 B: MediaWiki log events that change WikiOS state (delete, restore, move, protect, block,
 * rights). Each applied event writes one wiki_logs row carrying its MediaWiki log id; an event is applied
 * once; the mirror's own acts and the types WikiOS does not mirror are ignored.
 */
import { applyLogEvent } from "~/lib/wiki-os/services/inbound-log-events";
import type { LogEvent } from "~/lib/wiki-os/services/inbound-mediawiki";
import {
  evictCaches,
  isMirrorUser,
  syncLatestRevision,
} from "~/lib/wiki-os/services/inbound-revision-sync";
import { enqueueRender } from "~/lib/wiki-os/services/render-service";

const tx = {
  wikiArticle: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
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
const mockLogFindFirst = jest.fn();
const mockLogCreate = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
    wikiLog: {
      findFirst: (...a: unknown[]) => mockLogFindFirst(...a),
      create: (...a: unknown[]) => mockLogCreate(...a),
    },
  },
}));
jest.mock("~/lib/wiki-os/services/inbound-revision-sync", () => ({
  evictCaches: jest.fn().mockResolvedValue(undefined),
  isMirrorUser: jest.fn().mockReturnValue(false),
  verifiedWikiUserId: jest.fn().mockResolvedValue(null),
  syncLatestRevision: jest.fn().mockResolvedValue("known"),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({ enqueueRender: jest.fn() }));

const event = (over: Partial<LogEvent> & Pick<LogEvent, "type" | "action" | "title">): LogEvent => ({
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
  jest.mocked(isMirrorUser).mockReturnValue(false);
  mockLogFindFirst.mockResolvedValue(null);
  mockLogCreate.mockResolvedValue({});
  tx.wikiArticle.findUnique.mockResolvedValue(null);
  tx.wikiArticle.update.mockResolvedValue({});
  tx.wikiArticle.delete.mockResolvedValue({});
  tx.wikiRestriction.findUnique.mockResolvedValue(null);
  tx.wikiBlock.findFirst.mockResolvedValue(null);
  tx.wikiUserGroup.findUnique.mockResolvedValue(null);
});

describe("which events are applied", () => {
  it.each(["upload", "import", "newusers", "patrol", "thanks", "create"])(
    "ignores %s events",
    async (type) => {
      await expect(applyLogEvent(event({ type, action: type, title: "Foo" }))).resolves.toBe("ignored");

      expect(mockLogCreate).not.toHaveBeenCalled();
    }
  );

  it("ignores what the mirror account did: WikiOS's own act coming back", async () => {
    jest.mocked(isMirrorUser).mockReturnValue(true);

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo", user: "Mirror" }))
    ).resolves.toBe("ignored");

    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("applies an event once: its MediaWiki log id is looked up in wiki_logs first", async () => {
    mockLogFindFirst.mockResolvedValue({ id: "log-1" });

    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Foo" }))
    ).resolves.toBe("ignored");

    expect(mockLogFindFirst).toHaveBeenCalledWith({
      where: { params: { path: ["mwLogId"], equals: 501 } },
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
      params: { mwLogId: 501 },
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

  it("logs the deletion of a page WikiOS never held, and a second deletion changes nothing", async () => {
    await expect(
      applyLogEvent(event({ type: "delete", action: "delete", title: "Nowhere" }))
    ).resolves.toBe("applied");
    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(loggedRow()).toMatchObject({ articleId: null });

    tx.wikiArticle.findUnique.mockResolvedValue({ id: "art-1", status: "ARCHIVED" });
    await applyLogEvent(event({ type: "delete", action: "delete", title: "Foo", logid: 502 }));
    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
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

    expect(tx.wikiArticle.update).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { status: "PUBLISHED" },
    });
    expect(syncLatestRevision).toHaveBeenCalledWith("Foo");
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

  it("credits the log row to the WikiOS user behind the MediaWiki account when the link is verified", async () => {
    const { verifiedWikiUserId } = jest.requireMock("~/lib/wiki-os/services/inbound-revision-sync");
    verifiedWikiUserId.mockResolvedValueOnce("user-7");

    await applyLogEvent(event({ type: "delete", action: "delete", title: "Foo" }));

    expect(loggedRow()).toMatchObject({ userId: "user-7", actorName: "Admin" });
  });
});

describe("move", () => {
  const moveEvent = (params: LogEvent["params"] = { target_title: "New name", target_ns: 0 }, action = "move") =>
    event({ type: "move", action, title: "Old name", params });

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

  it("stores a new namespace when the page moves across namespaces", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name" ? { id: "art-1" } : null
    );

    await applyLogEvent(moveEvent({ target_title: "User:Jane/Draft", target_ns: 2 }));

    expect(tx.wikiArticle.update.mock.calls[0]?.[0].data).toMatchObject({
      title: "User:Jane/Draft",
      namespace: 2,
      namespacePrefix: "User",
    });
  });

  it("does not look for a redirect when MediaWiki left none (suppressredirect)", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name" ? { id: "art-1" } : null
    );

    await applyLogEvent(moveEvent({ target_title: "New name", suppressredirect: true }));

    expect(syncLatestRevision).not.toHaveBeenCalled();
  });

  it("refuses to rename onto a page WikiOS has (and logs nothing)", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name"
        ? { id: "art-1" }
        : { id: "art-2", redirectTargetSlug: null }
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(applyLogEvent(moveEvent())).resolves.toBe("skipped");

    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("moves a page over a redirect: the redirect at the new title is gone", async () => {
    tx.wikiArticle.findUnique.mockImplementation(async ({ where }) =>
      where.source_title.title === "Old name"
        ? { id: "art-1" }
        : { id: "art-2", redirectTargetSlug: "Old name" }
    );

    await expect(applyLogEvent(moveEvent(undefined, "move_redir"))).resolves.toBe("applied");

    expect(tx.wikiArticle.delete).toHaveBeenCalledWith({ where: { id: "art-2" } });
    expect(tx.wikiArticle.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "art-1" } })
    );
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

  it("logs a move of a page WikiOS never held without importing anything", async () => {
    await expect(applyLogEvent(moveEvent())).resolves.toBe("applied");

    expect(syncLatestRevision).not.toHaveBeenCalled();
    expect(loggedRow()).toMatchObject({ articleId: null });
  });

  it("skips a move whose target is not a title", async () => {
    await expect(applyLogEvent(moveEvent({ target_title: "a[b" }))).resolves.toBe("skipped");
    expect(mockLogCreate).not.toHaveBeenCalled();
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
            { type: "move", level: "autoconfirmed", expiry: "2030-01-01T00:00:00Z", cascade: false },
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
    expect(loggedRow()).toMatchObject({ logType: "protect", action: "protect", articleId: "art-1" });
  });

  it("modifies: the restrictions MediaWiki no longer lists are removed", async () => {
    await applyLogEvent(
      protectEvent({ details: [{ type: "edit", level: "autoconfirmed", expiry: "infinity" }] }, "modify")
    );

    expect(tx.wikiRestriction.upsert).toHaveBeenCalledTimes(1);
    expect(tx.wikiRestriction.deleteMany).toHaveBeenCalledTimes(3);
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
      protectEvent({ details: [{ type: "edit", level: "templateeditor", expiry: "infinity", cascade: true }] })
    );

    expect(tx.wikiRestriction.upsert.mock.calls[0]?.[0].create).toMatchObject({
      level: "sysop",
      cascade: true,
    });
  });

  it("protects the title of a page that does not exist yet (create protection)", async () => {
    await applyLogEvent(protectEvent({ details: [{ type: "create", level: "sysop", expiry: "infinity" }] }, "protect", "Not yet"));

    expect(tx.wikiRestriction.upsert.mock.calls[0]?.[0].where.source_title_action).toEqual({
      source: "ixwiki",
      title: "Not yet",
      action: "create",
    });
    expect(tx.wikiArticle.update).not.toHaveBeenCalled();
    expect(loggedRow()).toMatchObject({ articleId: null });
  });

  it("is tolerant of a details list it cannot read: it applies nothing, writes no row and says so", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(applyLogEvent(protectEvent({ details: "nonsense" }))).resolves.toBe("skipped");
    await expect(applyLogEvent(protectEvent({ details: [{ type: "edit" }] }))).resolves.toBe("skipped");

    expect(tx.wikiRestriction.upsert).not.toHaveBeenCalled();
    expect(tx.wikiRestriction.deleteMany).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores a protection moving along with its page (the move event moves it)", async () => {
    await expect(applyLogEvent(protectEvent({}, "move_prot"))).resolves.toBe("ignored");
  });
});

describe("block", () => {
  const blockEvent = (params: LogEvent["params"], action = "block", title = "User:Troll") =>
    event({ type: "block", action, title, params });

  it("records a sitewide block of the wiki account, with its expiry and reason", async () => {
    await expect(
      applyLogEvent(blockEvent({ duration: "1 week", expiry: "2026-10-04T10:00:00Z", flags: ["nocreate"], sitewide: true }))
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

  it("an indefinite block never expires, and 'nousertalk' takes the user's talk page away", async () => {
    await applyLogEvent(blockEvent({ duration: "infinite", expiry: "infinity", flags: ["nousertalk"] }));

    expect(tx.wikiBlock.create.mock.calls[0]?.[0].data).toMatchObject({
      expiresAt: null,
      allowUserTalk: false,
    });
  });

  it("changes the block it recorded on a reblock", async () => {
    tx.wikiBlock.findFirst.mockResolvedValue({ id: "block-1" });

    await applyLogEvent(blockEvent({ expiry: "infinity" }, "reblock"));

    expect(tx.wikiBlock.create).not.toHaveBeenCalled();
    expect(tx.wikiBlock.update).toHaveBeenCalledWith({
      where: { id: "block-1" },
      data: expect.objectContaining({ expiresAt: null }),
    });
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
    await expect(applyLogEvent(blockEvent({}, "block", "User:2001:db8::1"))).resolves.toBe("ignored");
    await expect(applyLogEvent(blockEvent({}, "block", "Foo"))).resolves.toBe("ignored");

    expect(tx.wikiBlock.create).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it("does not take a user whose name is only hexadecimal letters for an IP address", async () => {
    await expect(applyLogEvent(blockEvent({ expiry: "infinity" }, "block", "User:Dead"))).resolves.toBe("applied");
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
      { wikiUsername: "Jane", group: "bot", expiresAt: new Date("2027-01-01T00:00:00Z"), source: "mw-import" },
    ]);
    expect(loggedRow()).toMatchObject({ logType: "rights", title: "User:Jane" });
  });

  it("removes the mapped groups MediaWiki took away, but only memberships this sync granted", async () => {
    await applyLogEvent(rightsEvent({ oldgroups: ["sysop", "bureaucrat", "autopatrolled"], newgroups: ["bureaucrat"] }));

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

  it("updates the expiry of a membership it granted", async () => {
    tx.wikiUserGroup.findUnique.mockResolvedValue({ id: "g1", source: "mw-import" });

    await applyLogEvent(
      rightsEvent({ oldgroups: ["sysop"], newgroups: ["sysop"], newmetadata: [{ group: "sysop", expiry: "2028-02-02T00:00:00Z" }] })
    );

    expect(tx.wikiUserGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { expiresAt: new Date("2028-02-02T00:00:00Z") },
    });
  });

  it("ignores a rights change that is not about a user", async () => {
    await expect(applyLogEvent(rightsEvent({ newgroups: ["sysop"] }, "Foo"))).resolves.toBe("ignored");
  });
});
