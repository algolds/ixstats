/** @jest-environment node */
/**
 * Plan 407: the mirror's MediaWiki session. A login that does not succeed is an error: there is no anonymous
 * fallback, because a write with no login would land as an IP edit.
 */
// The mirror's api.php and bot login come from `wikiosConfig`; this test sets their variables as it runs.
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);

import {
  getBotSessionAndToken,
  invalidateCsrfToken,
  mirrorBotName,
} from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { API_URL, createFakeMediaWiki } from "~/tests/helpers/fake-mediawiki";

const realFetch = globalThis.fetch;
let wiki: ReturnType<typeof createFakeMediaWiki>;

beforeEach(() => {
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  wiki = createFakeMediaWiki();
  globalThis.fetch = wiki.fetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
});

describe("the api.php the mirror logs in to (plan 415: wikiosConfig.mediawiki.writeApiUrl)", () => {
  const urlsRequested = () => wiki.fetch.mock.calls.map(([input]) => String(input).split("?")[0]);

  it("is WIKIOS_MEDIAWIKI_API when it is set", async () => {
    process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8081/api.php";

    await getBotSessionAndToken();

    expect(new Set(urlsRequested())).toEqual(new Set([API_URL]));
  });

  it("is the internal URL when only that is set: a server-side call never goes out through the public host", async () => {
    delete process.env.WIKIOS_MEDIAWIKI_API;
    process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8081/api.php";

    await getBotSessionAndToken();

    expect(new Set(urlsRequested())).toEqual(new Set(["http://127.0.0.1:8081/api.php"]));
  });

  it("is the public api.php when neither is set", async () => {
    delete process.env.WIKIOS_MEDIAWIKI_API;

    await getBotSessionAndToken();

    expect(new Set(urlsRequested())).toEqual(new Set([`${mediaWikiOrigin()}/api.php`]));
  });
});

describe("getBotSessionAndToken", () => {
  it("logs in as the bot password, forwards the session and returns the CSRF token", async () => {
    const session = await getBotSessionAndToken();

    expect(session.csrfToken).toBe("csrf-token+\\x");
    expect(session.cookies).toContain("wikiSession=abc");
    const login = wiki.requests.find((request) => request.params.action === "login");
    expect(login?.method).toBe("POST");
    expect(login?.params).toMatchObject({
      lgname: "WikiOSMirror@wikios",
      lgpassword: "bot-password",
      lgtoken: "login-token+\\",
    });
    // the CSRF token is fetched with the logged-in session
    const csrf = wiki.requests.find((request) => request.params.type === "csrf");
    expect(csrf?.cookie).toContain("wikiSession=abc");
  });

  it("caches the session, until the token is invalidated", async () => {
    await getBotSessionAndToken();
    const requests = wiki.requests.length;

    await getBotSessionAndToken();
    expect(wiki.requests).toHaveLength(requests);

    invalidateCsrfToken();
    await getBotSessionAndToken();
    expect(wiki.requests.length).toBeGreaterThan(requests);
  });

  it("throws, and sends nothing, when the bot credentials are not set", async () => {
    delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;

    await expect(getBotSessionAndToken()).rejects.toThrow(/WIKIOS_MEDIAWIKI_BOT_USER/);
    expect(wiki.fetch).not.toHaveBeenCalled();

    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
    delete process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
    await expect(getBotSessionAndToken()).rejects.toThrow(/WIKIOS_MEDIAWIKI_BOT_TOKEN/);
    expect(wiki.fetch).not.toHaveBeenCalled();
  });

  it("throws, and never asks for a CSRF token, when MediaWiki refuses the login", async () => {
    wiki.state.loginResult = "Failed";

    await expect(getBotSessionAndToken()).rejects.toThrow(/bot login failed: Failed/);
    expect(wiki.requests.some((request) => request.params.type === "csrf")).toBe(false);
  });

  it("throws when the token MediaWiki hands out is the anonymous one", async () => {
    wiki.state.csrfToken = "+\\";

    await expect(getBotSessionAndToken()).rejects.toThrow(/not logged in/);
  });

  it("throws on an HTTP error instead of carrying on with a session it does not have", async () => {
    globalThis.fetch = jest.fn(
      async () => new Response("down", { status: 503 })
    ) as unknown as typeof fetch;

    await expect(getBotSessionAndToken()).rejects.toThrow(/HTTP 503/);
  });

  it("names the status and the start of the body of an answer that is not JSON", async () => {
    globalThis.fetch = jest.fn(
      async () =>
        new Response("<html>Cloudflare: you are being rate limited</html>", { status: 200 })
    ) as unknown as typeof fetch;

    await expect(getBotSessionAndToken()).rejects.toThrow(
      "MediaWiki login answered with something that is not JSON (HTTP 200): <html>Cloudflare: you are being rate limited</html>"
    );

    globalThis.fetch = jest.fn(
      async () => new Response("down for maintenance", { status: 503 })
    ) as unknown as typeof fetch;
    await expect(getBotSessionAndToken()).rejects.toThrow(
      "MediaWiki login failed (HTTP 503): down for maintenance"
    );
  });

  it("does not cache a session whose login failed", async () => {
    wiki.state.loginResult = "Failed";
    await expect(getBotSessionAndToken()).rejects.toThrow();

    wiki.state.loginResult = "Success";
    await expect(getBotSessionAndToken()).resolves.toMatchObject({ csrfToken: "csrf-token+\\x" });
  });
});

describe("mirrorBotName", () => {
  it("is the account of the bot-password login, normalised; null when there is none", () => {
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "  wikiOSMirror@wikios";
    expect(mirrorBotName()).toBe("WikiOSMirror");

    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "  @wikios";
    expect(mirrorBotName()).toBeNull();

    delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;
    expect(mirrorBotName()).toBeNull();
  });
});
