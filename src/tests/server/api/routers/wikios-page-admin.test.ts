/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 409: the page-admin router (move, delete, undelete, protect, block, groups, log) running the real
// PageManagementService, RightsAdminService and rights engine over an in-memory fake of the WikiOS tables.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
  isDatabaseReadOnly: true,
}));
// The kick would run the mirror worker in a timer; the jobs themselves are real (the fake database holds them).
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosPageAdminRouter } from "~/server/api/routers/wikios/page-admin";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;
const createCaller = createCallerFactory(wikiosPageAdminRouter);
const DAY = 24 * 60 * 60 * 1000;
const inFuture = () => new Date(Date.now() + DAY);

/** A signed-in caller. `id` is the WikiOS user id, `clerk` the auth-provider id. */
const ctxFor = (id: string, clerk: string, name: string, role = "user") =>
  createMockRouterContext({
    auth: { userId: clerk },
    user: { id: id, clerkUserId: clerk, wikiUsername: name, role: { name: role, level: 100 } },
  });

const as = (ctx: ReturnType<typeof ctxFor>) => createCaller(ctx as never);

const ownerCtx = () => ctxFor("dbowner", "user_owner", "Boss", "owner");
const sysopCtx = () => ctxFor("dbsysop", "user_sysop", "Mod", "admin");
const plainCtx = () => ctxFor("dbplain", "user_plain", "Newbie");
/** autoconfirmed through a verified wiki link (seeded in beforeEach). */
const memberCtx = () => ctxFor("dbmember", "user_member", "Member");
const anonymous = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

const logTypes = () => tables.wikiLog.rows.map((row) => `${row.logType}/${row.action}`);

beforeEach(() => {
  fakeWikiDb.reset();
  tables.user.seed(
    { id: "dbowner", wikiUsername: null },
    { id: "dbsysop", wikiUsername: "Mod" },
    { id: "dbplain", wikiUsername: null },
    { id: "dbmember", wikiUsername: "Member" },
    { id: "dbvictim", wikiUsername: "Victim" }
  );
  tables.wikiAccountLink.seed(
    {
      userId: "dbmember",
      source: "ixwiki",
      username: "Member",
      verifiedAt: new Date("2026-01-01"),
    },
    { userId: "dbvictim", source: "ixwiki", username: "Victim", verifiedAt: new Date("2026-01-01") }
  );
  tables.wikiArticle.seed(
    {
      id: "a-old",
      source: "ixwiki",
      title: "Old name",
      slug: "old_name",
      namespace: 0,
      wikitext: "text",
    },
    {
      id: "a-talk",
      source: "ixwiki",
      title: "Talk:Old name",
      slug: "talk:old_name",
      namespace: 1,
      wikitext: "chat",
    }
  );
});

describe("movePage", () => {
  it("moves a page for an autoconfirmed user: redirect with its revision, the talk page, the log", async () => {
    const result = await as(memberCtx()).movePage({
      from: "old_name",
      to: "New name",
      reason: "tidy",
    });

    expect(result).toEqual({
      success: true,
      from: "Old name",
      to: "New name",
      redirectCreated: true,
      talkMoved: true,
    });
    const titles = tables.wikiArticle.rows.map((row) => row.title).sort();
    expect(titles).toEqual(["New name", "Old name", "Talk:New name", "Talk:Old name"]);
    // the page keeps its row (so its revisions stay), the old title is a redirect with a revision of its own
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.title).toBe("New name");
    const redirect = tables.wikiArticle.rows.find((row) => row.title === "Old name");
    expect(redirect).toMatchObject({
      wikitext: "#REDIRECT [[New name]]",
      redirectTargetSlug: "New name",
    });
    expect(tables.wikiRevision.rows.find((row) => row.articleId === redirect?.id)).toMatchObject({
      wikitext: "#REDIRECT [[New name]]",
      author: "Member",
    });
    expect(logTypes()).toEqual(["move/move", "move/move"]);
    expect(tables.wikiLog.rows[0]).toMatchObject({
      actorName: "Member",
      userId: "dbmember",
      comment: "tidy",
    });
  });
  it("is forbidden without the move right, into a protected namespace, or past a move protection", async () => {
    await expect(
      as(plainCtx()).movePage({ from: "Old name", to: "New name" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: /),
    });
    await expect(
      as(memberCtx()).movePage({ from: "Old name", to: "Template:Old name" })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/^namespaceprotected: /),
    });
    tables.wikiRestriction.seed({
      source: "ixwiki",
      title: "Old name",
      action: "move",
      level: "sysop",
    });
    await expect(
      as(memberCtx()).movePage({ from: "Old name", to: "New name" })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/^protectedpage: /),
    });
    expect(tables.wikiArticle.rows.map((row) => row.title)).toContain("Old name");
    expect(tables.wikiLog.rows).toHaveLength(0);

    await as(sysopCtx()).movePage({ from: "Old name", to: "New name" });
    expect(tables.wikiArticle.rows.map((row) => row.title)).toContain("New name");
  });

  describe("a File: page (F37: files cannot be moved in WikiOS yet)", () => {
    beforeEach(() => {
      tables.wikiArticle.seed({
        id: "a-file",
        source: "ixwiki",
        title: "File:Flag.png",
        slug: "file:flag.png",
        namespace: 6,
        wikitext: "A flag.",
      });
    });
    const FILE_MESSAGE = "Files cannot be moved in WikiOS yet; move them on classic MediaWiki.";

    it.each([
      ["a File: page to another File: title", { from: "File:Flag.png", to: "File:Banner.png" }],
      ["a File: page out of the namespace", { from: "File:Flag.png", to: "Banner" }],
      ["a page into the File: namespace", { from: "Old name", to: "File:Banner.png" }],
    ])("refuses to move %s, even for a sysop, and changes nothing", async (_name, input) => {
      await expect(as(sysopCtx()).movePage(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: FILE_MESSAGE,
      });

      expect(tables.wikiArticle.rows.map((row) => row.title).sort()).toEqual([
        "File:Flag.png",
        "Old name",
        "Talk:Old name",
      ]);
      expect(tables.wikiLog.rows).toHaveLength(0);
      expect(tables.wikiMirrorJob.rows).toHaveLength(0);
    });
  });

  it("needs suppressredirect to move without leaving a redirect", async () => {
    await expect(
      as(memberCtx()).movePage({ from: "Old name", to: "New name", leaveRedirect: false })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: .*suppressredirect/),
    });
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.title).toBe("Old name");
  });

  // The security review: a deleted page must stay invisible to a mover, and a salted title stays salted.
  describe("a deleted page and a salted title", () => {
    beforeEach(() => {
      tables.wikiArticle.rows.find((row) => row.id === "a-old")!.status = "ARCHIVED";
    });

    it("is NOT_FOUND to a mover without deletedhistory and undelete, and changes nothing", async () => {
      await expect(
        as(memberCtx()).movePage({ from: "Old name", to: "New name" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(tables.wikiArticle.rows.map((row) => row.title).sort()).toEqual([
        "Old name",
        "Talk:Old name",
      ]);
      expect(tables.wikiLog.rows).toHaveLength(0);
    });
    it("cannot be used to plant a redirect on a salted title: create-protection holds the old title", async () => {
      tables.wikiArticle.rows.find((row) => row.id === "a-old")!.status = "PUBLISHED";
      tables.wikiRestriction.seed({
        source: "ixwiki",
        title: "Old name",
        action: "create",
        level: "sysop",
      });

      await expect(
        as(memberCtx()).movePage({ from: "Old name", to: "New name" })
      ).rejects.toMatchObject({ message: expect.stringMatching(/^titleprotected: /) });
      expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.title).toBe("Old name");

      await as(sysopCtx()).movePage({ from: "Old name", to: "New name" });
      expect(tables.wikiArticle.rows.map((row) => row.title)).toContain("New name");
    });
  });

  describe("the talk destination is authorized like the main destination", () => {
    const protectDestinationTalk = () =>
      tables.wikiRestriction.seed({
        source: "ixwiki",
        title: "Talk:New name",
        action: "move",
        level: "sysop",
      });

    it("is refused to a mover its move protection keeps out, and leaves that protection in place", async () => {
      protectDestinationTalk();

      await expect(
        as(memberCtx()).movePage({ from: "Old name", to: "New name" })
      ).rejects.toMatchObject({ message: expect.stringMatching(/^protectedpage: /) });

      expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.title).toBe("Old name");
      expect(tables.wikiRestriction.rows.map((row) => row.title)).toEqual(["Talk:New name"]);
    });
  });

  describe("protection follows the page", () => {
    const seedProtections = (withCreate = true) =>
      tables.wikiRestriction.seed(
        { source: "ixwiki", title: "Old name", action: "edit", level: "sysop" },
        { source: "ixwiki", title: "Old name", action: "move", level: "autoconfirmed" },
        { source: "ixwiki", title: "Old name", action: "upload", level: "sysop" },
        ...(withCreate
          ? [{ source: "ixwiki", title: "Old name", action: "create", level: "sysop" }]
          : [])
      );
    const restrictionsAt = (title: string) =>
      tables.wikiRestriction.rows
        .filter((row) => row.title === title)
        .map((row) => `${row.action}:${row.level}`)
        .sort();

    it("is refused to a mover the page's edit protection keeps out, leaving everything in place", async () => {
      seedProtections(false);
      await expect(
        as(memberCtx()).movePage({ from: "Old name", to: "New name" })
      ).rejects.toMatchObject({ message: expect.stringMatching(/^protectedpage: /) });

      expect(restrictionsAt("Old name")).toHaveLength(3);
      expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.title).toBe("Old name");
    });
  });

  it("refuses a destination that exists, a missing page and an invalid title", async () => {
    tables.wikiArticle.seed({
      source: "ixwiki",
      title: "New name",
      slug: "new_name",
      namespace: 0,
      wikitext: "x",
    });
    await expect(
      as(memberCtx()).movePage({ from: "Old name", to: "New name" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      as(memberCtx()).movePage({ from: "Nowhere", to: "Elsewhere" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(as(memberCtx()).movePage({ from: "Old name", to: "a[b" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("deletePage / undeletePage", () => {
  it("lets a sysop delete and undelete a page, logging both", async () => {
    await as(sysopCtx()).deletePage({ title: "Old name", reason: "spam" });
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.status).toBe("ARCHIVED");

    await as(sysopCtx()).undeletePage({ title: "Old name", reason: "mistake" });
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.status).toBe("PUBLISHED");
    expect(logTypes()).toEqual(["delete/delete", "delete/restore"]);
    expect(tables.wikiLog.rows.map((row) => row.actorName)).toEqual(["Mod", "Mod"]);
    expect(tables.wikiLog.rows.map((row) => row.comment)).toEqual(["spam", "mistake"]);
  });

  it("is forbidden without the delete / undelete right", async () => {
    await expect(as(memberCtx()).deletePage({ title: "Old name" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(as(memberCtx()).undeletePage({ title: "Old name" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")?.status).toBe("PUBLISHED");
  });

  it("refuses to delete a page twice or to undelete one that is not deleted", async () => {
    await expect(as(sysopCtx()).undeletePage({ title: "Old name" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await as(sysopCtx()).deletePage({ title: "Old name" });
    await expect(as(sysopCtx()).deletePage({ title: "Old name" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(as(sysopCtx()).deletePage({ title: "Nowhere" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("keeps site script pages for interface-admins", async () => {
    tables.wikiArticle.seed({
      source: "ixwiki",
      title: "MediaWiki:Common.js",
      slug: "mediawiki:common.js",
      namespace: 8,
      wikitext: "x",
    });
    await expect(as(sysopCtx()).deletePage({ title: "MediaWiki:Common.js" })).rejects.toMatchObject(
      {
        message: expect.stringMatching(/^namespaceprotected: /),
      }
    );
    await as(ownerCtx()).deletePage({ title: "MediaWiki:Common.js" });
  });
});

describe("protectPage / getPageRestrictions", () => {
  it("writes the restrictions, mirrors the edit level onto the article and logs it", async () => {
    await as(sysopCtx()).protectPage({
      title: "old_name",
      restrictions: [
        { action: "edit", level: "sysop", expiresAt: inFuture() },
        { action: "move", level: "autoconfirmed", expiresAt: null },
      ],
      reason: "edit war",
    });

    expect(tables.wikiRestriction.rows.map((row) => `${row.action}:${row.level}`).sort()).toEqual([
      "edit:sysop",
      "move:autoconfirmed",
    ]);
    expect(tables.wikiRestriction.rows[0]).toMatchObject({
      source: "ixwiki",
      title: "Old name",
      reason: "edit war",
    });
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")).toMatchObject({
      protectionLevel: "SYSOP",
    });
    expect(tables.wikiLog.rows[0]).toMatchObject({
      logType: "protect",
      action: "protect",
      title: "Old name",
      actorName: "Mod",
    });

    const shown = await anonymous().getPageRestrictions({ title: "Old name" });
    expect(shown.restrictions.map((row) => row.action).sort()).toEqual(["edit", "move"]);
    expect(shown.restrictions[0]?.setBy).toBe("Mod");
    expect(JSON.stringify(shown)).not.toContain("dbsysop");
  });
  it("refuses cascading protection, which is not enforced yet, and stores nothing", async () => {
    await expect(
      as(sysopCtx()).protectPage({
        title: "Old name",
        restrictions: [{ action: "edit", level: "sysop" }],
        cascade: true,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Cascading protection is not supported yet"),
    });
    expect(tables.wikiRestriction.rows).toHaveLength(0);
  });

  it("is forbidden without the protect right, and refuses a past expiry", async () => {
    await expect(
      as(memberCtx()).protectPage({
        title: "Old name",
        restrictions: [{ action: "edit", level: "sysop" }],
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: /),
    });
    await expect(
      as(sysopCtx()).protectPage({
        title: "Old name",
        restrictions: [{ action: "edit", level: "sysop", expiresAt: new Date(Date.now() - DAY) }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tables.wikiRestriction.rows).toHaveLength(0);
  });
});

describe("blockUser / unblockUser / listBlocks", () => {
  it("blocks a wiki username nobody has linked, and the block follows a later verified link", async () => {
    const result = await as(sysopCtx()).blockUser({
      target: { wikiUsername: "vandal_bob" },
      reason: "vandalism",
      expiresAt: inFuture(),
    });

    expect(result).toEqual({ success: true, target: "Vandal bob" });
    expect(tables.wikiBlock.rows[0]).toMatchObject({
      userId: null,
      wikiUsername: "Vandal bob",
      reason: "vandalism",
    });
    expect(tables.wikiLog.rows[0]).toMatchObject({
      logType: "block",
      action: "block",
      title: "User:Vandal bob",
    });

    const shown = await anonymous().getUserPermissions({ user: "Vandal bob" });
    expect(shown.block).toMatchObject({ reason: "vandalism", allowUserTalk: true });

    // the wiki account is later linked by a WikiOS user: the block now applies to them
    tables.user.seed({ id: "dbbob", wikiUsername: null });
    tables.wikiAccountLink.seed({
      userId: "dbbob",
      source: "ixwiki",
      username: "Vandal bob",
      verifiedAt: new Date(),
    });
    const bob = ctxFor("dbbob", "user_bob", "Bob");
    expect((await as(bob).getUserPermissions()).block).toMatchObject({ reason: "vandalism" });
  });

  it("blocks a WikiOS user by id, refuses to block yourself, and changes an existing block in place", async () => {
    await expect(
      as(sysopCtx()).blockUser({ target: { userId: "dbsysop" }, reason: "oops" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await as(sysopCtx()).blockUser({
      target: { userId: "dbvictim" },
      reason: "first",
      allowUserTalk: true,
    });
    await as(sysopCtx()).blockUser({
      target: { userId: "dbvictim" },
      reason: "second",
      allowUserTalk: false,
    });

    expect(tables.wikiBlock.rows).toHaveLength(1);
    expect(tables.wikiBlock.rows[0]).toMatchObject({
      userId: "dbvictim",
      wikiUsername: "Victim",
      reason: "second",
      allowUserTalk: false,
      blockedById: "dbsysop",
    });
    expect(logTypes()).toEqual(["block/block", "block/reblock"]);

    const { blocks } = await anonymous().listBlocks({});
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ target: "Victim", blockedBy: "Mod", reason: "second" });
    expect(JSON.stringify(blocks)).not.toMatch(/db(victim|sysop)/);
  });
  it("is forbidden without the block right", async () => {
    await expect(
      as(memberCtx()).blockUser({ target: { wikiUsername: "Victim" } })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      as(memberCtx()).unblockUser({ target: { wikiUsername: "Victim" } })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(tables.wikiBlock.rows).toHaveLength(0);
  });

  it("refuses a target naming both a user id and a wiki username", async () => {
    await expect(
      as(sysopCtx()).blockUser({ target: { userId: "dbvictim", wikiUsername: "Victim" } as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("setUserGroups", () => {
  beforeEach(() => {
    tables.wikiUserGroup.seed({ userId: "dbmember", group: "bureaucrat" });
  });

  it("lets a bureaucrat add and remove groups of a linked user, logging the change", async () => {
    await as(memberCtx()).setUserGroups({
      target: { wikiUsername: "Victim" },
      add: ["sysop", "bot"],
      reason: "trusted",
    });
    expect(
      tables.wikiUserGroup.rows
        .filter((row) => row.userId === "dbvictim")
        .map((row) => row.group)
        .sort()
    ).toEqual(["bot", "sysop"]);
    expect(tables.wikiLog.rows[0]).toMatchObject({
      logType: "rights",
      title: "User:Victim",
      actorName: "Member",
      params: { added: ["sysop", "bot"], removed: [] },
    });

    const shown = await anonymous().getUserPermissions({ user: "Victim" });
    expect(shown.groups).toEqual(expect.arrayContaining(["sysop", "bot"]));
    expect(shown.rights).toContain("delete");
    expect(shown.explicitGroups.map((row) => row.group).sort()).toEqual(["bot", "sysop"]);

    await as(memberCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, remove: ["bot"] });
    expect((await anonymous().getUserPermissions({ user: "Victim" })).groups).not.toContain("bot");
  });
  it("only lets a bureaucrat change the groups on the changeable list", async () => {
    await expect(
      as(memberCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, add: ["rollbacker"] })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringMatching(/rollbacker/) });
    await expect(
      as(memberCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, remove: ["confirmed"] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tables.wikiUserGroup.rows).toHaveLength(1);
  });

  it("is forbidden to anyone without userrights, sysops included", async () => {
    await expect(
      as(sysopCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, add: ["sysop"] })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^permissiondenied: /),
    });
    await expect(
      as(plainCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, add: ["bot"] })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(tables.wikiUserGroup.rows).toHaveLength(1);
  });
  it("refuses adding and removing the same group, an empty change and a past expiry", async () => {
    const change = (input: object) =>
      as(ownerCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, ...input });
    await expect(change({ add: ["bot"], remove: ["bot"] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(change({})).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      change({ add: ["bot"], expiresAt: new Date(Date.now() - DAY) })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("getUserPermissions", () => {
  it("gives a signed-out caller the read right only", async () => {
    const perms = await anonymous().getUserPermissions();
    expect(perms).toMatchObject({
      username: null,
      groups: ["*"],
      rights: ["read"],
      block: null,
      changeableGroups: [],
    });
  });
});

describe("getLog", () => {
  beforeEach(async () => {
    await as(sysopCtx()).protectPage({
      title: "Old name",
      restrictions: [{ action: "edit", level: "sysop" }],
    });
    await as(sysopCtx()).deletePage({ title: "Old name" });
    await as(ownerCtx()).blockUser({ target: { wikiUsername: "Victim" } });
  });
  it("never returns an internal or auth-provider id", async () => {
    const text = JSON.stringify(await anonymous().getLog({ limit: 500 }));
    expect(text).not.toMatch(/dbsysop|dbowner|dbmember|user_sysop|user_owner/);
  });

  it("bounds the page size at 500", async () => {
    await expect(anonymous().getLog({ limit: 501 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("the mirror outbox (plan 407)", () => {
  const jobs = () => tables.wikiMirrorJob.rows;
  it("queues nothing for a refused operation, a block or a group change", async () => {
    await expect(as(plainCtx()).deletePage({ title: "Old name" })).rejects.toThrow();
    await as(ownerCtx()).blockUser({ target: { wikiUsername: "Victim" } });
    await as(ownerCtx()).setUserGroups({ target: { wikiUsername: "Victim" }, add: ["bot"] });

    expect(jobs()).toEqual([]);
  });
});
