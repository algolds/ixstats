/** @jest-environment node */
/**
 * api.php, the write family (plan 410): action=edit (tokens, md5, append/prepend, create, sections, the edit-conflict
 * checks and the races after them), delete, undelete, move, protect and rollback through the shared services,
 * action=purge, the section locator section edits rely on, and how the services' refusals reach a bot.
 */
// describeEachWikiosMode answers the switch and marker rows through this mock
jest.mock("~/server/db", () => ({ __esModule: true, db: { systemConfig: { findUnique: jest.fn() } } }));

import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { call, type FakeWikiData, loggedIn, makeWikiDeps } from "./harness";
import {
  replaceSection,
  sectionHeadings,
  sectionText,
} from "~/lib/wiki-os/wikitext/section-locator";
import { PageBusyError } from "~/lib/wiki-os/core/page-busy-error";
import { PageOperationError } from "~/lib/wiki-os/core/page-management-service";
import { toApiError } from "~/lib/wiki-os/api-compat/error-map";
import { HANDLE_REQUIRED_MESSAGE } from "~/lib/wiki-os/auth";
import { headMatchesBase } from "~/lib/wiki-os/core/edit-conflict-error";
import { describeEachWikiosMode } from "~/tests/helpers/wikios-modes";

describe("action=edit", () => {
  type Body = Record<string, any>;

  const SECTIONED = [
    "Lead text.",
    "",
    "== One ==",
    "one body",
    "",
    "=== One A ===",
    "a body",
    "",
    "== Two ==",
    "two body",
  ].join("\n");

  const fresh = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Existing" },
      { pageId: 2, title: "Sections" },
    ],
    revisions: [
      {
        revId: 101,
        page: "Existing",
        timestamp: "2026-01-01T10:00:00Z",
        user: "Heku",
        content: "Hello world",
      },
      {
        revId: 102,
        page: "Existing",
        timestamp: "2026-01-02T10:00:00Z",
        user: "Tester",
        content: "Hello brave world",
      },
      {
        revId: 201,
        page: "Sections",
        timestamp: "2026-01-03T10:00:00Z",
        user: "Heku",
        content: SECTIONED,
      },
    ],
  });

  const md5 = (text: string) => createHash("md5").update(text).digest("hex");

  async function setup(options: Parameters<typeof makeWikiDeps>[1] = {}) {
    const wiki = await makeWikiDeps(fresh(), options);
    const token = await loggedIn(wiki.bot);
    const edit = (params: Record<string, string>) =>
      wiki.bot.post({ action: "edit", token, formatversion: "2", ...params }) as Promise<Body>;
    const saves = () => wiki.calls.filter((c) => c.name === "saveWikitext");
    return { ...wiki, token, edit, saves };
  }

  describe("who may edit through api.php", () => {
    it("refuses an anonymous caller with writeapidenied, and a GET with mustbeposted", async () => {
      const { deps } = await setup();
      const anonymous = (
        await call(deps, "", {
          method: "POST",
          body: { action: "edit", title: "Existing", text: "x", token: "+\\" },
        })
      ).body as Body;
      expect(anonymous.error.code).toBe("writeapidenied");
      const get = (await call(deps, "action=edit&title=Existing&text=x&token=%2B%5C")).body as Body;
      expect(get.error.code).toBe("mustbeposted");
    });

    it("needs the session's token: missing is missingparam, wrong is badtoken", async () => {
      const { bot, saves } = await setup();
      expect(
        ((await bot.post({ action: "edit", title: "Existing", text: "x" })) as Body).error.code
      ).toBe("missingparam");
      expect(
        ((await bot.post({ action: "edit", title: "Existing", text: "x", token: "+\\" })) as Body)
          .error.code
      ).toBe("badtoken");
      expect(
        (
          (await bot.post({
            action: "edit",
            title: "Existing",
            text: "x",
            token: "abcdef+\\",
          })) as Body
        ).error.code
      ).toBe("badtoken");
      expect(saves()).toHaveLength(0);
    });
  });

  describe("parameters", () => {
    it("checks md5 of the text, or of prependtext+appendtext", async () => {
      const { edit, saves } = await setup();
      expect(
        (await edit({ title: "Existing", text: "new text", md5: "0".repeat(32) })).error.code
      ).toBe("badmd5");
      expect(
        (await edit({ title: "Existing", appendtext: "b", prependtext: "a", md5: md5("x") })).error
          .code
      ).toBe("badmd5");
      expect(
        (await edit({ title: "Existing", text: "new text", md5: md5("new text") })).edit.result
      ).toBe("Success");
      expect(
        (await edit({ title: "Existing", appendtext: "b", prependtext: "a", md5: md5("ab") })).edit
          .result
      ).toBe("Success");
      expect(saves()).toHaveLength(2);
    });
  });

  describe("saving", () => {
    it("replaces the text through the shared services and answers what Pywikibot reads", async () => {
      const { edit, calls, saves } = await setup();
      const body = await edit({ title: "existing_", text: "Brand new text", summary: "rewrite" });
      expect(body.edit).toEqual({
        result: "Success",
        pageid: 1,
        title: "Existing",
        contentmodel: "wikitext",
        oldrevid: 102,
        newrevid: 9000,
        newtimestamp: "2026-09-30T12:00:00Z",
      });
      expect(saves()).toHaveLength(1);
      expect(saves()[0]!.args[1]).toEqual({
        title: "Existing",
        wikitext: "Brand new text",
        summary: "rewrite",
        minor: false,
      });
      // the permission gate runs before the save, on the canonical title
      const order = calls.map((c) => c.name);
      expect(order.indexOf("assertCanEdit")).toBeGreaterThanOrEqual(0);
      expect(order.indexOf("assertCanEdit")).toBeLessThan(order.indexOf("saveWikitext"));
      expect(calls.find((c) => c.name === "assertCanEdit")!.args[1]).toBe("Existing");
    });
    it("appends and prepends to the current text", async () => {
      const { edit, saves } = await setup();
      await edit({ title: "Existing", appendtext: "\nMore", prependtext: "Intro\n" });
      expect((saves()[0]!.args[1] as Body).wikitext).toBe("Intro\nHello brave world\nMore");
    });

    it("creates a page with `new` and oldrevid 0; createonly refuses an existing one; nocreate a missing one", async () => {
      const { edit, saves } = await setup();
      const created = await edit({ title: "Fresh page", text: "I am new" });
      expect(created.edit).toMatchObject({
        result: "Success",
        new: true,
        title: "Fresh page",
        oldrevid: 0,
        newrevid: 9000,
      });
      expect((await edit({ title: "Existing", text: "x", createonly: "" })).error.code).toBe(
        "articleexists"
      );
      expect((await edit({ title: "Absent", text: "x", nocreate: "" })).error.code).toBe(
        "missingtitle"
      );
      expect(saves()).toHaveLength(1);
    });

    it("answers nochange, and saves nothing, when the text is the same", async () => {
      const { edit, saves } = await setup();
      const body = await edit({ title: "Existing", text: "Hello brave world" });
      expect(body.edit).toEqual({
        result: "Success",
        nochange: true,
        title: "Existing",
        pageid: 1,
        contentmodel: "wikitext",
      });
      expect(saves()).toHaveLength(0);
    });

    it("normalizes line endings and trailing whitespace like MediaWiki's save", async () => {
      const { edit, saves } = await setup();
      await edit({ title: "Existing", text: "line one\r\nline two  \r\n\r\n" });
      expect((saves()[0]!.args[1] as Body).wikitext).toBe("line one\nline two");
    });

    it("drops the control characters XML cannot carry (MediaWiki never stores them), but still refuses a NUL", async () => {
      const { edit, saves } = await setup();
      // a page that already has the text without them: nothing to save
      const same = await edit({ title: "Existing", text: "Hello\u0002 brave\u001F world" });
      expect(same.edit).toMatchObject({ result: "Success", nochange: true });
      expect(saves()).toHaveLength(0);
      await edit({ title: "Existing", text: "tab\there\u0001 and\u000B gone\uFFFE" });
      expect((saves()[0]!.args[1] as Body).wikitext).toBe("tab\there and gone");
      expect((await edit({ title: "Existing", text: "nul\u0000here" })).error.code).toBe(
        "invalidtext"
      );
    });
  });

  describe("sections", () => {
    it("replaces a numbered section (subsections included) and keeps the rest", async () => {
      const { edit, saves } = await setup();
      await edit({ title: "Sections", section: "1", text: "== One ==\nrewritten" });
      expect((saves()[0]!.args[1] as Body).wikitext).toBe(
        "Lead text.\n\n== One ==\nrewritten\n\n== Two ==\ntwo body"
      );
    });
    it("adds a new section with its heading, and a MediaWiki-style summary", async () => {
      const { edit, saves } = await setup();
      await edit({ title: "Sections", section: "new", sectiontitle: "Three", text: "three body" });
      expect(saves()[0]!.args[1]).toEqual({
        title: "Sections",
        wikitext: `${SECTIONED}\n\n== Three ==\n\nthree body`,
        summary: "/* Three */ new section",
        minor: false,
        // built from the stored page: the save must still find the head it was read at (rev 201)
        expectedHeadRef: "201",
      });
      // the summary is the heading when no sectiontitle is given
      await edit({ title: "Sections", section: "new", summary: "Four", text: "four body" });
      expect((saves()[1]!.args[1] as Body).wikitext).toContain("== Four ==");
    });
  });

  describe("edit conflicts", () => {
    it("accepts the current revision as base and refuses a stale or unknown one, via detectEditConflict", async () => {
      const { edit, calls, saves } = await setup();
      expect((await edit({ title: "Existing", text: "ok", baserevid: "102" })).edit.result).toBe(
        "Success"
      );
      const stale = await edit({ title: "Existing", text: "late", baserevid: "101" });
      expect(stale.error).toEqual({
        code: "editconflict",
        info: "Edit conflict detected.",
        "*": expect.any(String),
      });
      expect((await edit({ title: "Existing", text: "late", baserevid: "99999" })).error.code).toBe(
        "editconflict"
      );
      expect(
        (await edit({ title: "Sections", text: "wrong page", baserevid: "102" })).error.code
      ).toBe("editconflict");
      expect(saves()).toHaveLength(1);
      expect(
        calls.some(
          (c) => c.name === "detectEditConflict" && c.args[0] === "Existing" && c.args[1] === "102"
        )
      ).toBe(true);
    });
    it("hands the save the head the new text was made from: the request's base, else, for a text built from the stored page, the head it was read at", async () => {
      // (each on a fresh wiki: a save moves the head)
      const refs = async (params: Record<string, string>) => {
        const { edit, saves } = await setup();
        await edit(params);
        return (saves().at(-1)!.args[1] as Body).expectedHeadRef;
      };

      // an explicit base wins
      expect(await refs({ title: "Existing", text: "based", baserevid: "102" })).toBe("102");
      // no base and a whole new text: the last write wins, as in MediaWiki
      expect(await refs({ title: "Existing", text: "unbased" })).toBeUndefined();
      // no base, but built from the stored text: the head the page row was read at
      expect(await refs({ title: "Sections", appendtext: "\nmore" })).toBe("201");
      expect(await refs({ title: "Sections", prependtext: "Intro\n" })).toBe("201");
      expect(await refs({ title: "Sections", section: "1", text: "== One ==\nx" })).toBe("201");
      expect(
        await refs({ title: "Sections", section: "new", text: "body", sectiontitle: "T" })
      ).toBe("201");
      // a page that did not exist: nobody may have created it since, whatever else was sent
      expect(await refs({ title: "Brand new", text: "new page", baserevid: "5" })).toBeNull();
      expect(await refs({ title: "Brand newer", text: "new page" })).toBeNull();
    });

    it("answers editconflict when the save finds the page moved on after the early check passed", async () => {
      // two edits on the same base race: both pass the early check, the second one's save is refused by the transaction
      const { edit, saves } = await setup({
        services: {
          saveWikitext: async () => {
            throw new EditConflictError({
              currentWikitext: "Somebody else's text",
              currentRevisionRef: "103",
            });
          },
        },
      });

      const body = await edit({ title: "Existing", text: "late", baserevid: "102" });

      expect(body.error).toEqual({
        code: "editconflict",
        info: "Edit conflict detected.",
        "*": expect.any(String),
      });
      expect(body.edit).toBeUndefined();
      expect(saves()).toHaveLength(0); // (the override is not the recording one)
    });

    it("answers articleexists, not editconflict, when createonly meets a page created meanwhile", async () => {
      const created = {
        services: {
          saveWikitext: async () => {
            throw new EditConflictError({
              currentWikitext: "Somebody made it",
              currentRevisionRef: "9",
            });
          },
        },
      };
      const { edit } = await setup(created);

      expect((await edit({ title: "Brand new", text: "x", createonly: "" })).error.code).toBe(
        "articleexists"
      );
      // without createonly the same race is an ordinary edit conflict
      expect((await edit({ title: "Brand new", text: "x" })).error.code).toBe("editconflict");
    });
  });

  describe("refusals from the shared services", () => {
    const refuse = (error: Error) => ({
      assertCanEdit: async () => {
        throw error;
      },
    });

    it.each([
      ["blocked: You are blocked from editing.", "FORBIDDEN", "blocked"],
      ["protectedpage: This page is protected from edit (sysop).", "FORBIDDEN", "protectedpage"],
      [
        "namespaceprotected: Only administrators can edit this namespace.",
        "FORBIDDEN",
        "protectednamespace",
      ],
      [
        "titleprotected: This title is protected from creation (sysop).",
        "FORBIDDEN",
        "protectedtitle",
      ],
      [
        'permissiondenied: You do not have the "edit" right needed to edit this page.',
        "FORBIDDEN",
        "permissiondenied",
      ],
      [
        "This page was deleted; ask an administrator to restore it",
        "PRECONDITION_FAILED",
        "pagedeleted",
      ],
      // an account without a passport handle may not save (MediaWiki's code for an account an edit is not allowed to)
      [HANDLE_REQUIRED_MESSAGE, "PRECONDITION_FAILED", "permissiondenied"],
    ] as const)("maps %s to %s", async (message, code, expected) => {
      const { edit, saves } = await setup({ services: refuse(new TRPCError({ code, message })) });
      const body = await edit({ title: "Existing", text: "x" });
      expect(body.error.code).toBe(expected);
      expect(body.error.info).toBe(message.replace(/^\w+: /, ""));
      expect(saves()).toHaveLength(0);
    });
  });
});

describe("delete, undelete, move, protect and rollback", () => {
  type Body = Record<string, any>;

  const data = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Alpha" },
      { pageId: 2, title: "Beta" },
      { pageId: 3, title: "Talk:Alpha", namespace: 1 },
    ],
    revisions: [
      {
        revId: 101,
        page: "Alpha",
        timestamp: "2026-01-01T10:00:00Z",
        user: "Heku",
        content: "good text",
      },
      {
        revId: 102,
        page: "Alpha",
        timestamp: "2026-01-02T10:00:00Z",
        user: "Vandal",
        content: "vandalised",
      },
      {
        revId: 103,
        page: "Alpha",
        timestamp: "2026-01-03T10:00:00Z",
        user: "Vandal",
        content: "vandalised again",
      },
      {
        revId: 201,
        page: "Beta",
        timestamp: "2026-01-04T10:00:00Z",
        user: "Heku",
        content: "only author",
      },
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
    it.each(["move", "delete", "undelete", "protect", "rollback"])(
      "%s refuses an anonymous POST and a GET",
      async (action) => {
        const wiki = await makeWikiDeps(data());
        const anon = (await wiki.bot.post({ action, title: "Alpha", token: "+\\" })) as Body;
        expect(anon.error.code).toBe("writeapidenied");
        const get = (await wiki.bot.get({ action, title: "Alpha" })) as Body;
        expect(get.error.code).toBe("mustbeposted");
      }
    );

    it.each(["move", "delete", "undelete", "protect"])(
      "%s refuses a wrong token",
      async (action) => {
        const { bot } = await setup();
        const body = (await bot.post({
          action,
          title: "Alpha",
          from: "Alpha",
          to: "Gamma",
          protections: "edit=sysop",
          token: "nope+\\",
        })) as Body;
        expect(body.error.code).toBe("badtoken");
      }
    );
  });

  describe("action=delete", () => {
    it("authorizes `delete` and archives the page with the bot's name", async () => {
      const { act, called } = await setup();
      const body = await act("delete", { title: "alpha", reason: "junk" });
      expect(body.delete).toEqual({ title: "Alpha", reason: "junk" });
      expect(called("authorize")[0]!.args.slice(1)).toEqual(["delete", "Alpha"]);
      expect(called("archivePage")[0]!.args).toEqual([
        "Alpha",
        "junk",
        { userId: "u-heku", name: "Heku" },
      ]);
    });
  });

  describe("action=undelete", () => {
    it("authorizes undelete, restores, and reports the revision count", async () => {
      const { act, called } = await setup();
      const body = await act("undelete", { title: "Alpha", reason: "oops" });
      expect(body.undelete).toEqual({
        title: "Alpha",
        revisions: 3,
        fileversions: 0,
        reason: "oops",
      });
      expect(called("authorize")[0]!.args.slice(1)).toEqual(["undelete", "Alpha"]);
      expect(called("restorePage")[0]!.args).toEqual([
        "Alpha",
        "oops",
        { userId: "u-heku", name: "Heku" },
      ]);
    });
  });

  describe("action=move", () => {
    it("authorizes the whole move first, then moves, answering from, to and the redirect", async () => {
      const { act, called, calls } = await setup();
      const body = await act("move", {
        from: "Alpha",
        to: "gamma",
        reason: "rename",
        movetalk: "",
      });
      expect(body.move).toEqual({
        from: "Alpha",
        to: "Gamma",
        reason: "rename",
        redirectcreated: true,
      });
      expect(called("authorizeMove")[0]!.args.slice(1)).toEqual([
        "Alpha",
        "Gamma",
        { moveTalk: true, leaveRedirect: true },
      ]);
      // a sysop whose grants include delete (deletedhistory + undelete) may also move a deleted page
      expect(called("movePage")[0]!.args).toEqual([
        "Alpha",
        "Gamma",
        "rename",
        { userId: "u-heku", name: "Heku" },
        { leaveRedirect: true, moveTalk: true, includeArchived: true },
      ]);
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
  });

  describe("action=protect", () => {
    it("authorizes each level, writes the restrictions and answers one object per protection", async () => {
      const { act, called } = await setup();
      const body = await act("protect", {
        title: "Alpha",
        protections: "edit=sysop|move=autoconfirmed",
        expiry: "infinite",
        reason: "vandalism",
      });
      expect(body.protect).toEqual({
        title: "Alpha",
        reason: "vandalism",
        protections: [
          { edit: "sysop", expiry: "infinity" },
          { move: "autoconfirmed", expiry: "infinity" },
        ],
      });
      expect(called("authorizeProtection")[0]!.args.slice(1)).toEqual([
        "Alpha",
        ["sysop", "autoconfirmed"],
      ]);
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
    it("refuses bad protections, expiries and cascade", async () => {
      const { act, called } = await setup();
      expect((await act("protect", { title: "Alpha" })).error.code).toBe("missingparam");
      expect(
        (await act("protect", { title: "Alpha", protections: "nonsense=sysop" })).error.code
      ).toBe("badvalue");
      expect((await act("protect", { title: "Alpha", protections: "edit=root" })).error.code).toBe(
        "badvalue"
      );
      expect(
        (await act("protect", { title: "Alpha", protections: "edit=sysop", expiry: "someday" }))
          .error.code
      ).toBe("invalidexpiry");
      expect(
        (
          await act("protect", {
            title: "Alpha",
            protections: "edit=sysop",
            expiry: "2001-01-01T00:00:00Z",
          })
        ).error.code
      ).toBe("pastexpiry");
      expect(
        (
          await act("protect", {
            title: "Alpha",
            protections: "edit=sysop|move=sysop",
            expiry: "1 day|1 day|1 day",
          })
        ).error.code
      ).toBe("toofewexpiries");
      expect(
        (await act("protect", { title: "Alpha", protections: "edit=sysop", cascade: "" })).error
          .code
      ).toBe("cantcascade");
      expect(called("protectPage")).toHaveLength(0);
    });
  });

  describe("action=rollback", () => {
    it("needs the rollback token, not the csrf one", async () => {
      const wiki = await makeWikiDeps(data());
      await loggedIn(wiki.bot);
      const csrf = (
        (await wiki.bot.get({ action: "query", meta: "tokens", formatversion: "2" })) as Body
      ).query.tokens.csrftoken;
      const body = (await wiki.bot.post({
        action: "rollback",
        title: "Alpha",
        user: "Vandal",
        token: csrf,
      })) as Body;
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
      expect(called("requireRestorableWikitext")[0]!.args.slice(1)).toEqual([
        "Alpha",
        { wikitext: "good text", title: "Alpha" },
      ]);
      expect(called("saveWikitext")[0]!.args[1]).toEqual({
        title: "Alpha",
        wikitext: "good text",
        summary: "Reverted edits by Vandal to last revision by Heku",
        minor: false,
        expectedHeadRef: "103",
      });
    });
    it("refuses a rollback the service will not allow (a blanking, a placeholder)", async () => {
      const { act, called } = await setup(
        {
          services: {
            requireRestorableWikitext: async () => {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "This revision's text has not been imported yet.",
              });
            },
          },
        },
        "rollback"
      );
      const body = await act("rollback", { title: "Alpha", user: "Vandal" });
      expect(body.error.info).toContain("not been imported");
      expect(called("saveWikitext")).toHaveLength(0);
    });
  });

  // Plan 2026-10-24 Task 13 (A6): the rollback carries the head it read; WikiOS's own conflict writes are nobody's edit
  describeEachWikiosMode("action=rollback and the head it read", () => {
    it("rollback after a newer edit answers editconflict", async () => {
      const { act, called, data: wiki } = await setup(
        {
          services: {
            // the save as the repository makes it: somebody's edit lands first, then the head check fails
            saveWikitext: async (_ctx, save) => {
              wiki.revisions!.push({
                revId: 104,
                page: "Alpha",
                timestamp: "2026-01-04T10:00:00Z",
                user: "Gamma",
                content: "newer",
              });
              if (!headMatchesBase({ id: "row-104", mwRevId: 104 }, save.expectedHeadRef ?? null)) {
                throw new EditConflictError({ currentWikitext: "newer", currentRevisionRef: "104" });
              }
              return { revisionRowId: "row-9000" };
            },
          },
        },
        "rollback"
      );

      const body = await act("rollback", { title: "Alpha", user: "Vandal" });

      expect(body.error.code).toBe("editconflict");
      expect(called("requireRestorableWikitext")).toHaveLength(1);
      expect(wiki.revisions!.map((rev) => rev.revId)).toEqual([101, 102, 103, 201, 104]);
    });

    it("a trail dummy edit on top is nobody's edit: the named editor's edits beneath it roll back on top of it", async () => {
      const { act, called, data: wiki } = await setup({}, "rollback");
      wiki.revisions!.push({
        revId: 104,
        page: "Alpha",
        timestamp: "2026-01-03T11:00:00Z",
        user: "WikiOS",
        content: "vandalised again",
        systemWrite: true,
      });

      const body = await act("rollback", { title: "Alpha", user: "Vandal" });

      expect(body.rollback).toMatchObject({ old_revid: 104, last_revid: 101 });
      expect(called("saveWikitext")[0]!.args[1]).toMatchObject({
        wikitext: "good text",
        expectedHeadRef: "104",
      });
      // the trail is not the editor to name
      const named = await act("rollback", { title: "Alpha", user: "WikiOS" });
      expect(named.error.code).toBe("alreadyrolled");
    });

    it.each([
      ["a trail (no text change) inside the run does not end it", "vandalised", 101, "good text"],
      [
        "a talk note inside the run ends it, and its text is kept",
        "vandalised\n\nA note.",
        104,
        "vandalised\n\nA note.",
      ],
    ])("%s", async (_, content, target, wikitext) => {
      const { act, called, data: wiki } = await setup({}, "rollback");
      wiki.revisions!.push({
        revId: 104,
        page: "Alpha",
        timestamp: "2026-01-02T12:00:00Z",
        user: "WikiOS",
        content,
        systemWrite: true,
      });

      const body = await act("rollback", { title: "Alpha", user: "Vandal" });

      expect(body.rollback).toMatchObject({ old_revid: 103, last_revid: target });
      expect(called("saveWikitext")[0]!.args[1]).toMatchObject({ wikitext });
    });

    it("a note below the named editor's edits is where the page goes back to", async () => {
      const { act, called, data: wiki } = await setup({}, "rollback");
      wiki.revisions!.push({
        revId: 199,
        page: "Beta",
        timestamp: "2026-01-04T11:00:00Z",
        user: "WikiOS",
        content: "only author\n\nA note.",
        systemWrite: true,
      });
      wiki.revisions!.push({
        revId: 202,
        page: "Beta",
        timestamp: "2026-01-04T12:00:00Z",
        user: "Vandal",
        content: "vandalised",
      });

      const body = await act("rollback", { title: "Beta", user: "Vandal" });

      expect(body.rollback).toMatchObject({ old_revid: 202, last_revid: 199 });
      expect(called("saveWikitext")[0]!.args[1]).toMatchObject({
        wikitext: "only author\n\nA note.",
        summary: "Reverted edits by Vandal to last revision by WikiOS",
      });
    });

    it("answers onlyauthor when only WikiOS's own writes stand beside the named editor", async () => {
      const { act, called, data: wiki } = await setup({}, "rollback");
      wiki.revisions!.push({
        revId: 202,
        page: "Beta",
        timestamp: "2026-01-04T12:00:00Z",
        user: "WikiOS",
        content: "only author",
        systemWrite: true,
      });

      const body = await act("rollback", { title: "Beta", user: "Heku" });

      expect(body.error.code).toBe("onlyauthor");
      expect(called("saveWikitext")).toHaveLength(0);
    });
  });
});

describe("purge", () => {
  type Body = Record<string, any>;

  const DATA = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Alpha" },
      { pageId: 2, title: "Beta", redirect: "Alpha" },
    ],
    revisions: [{ revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "a" }],
  });

  describe("action=purge", () => {
    const purged = (calls: Array<{ name: string; args: unknown[] }>) =>
      calls.filter((c) => c.name === "purgePage").map((c) => c.args[0]);

    it("is refused to an anonymous caller (a purge costs a render)", async () => {
      const wiki = await makeWikiDeps(DATA());
      const body = (
        await call(wiki.deps, "action=purge&titles=Alpha&formatversion=2", {
          method: "POST",
          body: {},
        })
      ).body as Body;
      expect(body.error.code).toBe("writeapidenied");
      expect(purged(wiki.calls)).toEqual([]);
    });

    it("marks each named page stale and queues its render, answering like MediaWiki", async () => {
      const wiki = await makeWikiDeps(DATA());
      await loggedIn(wiki.bot);
      const body = (await wiki.bot.post({
        action: "purge",
        titles: "Alpha|Nope|Bad[title",
        formatversion: "2",
      })) as Body;
      expect(body.batchcomplete).toBe(true);
      expect(body.purge).toEqual([
        { ns: 0, title: "Alpha", purged: true },
        { ns: 0, title: "Nope", missing: true },
        expect.objectContaining({ title: "Bad[title", invalid: true }),
      ]);
      expect(purged(wiki.calls)).toEqual([{ id: "art:Alpha", title: "Alpha" }]);
    });
    it("takes one render from the wiki_api_render bucket per purged page, and refuses past the account's minute", async () => {
      const pages = Array.from({ length: 60 }, (_, i) => ({ pageId: i + 1, title: `P${i}` }));
      // a limiter that behaves like the real one: it counts per bucket and key, and says no past maxRequests
      const counts = new Map<string, number>();
      const seen: Array<{ key: string; bucket: string; max: number }> = [];
      const rateLimit = async (key: string, bucket: string, limits: { maxRequests: number }) => {
        seen.push({ key, bucket, max: limits.maxRequests });
        const id = `${bucket}|${key}`;
        const used = (counts.get(id) ?? 0) + 1;
        counts.set(id, used);
        return { success: used <= limits.maxRequests, resetAt: new Date(0) };
      };
      const wiki = await makeWikiDeps({ pages, revisions: [] }, { extra: { rateLimit } });
      await loggedIn(wiki.bot);
      const purge = (names: string[]) =>
        wiki.bot.post({
          action: "purge",
          titles: names.join("|"),
          formatversion: "2",
        }) as Promise<Body>;
      const render = () => seen.filter((entry) => entry.bucket === "wiki_api_render");

      const first = await purge(pages.slice(0, 50).map((p) => p.title));
      expect(first.purge).toHaveLength(50);
      expect(render()).toHaveLength(50);
      expect(render().every((entry) => entry.key.startsWith("user:") && entry.max === 60)).toBe(
        true
      );

      // 10 more are within the minute, the 11th is not: the whole request is refused before anything is purged
      const before = purged(wiki.calls).length;
      const second = await purge(pages.slice(0, 20).map((p) => p.title));
      expect(second.error.code).toBe("ratelimited");
      expect(purged(wiki.calls)).toHaveLength(before);

      // missing and invalid titles cost nothing
      counts.clear();
      seen.length = 0;
      await purge(["Nope", "Bad[title"]);
      expect(render()).toHaveLength(0);
    });
    it("caps the pages of one request", async () => {
      const wiki = await makeWikiDeps(DATA());
      await loggedIn(wiki.bot);
      const many = Array.from({ length: 60 }, (_, i) => `P${i}`).join("|");
      const body = (await wiki.bot.post({
        action: "purge",
        titles: many,
        formatversion: "2",
      })) as Body;
      expect(body.error?.code ?? body.purge.length).toBeTruthy();
      expect(body.error?.code).toBe("toomanyvalues");
    });
  });
});

describe("section edits find the section MediaWiki would", () => {
  const PAGE = [
    "Lead text.",
    "",
    "== One ==",
    "one body",
    "",
    "=== One A ===",
    "a body",
    "",
    "== Two ==",
    "two body",
  ].join("\n");

  describe("sectionHeadings", () => {
    it("ignores heading-looking lines inside comments, nowiki and pre", () => {
      const text =
        "<!--\n== hidden ==\n-->\n<nowiki>\n== also hidden ==\n</nowiki>\n<pre>\n== no ==\n</pre>\n== Real ==\nbody";
      expect(sectionHeadings(text).map((h) => h.text)).toEqual(["Real"]);
    });
  });

  describe("locateSection and sectionText", () => {
    it("a section runs to the next heading of the same or higher rank, subsections included", () => {
      expect(sectionText(PAGE, 1)).toBe("== One ==\none body\n\n=== One A ===\na body\n\n");
      expect(sectionText(PAGE, 2)).toBe("=== One A ===\na body\n\n");
      expect(sectionText(PAGE, 3)).toBe("== Two ==\ntwo body");
    });
  });

  describe("replaceSection", () => {
    it("replaces a section, keeping what follows after a blank line", () => {
      expect(replaceSection(PAGE, 1, "== One ==\nnew body")).toBe(
        "Lead text.\n\n== One ==\nnew body\n\n== Two ==\ntwo body"
      );
    });
    it("removes a section when the new text is empty, and answers null for a missing one", () => {
      expect(replaceSection(PAGE, 3, "")).toBe(
        "Lead text.\n\n== One ==\none body\n\n=== One A ===\na body"
      );
      expect(replaceSection(PAGE, 9, "x")).toBeNull();
    });
  });

  describe("offsets stay true around characters outside the BMP", () => {
    const PAGE_WITH_EMOJI =
      "Lead <!-- note \u{1F600}\u{1F600} -->\n\n== One ==\nbody one\n\n== Two ==\nbody two";

    it("masks a comment with astral characters one space per UTF-16 unit, so headings keep their offsets", () => {
      const headings = sectionHeadings(PAGE_WITH_EMOJI);
      expect(
        headings.map((h) => PAGE_WITH_EMOJI.slice(h.start, h.start + 3 + h.text.length))
      ).toEqual(["== One", "== Two"]);
    });
    it("holds for astral characters inside <nowiki> and <pre> too", () => {
      const page = "<nowiki>\u{1F600}\n== not a heading ==\n\u{1F600}</nowiki>\n== Real ==\ntext";
      expect(sectionHeadings(page).map((h) => h.text)).toEqual(["Real"]);
      expect(sectionText(page, 1)).toBe("== Real ==\ntext");
    });
  });

  describe("lines made only of equals signs", () => {
    it("agree with MediaWiki's heading regex on every combination of equals signs and one other character", () => {
      const old = /^(={1,6})(.+?)\1[ \t]*$/u;
      const alphabet = ["=", "=", "=", "a", " "];
      let seed = 7;
      const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
      for (let round = 0; round < 20_000; round++) {
        const line = Array.from(
          { length: 1 + (next() % 16) },
          () => alphabet[(next() >> 8) % alphabet.length]
        ).join("");
        const match = old.exec(line);
        const text = match?.[2]?.trim();
        const expected = match && text ? [match[1]!.length, text] : null;
        const found = sectionHeadings(line)[0];
        expect([line, found ? [found.level, found.text] : null]).toEqual([line, expected]);
      }
    });
  });
});

describe("service refusals as API errors", () => {
  describe("toApiError", () => {
    it("answers a page that was busy with ratelimited and the reason, so a bot waits and retries", () => {
      const error = toApiError(new PageBusyError());

      expect(error).toMatchObject({ code: "ratelimited" });
      expect(error?.info).toContain("The page is busy");
    });

    it("answers a refused move of a file with immobilenamespace, not selfmove (which is BAD_REQUEST)", () => {
      expect(toApiError(new PageOperationError("IMMOBILE", "no files"))).toMatchObject({
        code: "immobilenamespace",
        info: "no files",
      });
      expect(toApiError(new PageOperationError("BAD_REQUEST", "identical"))).toMatchObject({
        code: "invalidparam",
      });
    });
  });
});
