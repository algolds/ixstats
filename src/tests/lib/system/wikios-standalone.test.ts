import {
  WIKIOS_ALLOWED_PREFIXES,
  WikiStandaloneConfigError,
  isWikiStandalone,
  wikiStandaloneRedirect,
} from "~/lib/system/wikios-standalone";

const IXSTATES = "https://ixwiki.com/projects/ixstates";

describe("isWikiStandalone", () => {
  const original = process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    else process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = original;
  });

  it("is on only for the exact value 'true'", () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    expect(isWikiStandalone()).toBe(true);
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "false";
    expect(isWikiStandalone()).toBe(false);
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "1";
    expect(isWikiStandalone()).toBe(false);
    delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    expect(isWikiStandalone()).toBe(false);
  });
});

describe("wikiStandaloneRedirect", () => {
  const original = process.env.NEXT_PUBLIC_IXSTATES_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_IXSTATES_URL = IXSTATES;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_IXSTATES_URL;
    else process.env.NEXT_PUBLIC_IXSTATES_URL = original;
  });

  it("sends the root to the Main Page and drops the query string", () => {
    expect(wikiStandaloneRedirect("/", "")).toBe("/wiki/Main_Page");
    expect(wikiStandaloneRedirect("/", "?ref=x")).toBe("/wiki/Main_Page");
  });

  it.each([
    "/wiki",
    "/wiki/Main_Page",
    "/w",
    "/w/api.php",
    "/wiki/Special:FilePath/Example.png",
    "/util/search",
    "/stashes",
    "/stashes/abc",
    "/api/trpc/wikios.page.get",
    "/api/wiki/sync-webhook",
    "/api/wikios/inbound-sync",
    "/api/mediawiki/parse",
    "/api/mediawiki/ixwiki/images/a/ab/Flag.png",
    "/api/ixtime/current",
    "/api/onoma/tts",
    "/api.php",
    "/wiki-sitemap",
    "/wiki-sitemap.xml",
    "/sitemap.xml",
    "/sitemap-0.xml",
    "/sitemap/1",
    "/robots.txt",
    "/_next/static/chunks/a.js",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sso-callback",
    "/favicon.ico",
    "/favicon-wikios.svg",
    "/wikios-logo.svg",
    "/fonts/inter.woff2",
    "/images/wikios-banner.png",
    "/images/wikios/banner.png",
    "/flags/ixnay.svg",
    "/maplibre/maplibre-gl-worker.mjs",
    "/maplibre/maplibre-gl-shared.mjs",
    "/images/flags/placeholder.svg",
    "/images/uploads/uploaded_1784640623616_c02c54d0_Dushina_Flags_and_Test_Flags_1_.png",
    "/opensearch.xml",
  ])("serves %s in WikiOS", (pathname) => {
    expect(wikiStandaloneRedirect(pathname, "?x=1")).toBeNull();
  });

  it.each([
    ["/mycountry", ""],
    ["/mycountry/overview", "?tab=gdp"],
    ["/countries/ixnay", ""],
    ["/vault", ""],
    ["/api/health", ""],
    ["/api/sse/map-updates", ""],
    ["/api/ixtime/set-override", ""],
    ["/api/onoma/other", ""],
    ["/maps", "?embed=true&lat=1&lng=2&zoom=3"],
    ["/images/cards/placeholder-nation.png", ""],
    // only /images/uploads, /images/flags and /images/wikios are WikiOS's: a longer name is not a match, and
    // MediaWiki's own uploads (nginx sends them to MediaWiki, never to WikiOS) are not either
    ["/images/uploads_backup/Flag.png", ""],
    ["/images/a/ab/Flag.png", ""],
    ["/images/thumb/a/ab/Flag.png/330px-Flag.png", ""],
    ["/sw.js", ""],
    ["/manifest.json", ""],
    ["/sounds/cards/card-flip.mp3", ""],
    ["/admin", ""],
  ])("redirects %s to IxStates", (pathname, search) => {
    expect(wikiStandaloneRedirect(pathname, search)).toBe(`${IXSTATES}${pathname}${search}`);
  });

  it("does not treat a longer name as a match for a segment prefix", () => {
    expect(wikiStandaloneRedirect("/wikipedia", "")).toBe(`${IXSTATES}/wikipedia`);
    expect(wikiStandaloneRedirect("/utilities", "")).toBe(`${IXSTATES}/utilities`);
    expect(wikiStandaloneRedirect("/stashed", "")).toBe(`${IXSTATES}/stashed`);
    expect(wikiStandaloneRedirect("/fontsy", "")).toBe(`${IXSTATES}/fontsy`);
    // "/w" is a segment prefix: it is api.php's directory, not every path that starts with w
    expect(wikiStandaloneRedirect("/wx/api.php", "")).toBe(`${IXSTATES}/wx/api.php`);
    expect(wikiStandaloneRedirect("/world", "")).toBe(`${IXSTATES}/world`);
    expect(wikiStandaloneRedirect("/wikipedia", "")).toBe(`${IXSTATES}/wikipedia`);
  });

  it("uses NEXT_PUBLIC_IXSTATES_URL and ignores its trailing slashes", () => {
    process.env.NEXT_PUBLIC_IXSTATES_URL = "https://ixstates.example/";
    expect(wikiStandaloneRedirect("/countries/ixnay", "?a=1")).toBe(
      "https://ixstates.example/countries/ixnay?a=1"
    );
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["blank", "   "],
  ])(
    "has no default: a redirect to IxStates throws when NEXT_PUBLIC_IXSTATES_URL is %s",
    (_label, value) => {
      if (value === undefined) delete process.env.NEXT_PUBLIC_IXSTATES_URL;
      else process.env.NEXT_PUBLIC_IXSTATES_URL = value;
      expect(() => wikiStandaloneRedirect("/vault", "")).toThrow(WikiStandaloneConfigError);
      expect(() => wikiStandaloneRedirect("/vault", "")).toThrow(/NEXT_PUBLIC_IXSTATES_URL/);
    }
  );

  it("does not need NEXT_PUBLIC_IXSTATES_URL for paths WikiOS serves or for the root", () => {
    delete process.env.NEXT_PUBLIC_IXSTATES_URL;
    expect(wikiStandaloneRedirect("/", "")).toBe("/wiki/Main_Page");
    expect(wikiStandaloneRedirect("/wiki/Main_Page", "")).toBeNull();
    expect(wikiStandaloneRedirect("/_next/static/a.js", "")).toBeNull();
  });
});

describe("WIKIOS_ALLOWED_PREFIXES", () => {
  it("is a single list of absolute path prefixes without duplicates", () => {
    expect(WIKIOS_ALLOWED_PREFIXES.every((prefix) => prefix.startsWith("/"))).toBe(true);
    expect(new Set(WIKIOS_ALLOWED_PREFIXES).size).toBe(WIKIOS_ALLOWED_PREFIXES.length);
  });
});
