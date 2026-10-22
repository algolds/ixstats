/** @jest-environment node */
/**
 * api.php, the request pipeline and the session (plan 410): unknown actions, output formats, the error header, the rate
 * limits, siteinfo on a bot's startup, the anonymous token, bot-password login, logout and assert, the session secret
 * (no fallback key, forged cookies refused, anonymous reads kept) and the legacy action=tokens.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { Bot, call, fakeAuthStore, fakeStore, fakeWiki, type FakeWikiData, makeDeps, makeWikiDeps, NOW } from "./harness";
import { createHmac } from "node:crypto";
import { env } from "~/env";
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
});

describe("meta=siteinfo", () => {
  it("answers what Pywikibot reads on startup (formatversion=1)", async () => {
    const body = await run("action=query&meta=siteinfo&siprop=general|namespaces|namespacealiases|extensions&format=json");
    const { general, namespaces, namespacealiases, extensions } = body.query;
    expect(general.generator).toMatch(/^MediaWiki 1\.45\.1 \(WikiOS\)$/);
    expect(general).toMatchObject({
      sitename: "WikiOS",
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
});

describe("meta=userinfo and tokens, anonymous", () => {
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
});

describe("the session secret", () => {
  type Body = Record<string, any>;
  const mutableEnv = env as { WIKIOS_API_SESSION_SECRET?: string };
  const REAL_SECRET = mutableEnv.WIKIOS_API_SESSION_SECRET;

  const data = (): FakeWikiData => ({
    pages: [{ pageId: 1, title: "Alpha" }],
    revisions: [{ revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "alpha" }],
  });

  afterEach(() => {
    mutableEnv.WIKIOS_API_SESSION_SECRET = REAL_SECRET;
    jest.restoreAllMocks();
  });

  /** A cookie value signed the way api.php signs one (`<id>.<HMAC-SHA256 of "session:<id>">`) under a key of the forger's choosing. */
  const forgedCookie = (sessionId: string, key: string) =>
    `${sessionId}.${createHmac("sha256", key).update(`session:${sessionId}`).digest("base64url")}`;

  describe.each([
    ["unset", undefined],
    ["shorter than 32 characters", "a-short-secret"],
  ])("with the session secret %s", (_label, secret) => {
    beforeEach(() => {
      mutableEnv.WIKIOS_API_SESSION_SECRET = secret;
      jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    it("refuses a login and starts no session", async () => {
      const wiki = await makeWikiDeps(data());
      const sessionsBefore = wiki.deps.auth as unknown as { sessions: Map<string, unknown> };
      // the login token cannot be had (next test), so a login brings a made-up one: refused before any password is checked
      const direct = await call(wiki.deps, "", {
        method: "POST",
        body: {
          action: "login",
          lgname: "Heku@Bot",
          lgpassword: "bot-secret",
          lgtoken: "0123456789abcdef0123456789abcdef+\\",
          format: "json",
        },
      });
      expect((direct.body as Body).error.code).toBe("sessionsecretmissing");
      expect((direct.body as Body).login).toBeUndefined();
      expect(direct.setCookies).toEqual([]); // no session cookie, and no login nonce cookie either
      expect(sessionsBefore.sessions.size).toBe(0);
    });

    it("refuses to hand out a login token", async () => {
      const wiki = await makeWikiDeps(data());
      const output = await call(wiki.deps, "action=query&meta=tokens&type=login&format=json");
      expect((output.body as Body).error.code).toBe("sessionsecretmissing");
      expect(output.setCookies).toEqual([]);
      expect(output.errorCode).toBe("sessionsecretmissing");
    });

    it("rejects a forged session cookie, whoever signed it: with no key, a guessed one or the old development key", async () => {
      const wiki = await makeWikiDeps(data());
      // a session that exists in the store: only a valid signature could have named it
      (wiki.deps.auth as unknown as { sessions: Map<string, unknown> }).sessions.set(
        "known-session",
        {
          id: "known-session",
          botPasswordId: "bp1",
          userId: "u-heku",
          expiresAt: new Date("2030-01-01T00:00:00Z"),
          grants: ["basic", "editpage"],
        } as never
      );
      for (const cookie of [
        "known-session.forged",
        forgedCookie("known-session", ""),
        forgedCookie("known-session", "wikios-api-development-secret-not-for-production"),
        forgedCookie("known-session", secret ?? ""),
      ]) {
        const read = await call(wiki.deps, "action=query&meta=userinfo&format=json", {
          cookies: { wikios_api_session: cookie },
        });
        expect((read.body as Body).error?.code).toBe("sessionsecretmissing");
        const write = await call(wiki.deps, "", {
          method: "POST",
          cookies: { wikios_api_session: cookie },
          body: { action: "edit", title: "Alpha", text: "x", token: "+\\", format: "json" },
        });
        expect((write.body as Body).error?.code).toBe("sessionsecretmissing");
      }
      expect(wiki.calls.filter((c) => c.name === "saveWikitext")).toEqual([]);
    });

    it("keeps anonymous reads working, and anonymous writes denied", async () => {
      const wiki = await makeWikiDeps(data());
      const siteinfo = (
        await call(wiki.deps, "action=query&meta=siteinfo&siprop=general&format=json")
      ).body as Body;
      expect(siteinfo.query.general.sitename).toBe("WikiOS");
      const pages = (await call(wiki.deps, "action=query&list=allpages&format=json")).body as Body;
      expect(pages.query.allpages).toHaveLength(1);
      const user = (await call(wiki.deps, "action=query&meta=userinfo&format=json")).body as Body;
      expect(user.query.userinfo.id).toBe(0);
      const csrf = (await call(wiki.deps, "action=query&meta=tokens&format=json")).body as Body;
      expect(csrf.query.tokens.csrftoken).toBe("+\\");
      const parsed = (await call(wiki.deps, "action=parse&page=Alpha&prop=wikitext&format=json"))
        .body as Body;
      expect(parsed.error).toBeUndefined();
      const write = (
        await call(wiki.deps, "", {
          method: "POST",
          body: { action: "edit", title: "Alpha", text: "x", token: "+\\", format: "json" },
        })
      ).body as Body;
      expect(write.error.code).toBe("writeapidenied");
    });

    it("logs one warning at first use, and not again", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      await jest.isolateModulesAsync(async () => {
        // a fresh copy of the module (its "already warned" flag starts false) over a fresh copy of the env mock
        (require("~/env").env as { WIKIOS_API_SESSION_SECRET?: string }).WIKIOS_API_SESSION_SECRET =
          secret;
        const fresh = await import("~/lib/wiki-os/api-compat/auth");
        expect(() => fresh.newLoginNonce(new Date())).toThrow(/sessionsecretmissing/);
        expect(() => fresh.readSessionCookie("a.b")).toThrow(/sessionsecretmissing/);
        expect(() => fresh.sessionToken("id", "csrf")).toThrow(/sessionsecretmissing/);
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toContain("WIKIOS_API_SESSION_SECRET");
    });
  });

  describe("with a session secret", () => {
    it("logs in, and still rejects a cookie signed with another key (the old development key included)", async () => {
      const wiki = await makeWikiDeps(data());
      const login = (await wiki.bot.login()) as Body;
      expect(login.login.result).toBe("Success");
      const me = (await wiki.bot.get({ action: "query", meta: "userinfo", format: "json" })) as Body;
      expect(me.query.userinfo.name).toBe("Heku");

      const sessionId = Object.values(wiki.bot.jar)
        .find((value) => value.includes("."))!
        .split(".")[0]!;
      for (const key of [
        "wikios-api-development-secret-not-for-production",
        "another-key-of-more-than-32-characters!!",
      ]) {
        const forged = new Bot(wiki.deps);
        forged.jar.wikios_api_session = forgedCookie(sessionId, key);
        const read = (await forged.get({
          action: "query",
          meta: "userinfo",
          format: "json",
        })) as Body;
        expect(read.query.userinfo.id).toBe(0); // anonymous: the forged cookie opened nothing
      }
    });
  });
});

describe("src/env.ts never refuses to start over the session secret", () => {
  const BASE_ENV: Record<string, string> = {
    DATABASE_URL: "postgresql://user:pass@localhost:5433/ixstats_test",
    CRON_SECRET: "c".repeat(40),
    WIKI_SYNC_WEBHOOK_SECRET: "w".repeat(40),
    // what production requires besides the secret under test
    IXTIME_BOT_SECRET: "i".repeat(40),
    CLERK_SECRET_KEY: "sk_test_" + "x".repeat(30),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_" + "x".repeat(30),
  };

  /** The invalid-variable names `src/env.ts` reports (it logs them and throws), or [] when it loads. */
  async function invalidVariables(overrides: Record<string, string | undefined>, nodeEnv: string): Promise<string[]> {
    const saved = { ...process.env };
    const logged: unknown[][] = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
    try {
      Object.assign(process.env, BASE_ENV, { NODE_ENV: nodeEnv, SKIP_ENV_VALIDATION: "" });
      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      let failed = false;
      await jest.isolateModulesAsync(async () => {
        try {
          await import("../../../../env");
        } catch {
          failed = true;
        }
      });
      return failed ? [...JSON.stringify(logged).matchAll(/"path":\["([A-Za-z_]+)"/g)].map((match) => match[1]!) : [];
    } finally {
      spy.mockRestore();
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  }

  describe.each(["production"])("src/env.ts in %s", (nodeEnv) => {
    it.each([
      ["unset", undefined],
      ["one character", "x"],
      ["32 characters", "k".repeat(32)],
    ])("loads when WIKIOS_API_SESSION_SECRET is %s", async (_label, value) => {
      const failures = await invalidVariables({ WIKIOS_API_SESSION_SECRET: value }, nodeEnv);
      expect(failures.filter((name) => name.includes("WIKIOS_API_SESSION_SECRET"))).toEqual([]);
      expect(failures).toEqual([]);
    });
  });
});

describe("legacy tokens", () => {
  type Body = Record<string, any>;

  const DATA = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Alpha" },
      { pageId: 2, title: "Beta", redirect: "Alpha" },
    ],
    revisions: [{ revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "a" }],
  });

  describe("action=tokens (legacy)", () => {
    it("defaults to the edit token, gives an anonymous caller the anonymous token, and refuses an unknown type", async () => {
      const deps = await makeDeps({ store: fakeWiki(DATA()) });
      expect(((await call(deps, "action=tokens&format=json")).body as Body).tokens).toEqual({ edittoken: "+\\" });
      expect(((await call(deps, "action=tokens&type=bogus&format=json")).body as Body).error.code).toBe("badvalue");
    });
  });
});
