/** @jest-environment node */
/**
 * Plan 410: api.php has no fallback signing key. Without WIKIOS_API_SESSION_SECRET (or with one under
 * 32 characters) a login, a login token and any request that carries a session cookie answer the
 * MediaWiki error envelope `sessionsecretmissing`, nothing is signed or accepted, and anonymous reads
 * keep working, so deploying before the operator sets the secret never takes the app down.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { createHmac } from "node:crypto";
import { env } from "~/env";
import { call, makeWikiDeps, Bot, type FakeWikiData } from "./harness";

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
  ["empty", ""],
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
    expect(siteinfo.query.general.sitename).toBe("IxWiki");
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
