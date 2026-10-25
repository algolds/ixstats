/** @jest-environment node */
/**
 * IxStates' public URL (app-url.ts): the origin of `APP_URL` or `NEXT_PUBLIC_APP_URL` plus the base path, once. Every
 * absolute link IxStates sends out (feeds, Discord, Cloudflare purges, story-chain sections) is built on it. With
 * neither set, dev falls back to the wiki's origin and production refuses: a wrong host is worse than an error.
 */
type AppUrlModule = typeof import("~/lib/app-url");

const KEYS = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "BASE_PATH",
  "NEXT_PUBLIC_BASE_PATH",
  "NEXT_PUBLIC_MEDIAWIKI_URL",
  "NEXT_PUBLIC_IXWORLD_STANDALONE",
  "NODE_ENV",
] as const;
type Key = (typeof KEYS)[number];
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const env = process.env as Record<string, string | undefined>;

/** The module loaded fresh under exactly `vars` (every other key above unset; NODE_ENV stays "test" unless given). */
function load(vars: Partial<Record<Key, string>>): AppUrlModule {
  for (const key of KEYS) if (key !== "NODE_ENV") delete env[key];
  env.NODE_ENV = "test";
  Object.assign(env, vars);
  let mod: AppUrlModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<AppUrlModule>("~/lib/app-url");
  });
  return mod!;
}

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
});

describe("appUrl", () => {
  it("appUrl joins the origin, the base path and the path", () => {
    const { appUrl, appOrigin } = load({
      NEXT_PUBLIC_APP_URL: "https://ixwiki.com",
      BASE_PATH: "/projects/ixstates",
    });
    expect(appOrigin()).toBe("https://ixwiki.com");
    expect(appUrl("/wiki/Caphiria?action=history")).toBe(
      "https://ixwiki.com/projects/ixstates/wiki/Caphiria?action=history"
    );
  });

  it("a path in NEXT_PUBLIC_APP_URL is dropped, so the base path appears once", () => {
    const { appUrl, wikiPermalink } = load({
      NEXT_PUBLIC_APP_URL: "https://ixwiki.com/projects/ixstates/",
      BASE_PATH: "/projects/ixstates",
    });
    expect(appUrl("/dashboard/post/p1")).toBe(
      "https://ixwiki.com/projects/ixstates/dashboard/post/p1"
    );
    // a path that already carries the base path keeps it once
    expect(appUrl("/projects/ixstates/images/discord/a.png")).toBe(
      "https://ixwiki.com/projects/ixstates/images/discord/a.png"
    );
    expect(wikiPermalink("Holy See")).toBe("https://ixwiki.com/projects/ixstates/wiki/Holy_See");
  });

  it("with no base path the path follows the origin directly", () => {
    const { appUrl } = load({ NEXT_PUBLIC_APP_URL: "http://localhost:3000/" });
    expect(appUrl("/wiki/Main_Page")).toBe("http://localhost:3000/wiki/Main_Page");
  });

  it("APP_URL wins over NEXT_PUBLIC_APP_URL", () => {
    const { appOrigin } = load({
      APP_URL: "https://app.example.org/some/path",
      NEXT_PUBLIC_APP_URL: "https://public.example.org",
    });
    expect(appOrigin()).toBe("https://app.example.org");
  });

  it("an empty APP_URL reads as unset", () => {
    const { appOrigin } = load({ APP_URL: "", NEXT_PUBLIC_APP_URL: "https://public.example.org" });
    expect(appOrigin()).toBe("https://public.example.org");
  });

  it("with neither, the wiki's origin, never maps.ixwiki.com", () => {
    const { appUrl, appOrigin } = load({
      NEXT_PUBLIC_MEDIAWIKI_URL: "https://wiki.example.net/w/",
      BASE_PATH: "/projects/ixstates",
    });
    expect(appOrigin()).toBe("https://wiki.example.net");
    expect(appUrl("/wiki/X")).toBe("https://wiki.example.net/projects/ixstates/wiki/X");
    expect(appUrl("/wiki/X")).not.toContain("maps.ixwiki.com");
  });

  it("in dev a value that is not a URL falls back to the wiki's origin", () => {
    const { appOrigin } = load({
      NEXT_PUBLIC_APP_URL: "not a url",
      NEXT_PUBLIC_MEDIAWIKI_URL: "https://wiki.example.net",
    });
    expect(appOrigin()).toBe("https://wiki.example.net");
  });

  it("an absolute URL is returned as it is", () => {
    const { appUrl } = load({
      NEXT_PUBLIC_APP_URL: "https://ixwiki.com",
      BASE_PATH: "/projects/ixstates",
    });
    expect(appUrl("https://cdn.discordapp.com/a.png")).toBe("https://cdn.discordapp.com/a.png");
    expect(appUrl("http://example.org/x")).toBe("http://example.org/x");
    expect(appUrl("//example.org/x")).toBe("//example.org/x");
    expect(appUrl("HTTPS://Example.org/x")).toBe("HTTPS://Example.org/x");
  });

  it("wikiPermalink names a sister wiki's page with its ?source=", () => {
    const { wikiPermalink } = load({
      NEXT_PUBLIC_APP_URL: "https://ixwiki.com",
      BASE_PATH: "/projects/ixstates",
    });
    expect(wikiPermalink("Main Page", "iiwiki")).toBe(
      "https://ixwiki.com/projects/ixstates/wiki/Main_Page?source=iiwiki"
    );
  });
});

describe("appOrigin in production", () => {
  it("throws, naming NEXT_PUBLIC_APP_URL, when neither variable is set", () => {
    const { appOrigin, appUrl } = load({
      NODE_ENV: "production",
      NEXT_PUBLIC_MEDIAWIKI_URL: "https://ixwiki.com",
    });
    expect(() => appOrigin()).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => appUrl("/wiki/X")).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("throws when the value is not an http(s) URL", () => {
    expect(() =>
      load({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "not a url" }).appOrigin()
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() =>
      load({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "mailto:a@b.c" }).appOrigin()
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("uses the configured origin when it is set", () => {
    const { appOrigin } = load({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://ixwiki.com/projects/ixstates",
    });
    expect(appOrigin()).toBe("https://ixwiki.com");
  });

  it("an absolute URL needs no origin, so it never throws", () => {
    const { appUrl } = load({ NODE_ENV: "production" });
    expect(appUrl("https://cdn.discordapp.com/a.png")).toBe("https://cdn.discordapp.com/a.png");
  });

  it("importing the module never throws, so an unset variable fails only the link that needs it", () => {
    expect(() => load({ NODE_ENV: "production" })).not.toThrow();
  });
});
