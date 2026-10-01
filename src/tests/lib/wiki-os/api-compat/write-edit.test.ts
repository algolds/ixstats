/** @jest-environment node */
/**
 * Plan 410: action=edit. Every edit goes through the shared services (permission gate, conflict
 * detection, save); the module only builds the text and shapes the answer.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { EditConflictError } from "~/lib/wiki-os/core/edit-conflict-error";
import { call, loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const SECTIONED = ["Lead text.", "", "== One ==", "one body", "", "=== One A ===", "a body", "", "== Two ==", "two body"].join("\n");

const fresh = (): FakeWikiData => ({
  pages: [
    { pageId: 1, title: "Existing" },
    { pageId: 2, title: "Sections" },
  ],
  revisions: [
    { revId: 101, page: "Existing", timestamp: "2026-01-01T10:00:00Z", user: "Heku", content: "Hello world" },
    { revId: 102, page: "Existing", timestamp: "2026-01-02T10:00:00Z", user: "Tester", content: "Hello brave world" },
    { revId: 201, page: "Sections", timestamp: "2026-01-03T10:00:00Z", user: "Heku", content: SECTIONED },
  ],
});

const md5 = (text: string) => createHash("md5").update(text).digest("hex");

async function setup(options: Parameters<typeof makeWikiDeps>[1] = {}) {
  const wiki = await makeWikiDeps(fresh(), options);
  const token = await loggedIn(wiki.bot);
  const edit = (params: Record<string, string>) => wiki.bot.post({ action: "edit", token, formatversion: "2", ...params }) as Promise<Body>;
  const saves = () => wiki.calls.filter((c) => c.name === "saveWikitext");
  return { ...wiki, token, edit, saves };
}

describe("who may edit through api.php", () => {
  it("refuses an anonymous caller with writeapidenied, and a GET with mustbeposted", async () => {
    const { deps } = await setup();
    const anonymous = (await call(deps, "", { method: "POST", body: { action: "edit", title: "Existing", text: "x", token: "+\\" } })).body as Body;
    expect(anonymous.error.code).toBe("writeapidenied");
    const get = (await call(deps, "action=edit&title=Existing&text=x&token=%2B%5C")).body as Body;
    expect(get.error.code).toBe("mustbeposted");
  });

  it("needs the session's token: missing is missingparam, wrong is badtoken", async () => {
    const { bot, saves } = await setup();
    expect((await bot.post({ action: "edit", title: "Existing", text: "x" }) as Body).error.code).toBe("missingparam");
    expect((await bot.post({ action: "edit", title: "Existing", text: "x", token: "+\\" }) as Body).error.code).toBe("badtoken");
    expect((await bot.post({ action: "edit", title: "Existing", text: "x", token: "abcdef+\\" }) as Body).error.code).toBe("badtoken");
    expect(saves()).toHaveLength(0);
  });
});

describe("parameters", () => {
  it("needs a title or a page id, not both, and some text", async () => {
    const { edit, saves } = await setup();
    expect((await edit({ text: "x" })).error.code).toBe("missingparam");
    expect((await edit({ title: "Existing", pageid: "1", text: "x" })).error.code).toBe("invalidparammix");
    expect((await edit({ title: "Existing" })).error.code).toBe("missingparam");
    expect((await edit({ title: "Existing", text: "x", appendtext: "y" })).error.code).toBe("invalidparammix");
    expect((await edit({ title: "Existing", undo: "101" })).error.code).toBe("unsupportedparam");
    expect((await edit({ title: "Bad[title", text: "x" })).error.code).toBe("invalidtitle");
    expect((await edit({ title: "Special:Version", text: "x" })).error.code).toBe("invalidtitle");
    expect((await edit({ pageid: "999", text: "x" })).error.code).toBe("nosuchpageid");
    expect(saves()).toHaveLength(0);
  });

  it("checks md5 of the text, or of prependtext+appendtext", async () => {
    const { edit, saves } = await setup();
    expect((await edit({ title: "Existing", text: "new text", md5: "0".repeat(32) })).error.code).toBe("badmd5");
    expect((await edit({ title: "Existing", appendtext: "b", prependtext: "a", md5: md5("x") })).error.code).toBe("badmd5");
    expect((await edit({ title: "Existing", text: "new text", md5: md5("new text") })).edit.result).toBe("Success");
    expect((await edit({ title: "Existing", appendtext: "b", prependtext: "a", md5: md5("ab") })).edit.result).toBe("Success");
    expect(saves()).toHaveLength(2);
  });

  it("refuses a content model the page does not have", async () => {
    const { edit } = await setup();
    expect((await edit({ title: "Existing", text: "x", contentmodel: "json" })).error.code).toBe("cantchangecontentmodel");
    expect((await edit({ title: "Existing", text: "x", contentmodel: "wikitext" })).edit.result).toBe("Success");
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
    expect(saves()[0]!.args[1]).toEqual({ title: "Existing", wikitext: "Brand new text", summary: "rewrite", minor: false });
    // the permission gate runs before the save, on the canonical title
    const order = calls.map((c) => c.name);
    expect(order.indexOf("assertCanEdit")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("assertCanEdit")).toBeLessThan(order.indexOf("saveWikitext"));
    expect(calls.find((c) => c.name === "assertCanEdit")!.args[1]).toBe("Existing");
  });

  it("formatversion=1 shows the same result", async () => {
    const { bot, token } = await setup();
    const body = (await bot.post({ action: "edit", token, title: "Existing", text: "v1 text" })) as Body;
    expect(body.edit).toMatchObject({ result: "Success", title: "Existing", oldrevid: 102 });
  });

  it("appends and prepends to the current text", async () => {
    const { edit, saves } = await setup();
    await edit({ title: "Existing", appendtext: "\nMore", prependtext: "Intro\n" });
    expect((saves()[0]!.args[1] as Body).wikitext).toBe("Intro\nHello brave world\nMore");
  });

  it("creates a page with `new` and oldrevid 0; createonly refuses an existing one; nocreate a missing one", async () => {
    const { edit, saves } = await setup();
    const created = await edit({ title: "Fresh page", text: "I am new" });
    expect(created.edit).toMatchObject({ result: "Success", new: true, title: "Fresh page", oldrevid: 0, newrevid: 9000 });
    expect((await edit({ title: "Existing", text: "x", createonly: "" })).error.code).toBe("articleexists");
    expect((await edit({ title: "Absent", text: "x", nocreate: "" })).error.code).toBe("missingtitle");
    expect(saves()).toHaveLength(1);
  });

  it("answers nochange, and saves nothing, when the text is the same", async () => {
    const { edit, saves } = await setup();
    const body = await edit({ title: "Existing", text: "Hello brave world" });
    expect(body.edit).toEqual({ result: "Success", nochange: true, title: "Existing", pageid: 1, contentmodel: "wikitext" });
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
    expect((await edit({ title: "Existing", text: "nul\u0000here" })).error.code).toBe("invalidtext");
  });

  it("passes minor unless notminor is also given, and the summary through", async () => {
    const { edit, saves } = await setup();
    await edit({ title: "Existing", text: "a", minor: "" });
    await edit({ title: "Existing", text: "b", minor: "", notminor: "" });
    await edit({ title: "Existing", text: "c" });
    expect(saves().map((c) => (c.args[1] as Body).minor)).toEqual([true, false, false]);
    expect((saves()[2]!.args[1] as Body).summary).toBe("");
  });
});

describe("sections", () => {
  it("replaces a numbered section (subsections included) and keeps the rest", async () => {
    const { edit, saves } = await setup();
    await edit({ title: "Sections", section: "1", text: "== One ==\nrewritten" });
    expect((saves()[0]!.args[1] as Body).wikitext).toBe("Lead text.\n\n== One ==\nrewritten\n\n== Two ==\ntwo body");
  });

  it("replaces the lead with section=0 and appends inside a section", async () => {
    const { edit, saves } = await setup();
    await edit({ title: "Sections", section: "0", text: "Fresh lead." });
    expect((saves()[0]!.args[1] as Body).wikitext).toBe("Fresh lead.\n\n== One ==\none body\n\n=== One A ===\na body\n\n== Two ==\ntwo body");
    await edit({ title: "Sections", section: "3", appendtext: "\nmore two" });
    // (the first edit is now the page's text)
    expect((saves()[1]!.args[1] as Body).wikitext).toBe("Fresh lead.\n\n== One ==\none body\n\n=== One A ===\na body\n\n== Two ==\ntwo body\nmore two");
  });

  it("adds a new section with its heading, and a MediaWiki-style summary", async () => {
    const { edit, saves } = await setup();
    await edit({ title: "Sections", section: "new", sectiontitle: "Three", text: "three body" });
    expect(saves()[0]!.args[1]).toEqual({
      title: "Sections",
      wikitext: `${SECTIONED}\n\n== Three ==\n\nthree body`,
      summary: "/* Three */ new section",
      minor: false,
    });
    // the summary is the heading when no sectiontitle is given
    await edit({ title: "Sections", section: "new", summary: "Four", text: "four body" });
    expect((saves()[1]!.args[1] as Body).wikitext).toContain("== Four ==");
  });

  it("refuses a missing section and an invalid section value", async () => {
    const { edit } = await setup();
    expect((await edit({ title: "Sections", section: "9", text: "x" })).error.code).toBe("nosuchsection");
    expect((await edit({ title: "Sections", section: "one", text: "x" })).error.code).toBe("invalidsection");
    expect((await edit({ title: "Sections", section: "new", appendtext: "x" })).error.code).toBe("invalidparammix");
  });
});

describe("edit conflicts", () => {
  it("accepts the current revision as base and refuses a stale or unknown one, via detectEditConflict", async () => {
    const { edit, calls, saves } = await setup();
    expect((await edit({ title: "Existing", text: "ok", baserevid: "102" })).edit.result).toBe("Success");
    const stale = await edit({ title: "Existing", text: "late", baserevid: "101" });
    expect(stale.error).toEqual({ code: "editconflict", info: "Edit conflict detected.", "*": expect.any(String) });
    expect((await edit({ title: "Existing", text: "late", baserevid: "99999" })).error.code).toBe("editconflict");
    expect((await edit({ title: "Sections", text: "wrong page", baserevid: "102" })).error.code).toBe("editconflict");
    expect(saves()).toHaveLength(1);
    expect(calls.some((c) => c.name === "detectEditConflict" && c.args[0] === "Existing" && c.args[1] === "102")).toBe(true);
  });

  it("compares basetimestamp with the revision that was current then", async () => {
    const { edit, saves } = await setup();
    expect((await edit({ title: "Existing", text: "ok", basetimestamp: "2026-01-02T10:00:00Z" })).edit.result).toBe("Success");
    expect((await edit({ title: "Existing", text: "late", basetimestamp: "2026-01-01T10:00:00Z" })).error.code).toBe("editconflict");
    expect((await edit({ title: "Existing", text: "late", basetimestamp: "2025-01-01T00:00:00Z" })).error.code).toBe("editconflict");
    expect((await edit({ title: "Existing", text: "bad", basetimestamp: "yesterday" })).error.code).toBe("badtimestamp");
    expect(saves()).toHaveLength(1);
  });

  it("hands the base to the save, which re-checks it atomically; no base, no check", async () => {
    const { edit, saves } = await setup();
    await edit({ title: "Existing", text: "based", baserevid: "102" });
    await edit({ title: "Existing", text: "unbased" });
    await edit({ title: "Brand new", text: "new page", baserevid: "5" });

    expect(saves().map((call) => (call.args[1] as Body).expectedHeadRef)).toEqual(["102", undefined, undefined]);
  });

  it("answers editconflict when the save finds the page moved on after the early check passed", async () => {
    // two edits on the same base race: both pass the early check, the second one's save is refused by the transaction
    const { edit, saves } = await setup({
      services: {
        saveWikitext: async () => {
          throw new EditConflictError({ currentWikitext: "Somebody else's text", currentRevisionRef: "103" });
        },
      },
    });

    const body = await edit({ title: "Existing", text: "late", baserevid: "102" });

    expect(body.error).toEqual({ code: "editconflict", info: "Edit conflict detected.", "*": expect.any(String) });
    expect(body.edit).toBeUndefined();
    expect(saves()).toHaveLength(0); // (the override is not the recording one)
  });

  it("lets any other failure of the save through as it is", async () => {
    const { edit } = await setup({
      services: {
        saveWikitext: async () => {
          throw new TRPCError({ code: "FORBIDDEN", message: "permissiondenied: nope" });
        },
      },
    });

    expect((await edit({ title: "Existing", text: "x", baserevid: "102" })).error.code).toBe("permissiondenied");
  });

  it("ignores a base for a page that does not exist yet, and checks no conflict without one", async () => {
    const { edit, calls } = await setup();
    expect((await edit({ title: "Brand new", text: "x", baserevid: "5" })).edit.result).toBe("Success");
    await edit({ title: "Existing", text: "no base" });
    expect(calls.filter((c) => c.name === "detectEditConflict")).toHaveLength(0);
  });
});

describe("refusals from the shared services", () => {
  const refuse = (error: Error) => ({ assertCanEdit: async () => { throw error; } });

  it.each([
    ["blocked: You are blocked from editing.", "FORBIDDEN", "blocked"],
    ["protectedpage: This page is protected from edit (sysop).", "FORBIDDEN", "protectedpage"],
    ["namespaceprotected: Only administrators can edit this namespace.", "FORBIDDEN", "protectednamespace"],
    ["titleprotected: This title is protected from creation (sysop).", "FORBIDDEN", "protectedtitle"],
    ['permissiondenied: You do not have the "edit" right needed to edit this page.', "FORBIDDEN", "permissiondenied"],
    ["This page was deleted; ask an administrator to restore it", "PRECONDITION_FAILED", "pagedeleted"],
  ] as const)("maps %s to %s", async (message, code, expected) => {
    const { edit, saves } = await setup({ services: refuse(new TRPCError({ code, message })) });
    const body = await edit({ title: "Existing", text: "x" });
    expect(body.error.code).toBe(expected);
    expect(body.error.info).toBe(message.replace(/^\w+: /, ""));
    expect(saves()).toHaveLength(0);
  });
});
