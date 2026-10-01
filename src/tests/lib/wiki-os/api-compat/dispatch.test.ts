/** @jest-environment node */
/**
 * Plan 410: the request pipeline (format version, error envelope, POST-only actions, assert, rate
 * limits), the login/logout flow and meta=siteinfo|userinfo|tokens.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { Bot, NOW, call, fakeAuthStore, fakeLoader, fakeStore, makeDeps } from "./harness";

type Body = Record<string, any>;
const run = async (query: string, options?: Parameters<typeof call>[2], deps?: Parameters<typeof call>[0]) =>
  (await call(deps ?? (await makeDeps()), query, options)).body as Body;

describe("errors and the request pipeline", () => {
  it("answers an unknown action with badvalue, HTTP-200 style, in the bc envelope", async () => {
    const body = await run("action=nope&format=json");
    expect(body.error).toEqual({
      code: "badvalue",
      info: 'Unrecognized value for parameter "action": nope.',
      "*": "See /w/api.php for API usage.",
    });
  });

  it("asks for the action when it is missing", async () => {
    expect((await run("format=json")).error.code).toBe("missingparam");
  });

  it("refuses JSONP and other output formats", async () => {
    expect((await run("action=query&meta=siteinfo&callback=x")).error.code).toBe("badvalue");
    expect((await run("action=query&meta=siteinfo&format=xml")).error.code).toBe("badvalue");
    expect((await run("action=query&meta=siteinfo&formatversion=3")).error.code).toBe("badvalue");
    expect((await run("action=query&meta=siteinfo&format=jsonfm")).query).toBeDefined();
  });

  it("needs POST for login and logout", async () => {
    expect((await run("action=login&lgname=a&lgpassword=b")).error.code).toBe("mustbeposted");
    expect((await run("action=logout")).error.code).toBe("mustbeposted");
  });

  it("reports the error code for the MediaWiki-API-Error header", async () => {
    const output = await call(await makeDeps(), "action=nope");
    expect(output.errorCode).toBe("badvalue");
    expect((await call(await makeDeps(), "action=query&meta=tokens")).errorCode).toBeNull();
  });

  it("answers the newer error envelope when errorformat asks for it", async () => {
    const body = await run("action=nope&errorformat=plaintext&formatversion=2");
    expect(body.errors[0]).toMatchObject({ code: "badvalue", module: "main" });
    expect(body.docref).toBeDefined();
  });

  it("turns an unexpected failure into internal_api_error without leaking it", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = await makeDeps({
      store: fakeStore({ statistics: async () => { throw new Error("secret db password"); } }),
    });
    const body = await run("action=query&meta=siteinfo&siprop=statistics", undefined, deps);
    expect(body.error.code).toBe("internal_api_error");
    expect(JSON.stringify(body)).not.toContain("secret db password");
    spy.mockRestore();
  });

  it("answers ratelimited when the limiter says no, except for a caller whose grants include noratelimit", async () => {
    const limited = { success: false, resetAt: new Date(NOW.getTime() + 1000) };
    const plain = await makeDeps();
    const editor = new Bot(plain);
    await editor.login();
    plain.rateLimit = async () => limited;
    // anonymous, and a bot without the highvolume grant, are limited
    expect((await run("action=query&meta=tokens", undefined, plain)).error.code).toBe("ratelimited");
    expect(((await editor.get({ action: "query", meta: "tokens" })).error as Body).code).toBe("ratelimited");

    const highvolume = await makeDeps({ auth: await fakeAuthStore("bot-secret", ["basic", "highvolume"]) });
    const fast = new Bot(highvolume);
    await fast.login();
    highvolume.rateLimit = async () => limited;
    expect((await fast.get({ action: "query", meta: "tokens" })).query).toBeDefined();
  });

  it("limits an anonymous caller by address and a logged-in bot by account", async () => {
    const seen: string[] = [];
    const deps = await makeDeps({
      rateLimit: async (identity, bucket) => {
        seen.push(`${bucket}:${identity}`);
        return { success: true, resetAt: new Date(NOW.getTime() + 1000) };
      },
    });
    await call(deps, "action=query&meta=tokens");
    expect(seen).toEqual(["wiki_api:ip:203.0.113.9"]);
    seen.length = 0;
    const bot = new Bot(deps);
    await bot.login();
    seen.length = 0;
    await bot.get({ action: "query", meta: "tokens" });
    expect(seen).toEqual(["wiki_api:user:u-heku"]); // by account, not by address
  });

  it("adds no warnings to a clean request", async () => {
    const body = await run("action=query&meta=siteinfo&siprop=general&formatversion=2");
    expect(body.warnings).toBeUndefined();
  });
});

describe("meta=siteinfo", () => {
  it("answers what Pywikibot reads on startup (formatversion=1)", async () => {
    const body = await run("action=query&meta=siteinfo&siprop=general|namespaces|namespacealiases|extensions&format=json");
    const { general, namespaces, namespacealiases, extensions } = body.query;
    expect(general.generator).toMatch(/^MediaWiki 1\.45\.1 \(WikiOS\)$/);
    expect(general).toMatchObject({
      sitename: "IxWiki",
      mainpage: "Main Page",
      base: "https://ixwiki.com/wiki/Main_Page",
      case: "first-letter",
      lang: "en",
      articlepath: "/wiki/$1",
      scriptpath: "/w",
      server: "https://ixwiki.com",
      servername: "ixwiki.com",
      timezone: "UTC",
      writeapi: "", // formatversion=1: a true boolean is the empty string
      time: "2026-09-30T12:00:00Z",
    });
    expect(namespaces["0"]).toMatchObject({ id: 0, case: "first-letter", "*": "", content: "" });
    expect(namespaces["0"].subpages).toBeUndefined();
    expect(namespaces["4"]).toMatchObject({ id: 4, "*": "IxWiki", canonical: "IxWiki", subpages: "" });
    expect(namespaces["460"]["*"]).toBe("Campaign");
    expect(namespaces["828"]["*"]).toBe("Module");
    expect(namespaces["-1"]["*"]).toBe("Special");
    expect(namespacealiases).toEqual(
      expect.arrayContaining([
        { id: 6, "*": "Image" },
        { id: 4, "*": "Project" },
      ])
    );
    expect(extensions.map((e: Body) => e.name)).toEqual(
      expect.arrayContaining(["ParserFunctions", "Scribunto", "Cite", "TemplateStyles", "TemplateData"])
    );
  });

  it("uses plain values and real booleans for formatversion=2", async () => {
    const body = await run("action=query&meta=siteinfo&siprop=general|namespaces|namespacealiases&formatversion=2");
    expect(body.query.general.writeapi).toBe(true);
    expect(body.query.namespaces["6"]).toMatchObject({ name: "File", canonical: "File", content: false });
    expect(body.query.namespaces["0"]).toMatchObject({ name: "", content: true });
    expect(body.query.namespacealiases).toContainEqual({ id: 6, alias: "Image" });
  });

  it("answers statistics, usergroups, restrictions and the redirect magic word", async () => {
    const body = await run("action=query&meta=siteinfo&siprop=statistics|usergroups|restrictions|magicwords|interwikimap|rightsinfo&formatversion=2");
    expect(body.query.statistics).toEqual({
      pages: 10, articles: 8, edits: 50, images: 2, users: 3, activeusers: 1, admins: 1, jobs: 0,
    });
    expect(body.query.usergroups.find((g: Body) => g.name === "sysop").rights).toContain("delete");
    expect(body.query.restrictions.levels).toEqual(["", "autoconfirmed", "sysop"]);
    expect(body.query.magicwords.find((w: Body) => w.name === "redirect").aliases).toEqual(["#REDIRECT"]);
    expect(body.query.interwikimap).toEqual([]);
  });

  it("refuses an unknown siprop", async () => {
    expect((await run("action=query&meta=siteinfo&siprop=nope")).error.code).toBe("badvalue");
  });
});

describe("meta=userinfo and tokens, anonymous", () => {
  it("names an anonymous caller by address with id 0 and `anon`", async () => {
    const v1 = await run("action=query&meta=userinfo&uiprop=groups|rights|hasmsg|editcount");
    expect(v1.query.userinfo).toMatchObject({ id: 0, name: "203.0.113.9", anon: "", groups: [], rights: ["read"], editcount: 0 });
    const v2 = await run("action=query&meta=userinfo&formatversion=2");
    expect(v2.query.userinfo).toEqual({ id: 0, name: "203.0.113.9", anon: true });
  });

  it("gives an anonymous caller only the +\\ token", async () => {
    const body = await run("action=query&meta=tokens&type=csrf|watch");
    expect(body.query.tokens).toEqual({ csrftoken: "+\\", watchtoken: "+\\" });
    expect((await run("action=query&meta=tokens&type=nope")).error.code).toBe("badvalue");
  });
});

describe("bot login", () => {
  it("logs in with a bot password and then reads userinfo and a csrf token as that user", async () => {
    const bot = new Bot(await makeDeps());
    const login = await bot.login();
    expect(login.login).toEqual({ result: "Success", lguserid: 7, lgusername: "Heku" });
    expect(bot.jar.wikios_api_session).toBeDefined();

    const info = await bot.get({ action: "query", meta: "userinfo", uiprop: "groups|rights|editcount|registrationdate|blockinfo", formatversion: "2" });
    expect((info.query as Body).userinfo).toMatchObject({
      id: 7,
      name: "Heku",
      groups: expect.arrayContaining(["sysop"]),
      editcount: 12,
      registrationdate: "2020-01-02T03:04:05Z",
    });
    expect((info.query as Body).userinfo.anon).toBeUndefined();
    // grants: only editpage + basic rights survive the cap
    expect((info.query as Body).userinfo.rights).toEqual(expect.arrayContaining(["read", "edit"]));
    expect((info.query as Body).userinfo.rights).not.toContain("delete");

    const tokens = await bot.get({ action: "query", meta: "tokens", format: "json" });
    expect((tokens.query as Body).tokens.csrftoken).toMatch(/^[0-9a-f]{32}\+\\$/);
  });

  it("answers NeedToken without a login token and WrongToken for a wrong one", async () => {
    const bot = new Bot(await makeDeps());
    const need = await bot.post({ action: "login", lgname: "Heku@Bot", lgpassword: "x" });
    expect(need.login).toMatchObject({ result: "NeedToken", token: expect.stringMatching(/\+\\$/) });
    expect(need.warnings).toBeDefined();
    const wrong = await bot.post({ action: "login", lgname: "Heku@Bot", lgpassword: "x", lgtoken: "bad+\\" });
    expect(wrong.login).toEqual({ result: "WrongToken" });
  });

  it("fails with a reason for a wrong password and never starts a session", async () => {
    const deps = await makeDeps();
    const bot = new Bot(deps);
    const failed = await bot.login("Heku@Bot", "wrong");
    expect(failed.login).toMatchObject({ result: "Failed", reason: expect.stringContaining("Incorrect username or password") });
    expect(bot.jar.wikios_api_session).toBeUndefined();
  });

  it("throttles repeated attempts", async () => {
    const deps = await makeDeps({
      rateLimit: async (_id, bucket) => ({ success: bucket !== "wiki_api_login", resetAt: new Date(NOW.getTime() + 90_000) }),
    });
    const throttled = await new Bot(deps).login();
    expect(throttled.login).toEqual({ result: "Throttled", wait: 90 });
  });

  it("logs out with the session's token, and a bad token leaves the session alone", async () => {
    const deps = await makeDeps();
    const bot = new Bot(deps);
    await bot.login();
    const tokens = (await bot.get({ action: "query", meta: "tokens" })) as { query: { tokens: { csrftoken: string } } };

    const missing = await bot.post({ action: "logout" });
    expect((missing.error as Body).code).toBe("missingparam");
    const bad = await bot.post({ action: "logout", token: "nope+\\" });
    expect((bad.error as Body).code).toBe("badtoken");
    expect(bot.jar.wikios_api_session).toBeDefined();

    expect(await bot.post({ action: "logout", token: tokens.query.tokens.csrftoken })).toEqual({});
    expect(bot.jar.wikios_api_session).toBeUndefined();
    const after = await bot.get({ action: "query", meta: "userinfo", formatversion: "2" });
    expect((after.query as Body).userinfo.anon).toBe(true);
  });
});

describe("assert", () => {
  it("fails assert=user for an anonymous caller and passes for a logged-in bot", async () => {
    expect((await run("action=query&meta=userinfo&assert=user")).error.code).toBe("assertuserfailed");
    expect((await run("action=query&meta=userinfo&assert=bot")).error.code).toBe("assertbotfailed");
    expect((await run("action=query&meta=userinfo&assertuser=Heku")).error.code).toBe("assertnameduserfailed");
    expect((await run("action=query&meta=userinfo&assert=anon")).query).toBeDefined();

    const bot = new Bot(await makeDeps());
    await bot.login();
    expect((await bot.get({ action: "query", meta: "userinfo", assert: "user", assertuser: "Heku" })).query).toBeDefined();
    expect(((await bot.get({ action: "query", meta: "userinfo", assert: "anon" })).error as Body).code).toBe("assertanonfailed");
    // the grants did not give the bot flag, so assert=bot fails even for a sysop user
    expect(((await bot.get({ action: "query", meta: "userinfo", assert: "bot" })).error as Body).code).toBe("assertbotfailed");
  });

  it("passes assert=bot when the grants allow the bot right", async () => {
    const deps = await makeDeps({ loadPermissions: fakeLoader(["*", "user", "sysop", "bot"]) });
    const bot = new Bot({ ...deps, auth: await fakeAuthStore("bot-secret", ["basic", "highvolume"]) });
    await bot.login();
    expect((await bot.get({ action: "query", meta: "userinfo", assert: "bot" })).query).toBeDefined();
  });
});
