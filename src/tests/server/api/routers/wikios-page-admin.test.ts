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

  it("can leave no redirect and keep the talk page", async () => {
    const result = await as(memberCtx()).movePage({
      from: "Old name",
      to: "New name",
      leaveRedirect: false,
      moveTalk: false,
    });

    expect(result).toMatchObject({ redirectCreated: false, talkMoved: false });
    expect(tables.wikiArticle.rows.map((row) => row.title).sort()).toEqual([
      "New name",
      "Talk:Old name",
    ]);
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

  it("updates in place and removes a restriction with a null level, restoring the mirror", async () => {
    const protect = (level: "sysop" | "autoconfirmed" | null) =>
      as(sysopCtx()).protectPage({ title: "Old name", restrictions: [{ action: "edit", level }] });

    await protect("autoconfirmed");
    await protect("sysop");
    expect(tables.wikiRestriction.rows).toHaveLength(1);
    expect(tables.wikiRestriction.rows[0]).toMatchObject({ level: "sysop" });

    await protect(null);
    expect(tables.wikiRestriction.rows).toHaveLength(0);
    expect(tables.wikiArticle.rows.find((row) => row.id === "a-old")).toMatchObject({
      protectionLevel: "ALL",
    });
    expect(logTypes()).toEqual(["protect/protect", "protect/protect", "protect/unprotect"]);
  });

  it("protects a title that has no page yet (create-protection) and hides expired protections", async () => {
    await as(sysopCtx()).protectPage({
      title: "Salted",
      restrictions: [{ action: "create", level: "sysop" }],
    });
    expect(tables.wikiRestriction.rows[0]).toMatchObject({ title: "Salted", action: "create" });

    tables.wikiRestriction.rows[0]!.expiresAt = new Date(Date.now() - DAY);
    expect((await anonymous().getPageRestrictions({ title: "Salted" })).restrictions).toEqual([]);
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

  it("unblocks, logs it, and answers NOT_FOUND for someone who is not blocked", async () => {
    await expect(
      as(sysopCtx()).unblockUser({ target: { wikiUsername: "Victim" } })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await as(sysopCtx()).blockUser({ target: { wikiUsername: "Victim" } });
    await as(sysopCtx()).unblockUser({ target: { wikiUsername: "Victim" }, reason: "sorry" });

    expect(tables.wikiBlock.rows).toHaveLength(0);
    expect(logTypes()).toEqual(["block/block", "block/unblock"]);
    expect((await anonymous().listBlocks({})).blocks).toEqual([]);
  });

  it("lists only blocks in force", async () => {
    tables.wikiBlock.seed(
      { wikiUsername: "Gone", expiresAt: new Date(Date.now() - DAY) },
      { wikiUsername: "Here", expiresAt: inFuture() },
      { wikiUsername: "Forever" }
    );
    const { blocks } = await anonymous().listBlocks({});
    expect(blocks.map((block) => block.target).sort()).toEqual(["Forever", "Here"]);
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

  it("keys a membership by wiki username while no WikiOS user has verified it", async () => {
    await as(memberCtx()).setUserGroups({
      target: { wikiUsername: "unlinked_admin" },
      add: ["sysop"],
      expiresAt: inFuture(),
    });
    const row = tables.wikiUserGroup.rows.find((candidate) => candidate.group === "sysop");
    expect(row).toMatchObject({ wikiUsername: "Unlinked admin" });
    expect(row).not.toHaveProperty("userId");

    const shown = await anonymous().getUserPermissions({ user: "Unlinked admin" });
    expect(shown.groups).toContain("sysop");
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

  it("lets the owner (a bureaucrat by role) change groups too", async () => {
    await as(ownerCtx()).setUserGroups({
      target: { userId: "dbvictim" },
      add: ["interface-admin"],
    });
    expect(tables.wikiUserGroup.rows.find((row) => row.group === "interface-admin")).toMatchObject({
      userId: "dbvictim",
      addedById: "dbowner",
    });
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

  it("gives the caller their own groups, rights and what they may change", async () => {
    const own = await as(ownerCtx()).getUserPermissions();
    expect(own.groups).toEqual(expect.arrayContaining(["sysop", "bureaucrat", "interface-admin"]));
    expect(own.changeableGroups).toEqual(expect.arrayContaining(["sysop", "bot"]));

    const member = await as(memberCtx()).getUserPermissions();
    expect(member).toMatchObject({ username: "Member" });
    expect(member.groups).toEqual(expect.arrayContaining(["user", "autoconfirmed"]));
    expect(member.rights).toContain("move");
    expect(member.rights).not.toContain("delete");
  });

  it("reports the IxStates role mapping for another user", async () => {
    tables.user.seed({
      id: "dbadmin",
      wikiUsername: null,
      clerkUserId: "user_adm",
      role: { name: "admin" },
    });
    tables.wikiAccountLink.seed({
      userId: "dbadmin",
      source: "ixwiki",
      username: "Adm",
      verifiedAt: new Date(),
    });
    const shown = await anonymous().getUserPermissions({ user: "adm" });
    expect(shown.groups).toContain("sysop");
    expect(shown.explicitGroups).toEqual([]);
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

  it("returns entries newest first, filtered by type, title and user", async () => {
    const all = await anonymous().getLog({});
    expect(all.entries.map((entry) => `${entry.type}/${entry.action}`)).toEqual([
      "block/block",
      "delete/delete",
      "protect/protect",
    ]);
    expect(all.entries[0]).toMatchObject({ actor: "Boss", title: "User:Victim" });

    expect((await anonymous().getLog({ type: "protect" })).entries).toHaveLength(1);
    expect((await anonymous().getLog({ title: "old_name" })).entries).toHaveLength(2);
    expect((await anonymous().getLog({ user: "Mod" })).entries).toHaveLength(2);
    expect((await anonymous().getLog({ user: "Nobody" })).entries).toEqual([]);
  });

  it("pages with a cursor", async () => {
    const first = await anonymous().getLog({ limit: 2 });
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await anonymous().getLog({ limit: 2, cursor: first.nextCursor! });
    expect(second.entries.map((entry) => entry.type)).toEqual(["protect"]);
    expect(second.nextCursor).toBeNull();
  });

  it("never returns an internal or auth-provider id", async () => {
    const text = JSON.stringify(await anonymous().getLog({ limit: 500 }));
    expect(text).not.toMatch(/dbsysop|dbowner|dbmember|user_sysop|user_owner/);
  });

  it("bounds the page size at 500", async () => {
    await expect(anonymous().getLog({ limit: 501 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
