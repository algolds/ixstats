/** @jest-environment node */
/**
 * Plan 410: action=move|delete|undelete|protect|rollback. They authorize and write through the
 * same services as the tRPC page-admin router; these tests check the calls and MediaWiki's answers.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { TRPCError } from "@trpc/server";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const data = (): FakeWikiData => ({
  pages: [
    { pageId: 1, title: "Alpha" },
    { pageId: 2, title: "Beta" },
    { pageId: 3, title: "Talk:Alpha", namespace: 1 },
  ],
  revisions: [
    { revId: 101, page: "Alpha", timestamp: "2026-01-01T10:00:00Z", user: "Heku", content: "good text" },
    { revId: 102, page: "Alpha", timestamp: "2026-01-02T10:00:00Z", user: "Vandal", content: "vandalised" },
    { revId: 103, page: "Alpha", timestamp: "2026-01-03T10:00:00Z", user: "Vandal", content: "vandalised again" },
    { revId: 201, page: "Beta", timestamp: "2026-01-04T10:00:00Z", user: "Heku", content: "only author" },
  ],
});

async function setup(options: Parameters<typeof makeWikiDeps>[1] = {}, type = "csrf") {
  const wiki = await makeWikiDeps(data(), options);
  const token = await loggedIn(wiki.bot, type);
  const act = (action: string, params: Record<string, string>) =>
    wiki.bot.post({ action, token, formatversion: "2", ...params }) as Promise<Body>;
  const called = (name: string) => wiki.calls.filter((c) => c.name === name);
  return { ...wiki, token, act, called };
}

describe("every write action needs a bot session and its token", () => {
  it.each(["move", "delete", "undelete", "protect", "rollback"])("%s refuses an anonymous POST and a GET", async (action) => {
    const wiki = await makeWikiDeps(data());
    const anon = await wiki.bot.post({ action, title: "Alpha", token: "+\\" }) as Body;
    expect(anon.error.code).toBe("writeapidenied");
    const get = await wiki.bot.get({ action, title: "Alpha" }) as Body;
    expect(get.error.code).toBe("mustbeposted");
  });

  it.each(["move", "delete", "undelete", "protect"])("%s refuses a wrong token", async (action) => {
    const { bot } = await setup();
    const body = (await bot.post({ action, title: "Alpha", from: "Alpha", to: "Gamma", protections: "edit=sysop", token: "nope+\\" })) as Body;
    expect(body.error.code).toBe("badtoken");
  });
});

describe("action=delete", () => {
  it("authorizes `delete` and archives the page with the bot's name", async () => {
    const { act, called } = await setup();
    const body = await act("delete", { title: "alpha", reason: "junk" });
    expect(body.delete).toEqual({ title: "Alpha", reason: "junk" });
    expect(called("authorize")[0]!.args.slice(1)).toEqual(["delete", "Alpha"]);
    expect(called("archivePage")[0]!.args).toEqual(["Alpha", "junk", { userId: "u-heku", name: "Heku" }]);
  });

  it("takes a page id, and maps the service's refusals", async () => {
    const { act, called } = await setup();
    expect((await act("delete", { pageid: "2" })).delete.title).toBe("Beta");
    expect(called("archivePage")[0]!.args[0]).toBe("Beta");
    expect((await act("delete", { pageid: "99" })).error.code).toBe("nosuchpageid");
    expect((await act("delete", {})).error.code).toBe("missingparam");

    const gone = await setup({ services: { archivePage: async () => { throw new PageOperationError("CONFLICT", "already deleted"); } } });
    expect((await gone.act("delete", { title: "Alpha" })).error.code).toBe("missingtitle");
    const denied = await setup({ services: { authorize: async () => { throw new TRPCError({ code: "FORBIDDEN", message: 'permissiondenied: You do not have the "delete" right.' }); } } });
    expect((await denied.act("delete", { title: "Alpha" })).error.code).toBe("permissiondenied");
    expect(denied.called("archivePage")).toHaveLength(0);
  });
});

describe("action=undelete", () => {
  it("authorizes undelete, restores, and reports the revision count", async () => {
    const { act, called } = await setup();
    const body = await act("undelete", { title: "Alpha", reason: "oops" });
    expect(body.undelete).toEqual({ title: "Alpha", revisions: 3, fileversions: 0, reason: "oops" });
    expect(called("authorize")[0]!.args.slice(1)).toEqual(["undelete", "Alpha"]);
    expect(called("restorePage")[0]!.args).toEqual(["Alpha", "oops", { userId: "u-heku", name: "Heku" }]);
  });

  it("answers cantundelete when there is nothing to restore", async () => {
    const { act } = await setup({ services: { restorePage: async () => { throw new PageOperationError("CONFLICT", "not deleted"); } } });
    expect((await act("undelete", { title: "Alpha" })).error.code).toBe("cantundelete");
  });
});

describe("action=move", () => {
  it("authorizes the whole move first, then moves, answering from, to and the redirect", async () => {
    const { act, called, calls } = await setup();
    const body = await act("move", { from: "Alpha", to: "gamma", reason: "rename", movetalk: "" });
    expect(body.move).toEqual({ from: "Alpha", to: "Gamma", reason: "rename", redirectcreated: true });
    expect(called("authorizeMove")[0]!.args.slice(1)).toEqual(["Alpha", "Gamma", { moveTalk: true, leaveRedirect: true }]);
    // a sysop whose grants include delete (deletedhistory + undelete) may also move a deleted page
    expect(called("movePage")[0]!.args).toEqual(["Alpha", "Gamma", "rename", { userId: "u-heku", name: "Heku" }, { leaveRedirect: true, moveTalk: true, includeArchived: true }]);
    const order = calls.map((c) => c.name);
    expect(order.indexOf("authorizeMove")).toBeLessThan(order.indexOf("movePage"));
    expect(called("requireRight")).toHaveLength(0);
  });

  it("noredirect needs the suppressredirect right and leaves no redirect", async () => {
    const { act, called } = await setup();
    const body = await act("move", { from: "Alpha", to: "Gamma", noredirect: "" });
    expect(called("requireRight")[0]!.args.slice(1)).toEqual(["suppressredirect"]);
    expect(called("movePage")[0]!.args[4]).toMatchObject({ leaveRedirect: false });
    expect(body.move.redirectcreated).toBe(true); // the fake service always reports one; the flag is what matters
  });

  it("reports a moved talk page, warns about subpages, and maps refusals", async () => {
    const talk = await setup({
      services: {
        movePage: async (from, to) => ({ success: true, oldTitle: from, newTitle: to, oldSlug: "", newSlug: "", redirectArticleId: null, movedArticleId: "a", linksUpdated: 0, talk: { oldTitle: "Talk:Alpha", newTitle: "Talk:Gamma", oldSlug: "", newSlug: "", redirectArticleId: null, movedArticleId: "t", linksUpdated: 0 } }),
      },
    });
    const body = await talk.act("move", { from: "Alpha", to: "Gamma", movetalk: "", movesubpages: "" });
    expect(body.move).toEqual({ from: "Alpha", to: "Gamma", reason: "", redirectcreated: false, talkfrom: "Talk:Alpha", talkto: "Talk:Gamma" });
    expect(body.warnings.move.warnings).toContain("subpages");

    const refusals: Array<[PageOperationError, string]> = [
      [new PageOperationError("NOT_FOUND", "no page"), "missingtitle"],
      [new PageOperationError("CONFLICT", "destination exists"), "articleexists"],
      [new PageOperationError("BAD_REQUEST", "identical"), "selfmove"],
    ];
    for (const [error, code] of refusals) {
      const { act } = await setup({ services: { movePage: async () => { throw error; } } });
      expect((await act("move", { from: "Alpha", to: "Gamma" })).error.code).toBe(code);
    }
    const { act } = await setup();
    expect((await act("move", { from: "Alpha" })).error.code).toBe("missingparam");
    expect((await act("move", { from: "Alpha", to: "Bad[title" })).error.code).toBe("invalidtitle");
    expect((await act("move", { fromid: "1", to: "Gamma" })).move.from).toBe("Alpha");
  });
});

describe("action=protect", () => {
  it("authorizes each level, writes the restrictions and answers one object per protection", async () => {
    const { act, called } = await setup();
    const body = await act("protect", { title: "Alpha", protections: "edit=sysop|move=autoconfirmed", expiry: "infinite", reason: "vandalism" });
    expect(body.protect).toEqual({
      title: "Alpha",
      reason: "vandalism",
      protections: [
        { edit: "sysop", expiry: "infinity" },
        { move: "autoconfirmed", expiry: "infinity" },
      ],
    });
    expect(called("authorizeProtection")[0]!.args.slice(1)).toEqual(["Alpha", ["sysop", "autoconfirmed"]]);
    expect(called("protectPage")[0]!.args[0]).toMatchObject({
      title: "Alpha",
      reason: "vandalism",
      actor: { userId: "u-heku", name: "Heku" },
      changes: [
        { action: "edit", level: "sysop", expiresAt: null },
        { action: "move", level: "autoconfirmed", expiresAt: null },
      ],
    });
  });

  it("removes a protection with `all`, takes one expiry each, and understands spans and timestamps", async () => {
    const { act, called } = await setup();
    const body = await act("protect", { title: "Alpha", protections: "edit=sysop|move=all|upload=sysop", expiry: "1 week|infinite|2030-01-01T00:00:00Z" });
    expect(body.protect.protections).toEqual([
      { edit: "sysop", expiry: "2026-10-07T12:00:00Z" },
      { move: "", expiry: "infinity" },
      { upload: "sysop", expiry: "2030-01-01T00:00:00Z" },
    ]);
    const changes = called("protectPage")[0]!.args[0] as Body;
    expect(changes.changes[1]).toEqual({ action: "move", level: null, expiresAt: null });
    expect(called("authorizeProtection")[0]!.args[2]).toEqual(["sysop", null, "sysop"]);
  });

  it("refuses bad protections, expiries and cascade", async () => {
    const { act, called } = await setup();
    expect((await act("protect", { title: "Alpha" })).error.code).toBe("missingparam");
    expect((await act("protect", { title: "Alpha", protections: "nonsense=sysop" })).error.code).toBe("badvalue");
    expect((await act("protect", { title: "Alpha", protections: "edit=root" })).error.code).toBe("badvalue");
    expect((await act("protect", { title: "Alpha", protections: "edit=sysop", expiry: "someday" })).error.code).toBe("invalidexpiry");
    expect((await act("protect", { title: "Alpha", protections: "edit=sysop", expiry: "2001-01-01T00:00:00Z" })).error.code).toBe("pastexpiry");
    expect((await act("protect", { title: "Alpha", protections: "edit=sysop|move=sysop", expiry: "1 day|1 day|1 day" })).error.code).toBe("toofewexpiries");
    expect((await act("protect", { title: "Alpha", protections: "edit=sysop", cascade: "" })).error.code).toBe("cantcascade");
    expect(called("protectPage")).toHaveLength(0);
  });

  it("can protect a title that does not exist (create protection)", async () => {
    const { act, called } = await setup();
    expect((await act("protect", { title: "Not yet", protections: "create=sysop" })).protect.title).toBe("Not yet");
    expect(called("protectPage")).toHaveLength(1);
  });
});

describe("action=rollback", () => {
  it("needs the rollback token, not the csrf one", async () => {
    const wiki = await makeWikiDeps(data());
    await loggedIn(wiki.bot);
    const csrf = ((await wiki.bot.get({ action: "query", meta: "tokens", formatversion: "2" })) as Body).query.tokens.csrftoken;
    const body = (await wiki.bot.post({ action: "rollback", title: "Alpha", user: "Vandal", token: csrf })) as Body;
    expect(body.error.code).toBe("badtoken");
  });

  it("restores the last revision by someone else, in one new edit", async () => {
    const { act, called } = await setup({}, "rollback");
    const body = await act("rollback", { title: "Alpha", user: "Vandal" });
    expect(body.rollback).toEqual({
      title: "Alpha",
      pageid: 1,
      summary: "Reverted edits by Vandal to last revision by Heku",
      revid: 9000,
      old_revid: 103,
      last_revid: 101,
    });
    expect(called("authorize")[0]!.args.slice(1)).toEqual(["rollback", "Alpha"]);
    expect(called("requireRestorableWikitext")[0]!.args.slice(1)).toEqual(["Alpha", { wikitext: "good text", title: "Alpha", parked: false }]);
    expect(called("saveWikitext")[0]!.args[1]).toEqual({
      title: "Alpha",
      wikitext: "good text",
      summary: "Reverted edits by Vandal to last revision by Heku",
      minor: false,
    });
  });

  it("uses the given summary, and refuses when the page's last editor is someone else or the only author", async () => {
    const { act, called } = await setup({}, "rollback");
    expect((await act("rollback", { title: "Alpha", user: "Heku" })).error.code).toBe("alreadyrolled");
    expect((await act("rollback", { title: "Beta", user: "Heku" })).error.code).toBe("onlyauthor");
    expect((await act("rollback", { title: "Nowhere", user: "Heku" })).error.code).toBe("missingtitle");
    expect((await act("rollback", { title: "Alpha" })).error.code).toBe("missingparam");
    expect(called("saveWikitext")).toHaveLength(0);
    expect((await act("rollback", { title: "Alpha", user: "Vandal", summary: "undo vandalism" })).rollback.summary).toBe("undo vandalism");
  });

  it("refuses a rollback the service will not allow (a blanking, a placeholder)", async () => {
    const { act, called } = await setup({
      services: { requireRestorableWikitext: async () => { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This revision's text has not been imported yet." }); } },
    }, "rollback");
    const body = await act("rollback", { title: "Alpha", user: "Vandal" });
    expect(body.error.info).toContain("not been imported");
    expect(called("saveWikitext")).toHaveLength(0);
  });
});
