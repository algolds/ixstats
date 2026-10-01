/** @jest-environment node */
/**
 * Plan 410: the request sequence Pywikibot makes on startup and for one simple edit, replayed
 * against the api.php dispatcher. Each response must carry the keys Pywikibot reads
 * (pywikibot/site/_siteinfo.py, _apisite.py, login.py, page/_basepage.py), in both
 * formatversion=1 and formatversion=2.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { makeWikiDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const data = (): FakeWikiData => ({
  pages: [{ pageId: 7, title: "Sandbox" }],
  revisions: [
    { revId: 501, page: "Sandbox", timestamp: "2026-09-29T08:30:00Z", user: "Tester", comment: "seed", content: "Sandbox before the bot edit" },
  ],
  restrictions: { Sandbox: [{ action: "edit", level: "autoconfirmed" }] },
});

/** Pywikibot's own defaults on every request. */
const common = (version: 1 | 2) => ({ maxlag: "5", format: "json", utf8: "", formatversion: String(version), errorformat: "bc" });

/** The values Pywikibot's `Siteinfo` reads out of `general`. */
const GENERAL_KEYS = ["generator", "sitename", "case", "lang", "mainpage", "base", "articlepath", "scriptpath", "server", "timezone", "time", "maxarticlesize", "writeapi", "legaltitlechars", "wikiid", "servername"];

const hasKeys = (object: Body, keys: readonly string[]) => keys.filter((key) => !(key in object));

describe.each([1, 2] as const)("a Pywikibot session, formatversion=%i", (version) => {
  it("starts up, logs in and makes one edit", async () => {
    const wiki = await makeWikiDeps(data());
    const { bot } = wiki;
    const get = (params: Record<string, string>) => bot.get({ ...common(version), ...params }) as Promise<Body>;
    const post = (params: Record<string, string>) => bot.post({ ...common(version), ...params }) as Promise<Body>;

    // 1. Siteinfo, before any login (anonymous).
    const siteinfo = await get({ action: "query", meta: "siteinfo", siprop: "general|namespaces|namespacealiases|extensions", continue: "" });
    expect(siteinfo.error).toBeUndefined();
    const { general, namespaces, namespacealiases, extensions } = siteinfo.query;
    expect(hasKeys(general, GENERAL_KEYS)).toEqual([]);
    // Pywikibot parses the version out of `generator`.
    const versionMatch = /MediaWiki (\d+)\.(\d+)(?:\.(\d+))?/.exec(general.generator);
    expect(versionMatch?.slice(1, 4)).toEqual(["1", "45", "1"]);
    expect(general.case).toBe("first-letter");
    expect(general.lang).toBe("en");
    expect(general.articlepath).toBe("/wiki/$1");
    expect(general.scriptpath).toBe("/w");
    expect(general.timezone).toBe("UTC");
    expect(general.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Boolean(general.writeapi) || general.writeapi === "").toBe(true);

    // Every namespace has what Pywikibot's Namespace reads: id, case, canonical (except main), name, subpages, content.
    const nsList: Body[] = version === 2 ? Object.values(namespaces) : Object.values(namespaces);
    expect(nsList.length).toBeGreaterThan(20);
    const nameKey = version === 1 ? "*" : "name";
    for (const ns of nsList) {
      expect(hasKeys(ns, ["id", "case", nameKey])).toEqual([]);
      if (ns.id !== 0) expect(ns.canonical).toEqual(expect.any(String));
    }
    expect(namespaces["0"][nameKey]).toBe("");
    expect(namespaces["10"][nameKey]).toBe("Template");
    expect(namespaces["828"][nameKey]).toBe("Module");
    expect(namespaces["460"][nameKey]).toBe("Campaign");
    const aliasKey = version === 1 ? "*" : "alias";
    expect(namespacealiases).toEqual(expect.arrayContaining([{ id: 6, [aliasKey]: "Image" }, { id: 4, [aliasKey]: "Project" }]));
    expect(extensions.map((e: Body) => e.name)).toEqual(expect.arrayContaining(["Scribunto", "ParserFunctions", "Cite"]));
    expect(bot.log.length).toBe(1);

    // 2. Login token, then the login.
    const loginTokens = await get({ action: "query", meta: "tokens", type: "login", continue: "" });
    expect(Object.keys(loginTokens.query.tokens)).toEqual(["logintoken"]);
    expect(loginTokens.query.tokens.logintoken).toMatch(/\+\\$/);
    const login = await post({ action: "login", lgname: "Heku@Bot", lgpassword: "bot-secret", lgtoken: loginTokens.query.tokens.logintoken });
    expect(Object.keys(login.login).sort()).toEqual(["lguserid", "lgusername", "result"]);
    expect(login.login).toEqual({ result: "Success", lguserid: 7, lgusername: "Heku" });

    // 3. Userinfo: Pywikibot's `logged_in` needs a non-zero id, no `anon`, and the matching name.
    const userinfo = await get({ action: "query", meta: "userinfo", uiprop: "blockinfo|hasmsg|groups|rights|ratelimits", continue: "", assert: "user" });
    const info = userinfo.query.userinfo;
    expect(hasKeys(info, ["id", "name", "groups", "rights"])).toEqual([]);
    expect(info.id).toBeGreaterThan(0);
    expect(info.name).toBe("Heku");
    expect(info.anon).toBeUndefined();
    expect(info.blockinfo).toBeUndefined();
    expect(info.groups).toEqual(expect.arrayContaining(["sysop"]));
    expect(info.rights).toEqual(expect.arrayContaining(["read", "edit"]));
    expect(info.ratelimits).toEqual({});

    // 4. The edit token.
    const tokens = await get({ action: "query", meta: "tokens", type: "csrf", continue: "", assert: "user" });
    expect(Object.keys(tokens.query.tokens)).toEqual(["csrftoken"]);
    const csrf = tokens.query.tokens.csrftoken as string;
    expect(csrf).toMatch(/^[0-9a-f]{32}\+\\$/);

    // 5. Load the page: info and the newest revision with its content (rvslots=*, as Pywikibot sends it).
    const loaded = await get({
      action: "query",
      prop: "info|revisions",
      titles: "Sandbox",
      rvprop: "content|timestamp|ids|user|comment|sha1|contentmodel|size|flags|tags",
      rvslots: "*",
      inprop: "protection",
      continue: "",
      assert: "user",
    });
    const pages: Body[] = version === 2 ? loaded.query.pages : Object.values(loaded.query.pages);
    expect(pages).toHaveLength(1);
    const page = pages[0]!;
    expect(hasKeys(page, ["pageid", "ns", "title", "lastrevid", "touched", "length", "contentmodel", "pagelanguage", "pagelanguagedir", "protection", "revisions"])).toEqual([]);
    expect(page).toMatchObject({ pageid: 7, ns: 0, title: "Sandbox", lastrevid: 501, contentmodel: "wikitext", pagelanguage: "en", pagelanguagedir: "ltr" });
    expect(page.protection).toEqual([{ type: "edit", level: "autoconfirmed", expiry: "infinity" }]);
    const revision = page.revisions[0];
    expect(hasKeys(revision, ["revid", "parentid", "timestamp", "user", "comment", "slots"])).toEqual([]);
    const contentKey = version === 1 ? "*" : "content";
    expect(revision.slots.main).toEqual({ contentmodel: "wikitext", contentformat: "text/x-wiki", [contentKey]: "Sandbox before the bot edit" });
    expect(revision.revid).toBe(501);
    expect(revision.timestamp).toBe("2026-09-29T08:30:00Z");
    // the load asked for slots, so no legacy-format warning is raised
    expect(loaded.warnings).toBeUndefined();

    // 6. The edit, as Pywikibot's Page.save builds it: basetimestamp, token, nocreate, bot, summary.
    const edit = await post({
      action: "edit",
      title: "Sandbox",
      text: "Sandbox after the bot edit",
      summary: "Bot: testing",
      basetimestamp: revision.timestamp,
      starttimestamp: "2026-09-30T11:59:00Z",
      nocreate: "1",
      bot: "1",
      token: csrf,
      assert: "user",
      assertuser: "Heku",
    });
    expect(edit.error).toBeUndefined();
    expect(hasKeys(edit.edit, ["result", "pageid", "title", "contentmodel", "oldrevid", "newrevid", "newtimestamp"])).toEqual([]);
    expect(edit.edit).toEqual({
      result: "Success",
      pageid: 7,
      title: "Sandbox",
      contentmodel: "wikitext",
      oldrevid: 501,
      newrevid: 9000,
      newtimestamp: "2026-09-30T12:00:00Z",
    });
    expect(wiki.calls.filter((c) => c.name === "saveWikitext")).toHaveLength(1);
    expect(wiki.calls.find((c) => c.name === "saveWikitext")!.args[1]).toEqual({
      title: "Sandbox",
      wikitext: "Sandbox after the bot edit",
      summary: "Bot: testing",
      minor: false,
    });

    // 7. Reloading shows the bot's revision as the newest.
    const reloaded = await get({ action: "query", prop: "revisions", titles: "Sandbox", rvprop: "ids|timestamp", continue: "" });
    const [after]: Body[] = version === 2 ? reloaded.query.pages : Object.values(reloaded.query.pages);
    expect(after!.revisions[0]).toMatchObject({ revid: 9000, parentid: 501 });

    // 8. A second edit based on the stale timestamp is an edit conflict, which Pywikibot reports as such.
    const conflict = await post({ action: "edit", title: "Sandbox", text: "late", basetimestamp: revision.timestamp, token: csrf });
    expect(conflict.error.code).toBe("editconflict");
    expect(wiki.calls.filter((c) => c.name === "saveWikitext")).toHaveLength(1);
  });

  it("every response is a single JSON object Pywikibot can read: no HTML, no array, and the bc error envelope", async () => {
    const wiki = await makeWikiDeps(data());
    await wiki.bot.login();
    for (const params of [{ action: "query", meta: "userinfo" }, { action: "query", titles: "Sandbox", prop: "info" }, { action: "nonsense" }]) {
      const body = (await wiki.bot.get({ ...common(version), ...params })) as Body;
      expect(Array.isArray(body)).toBe(false);
      expect(typeof body).toBe("object");
    }
    const failed = (await wiki.bot.get({ ...common(version), action: "nonsense" })) as Body;
    expect(Object.keys(failed.error).sort()).toEqual(["*", "code", "info"]);
  });
});
