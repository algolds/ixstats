/** @jest-environment node */
// Plan 415 step 1: one WikiOS config object. The wiki's host and MediaWiki endpoints are read from the
// environment once, in `config.ts`; everything else asks it.
import {
  buildWikiosConfig,
  getMediaWikiApiUrl,
  isMediaWikiUrl,
  mediaWikiApiUrl,
  mediaWikiHostPattern,
  mediaWikiImageUrl,
  mediaWikiOrigin,
  publicArticleUrl,
  titleUrlPath,
  wikiosConfig,
} from "~/lib/wiki-os/config";
import { NAMESPACE_CANONICAL_NAMES } from "~/lib/wiki-os/core/title";

describe("buildWikiosConfig", () => {
  it("defaults to the public IxWiki host with the internal API falling back to the public one", () => {
    const config = buildWikiosConfig({});

    expect(config.siteName).toBe("IxWiki");
    expect(config.projectNamespace).toBe("IxWiki");
    expect(config.articlePath).toBe("/wiki/");
    expect(config.userAgent).toBe("IxStats-Builder");
    expect(config.publicBaseUrl).toBe("https://ixwiki.com");
    expect(config.publicHost).toBe("ixwiki.com");
    expect(config.mediawiki).toEqual({
      publicApiUrl: "https://ixwiki.com/api.php",
      internalApiUrl: "https://ixwiki.com/api.php",
      writeApiUrl: "https://ixwiki.com/api.php",
      botUser: undefined,
    });
  });

  it("leaves TemplateStyles on unless WIKIOS_TEMPLATESTYLES says 0, false, off or no", () => {
    expect(buildWikiosConfig({}).templateStyles).toBe(true);
    expect(buildWikiosConfig({ templateStyles: "" }).templateStyles).toBe(true);
    expect(buildWikiosConfig({ templateStyles: "1" }).templateStyles).toBe(true);
    for (const off of ["0", "false", "OFF", " no ", " 0"]) {
      expect(buildWikiosConfig({ templateStyles: off }).templateStyles).toBe(false);
    }
  });

  it("drops the trailing slash of the configured origin and keeps its port", () => {
    const config = buildWikiosConfig({ publicUrl: "http://localhost:8080//" });

    expect(config.publicBaseUrl).toBe("http://localhost:8080");
    expect(config.publicHost).toBe("localhost:8080");
    expect(config.mediawiki.publicApiUrl).toBe("http://localhost:8080/api.php");
  });

  it("sends server-side calls to the internal URL and writes through it unless told otherwise", () => {
    const config = buildWikiosConfig({
      publicUrl: "https://wiki.example/",
      internalApiUrl: "http://127.0.0.1:8081/api.php",
    });

    expect(config.mediawiki.publicApiUrl).toBe("https://wiki.example/api.php");
    expect(config.mediawiki.internalApiUrl).toBe("http://127.0.0.1:8081/api.php");
    expect(config.mediawiki.writeApiUrl).toBe("http://127.0.0.1:8081/api.php");

    const explicit = buildWikiosConfig({
      internalApiUrl: "http://127.0.0.1:8081/api.php",
      writeApiUrl: "http://127.0.0.1:8089/api.php",
      botUser: "Mirror@wikios",
    });
    expect(explicit.mediawiki.writeApiUrl).toBe("http://127.0.0.1:8089/api.php");
    expect(explicit.mediawiki.botUser).toBe("Mirror@wikios");
  });

  it("reads a blank variable as unset", () => {
    const config = buildWikiosConfig({ publicUrl: "  ", internalApiUrl: "", botUser: " " });

    expect(config.publicBaseUrl).toBe("https://ixwiki.com");
    expect(config.mediawiki.internalApiUrl).toBe("https://ixwiki.com/api.php");
    expect(config.mediawiki.botUser).toBeUndefined();
  });

  it("refuses a public URL that is not a URL, by name", () => {
    expect(() => buildWikiosConfig({ publicUrl: "not a url" })).toThrow(/NEXT_PUBLIC_MEDIAWIKI_URL/);
  });

  it("is frozen, with its MediaWiki block", () => {
    const config = buildWikiosConfig({});

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.mediawiki)).toBe(true);
    expect(() => {
      (config as { siteName: string }).siteName = "Other";
    }).toThrow(TypeError);
  });
});

describe("the module's configuration and helpers", () => {
  it("is the frozen configuration built from this environment", () => {
    expect(Object.isFrozen(wikiosConfig)).toBe(true);
    expect(wikiosConfig).toEqual(buildWikiosConfig({}));
  });

  it("gives the origin and the API URL of each audience", () => {
    expect(mediaWikiOrigin()).toBe("https://ixwiki.com");
    expect(mediaWikiApiUrl({ internal: false })).toBe("https://ixwiki.com/api.php");
    expect(mediaWikiApiUrl({ internal: true })).toBe(wikiosConfig.mediawiki.internalApiUrl);
    expect(getMediaWikiApiUrl("ixwiki")).toBe(wikiosConfig.mediawiki.internalApiUrl);
  });

  it("keeps the sister wikis' own API URLs", () => {
    expect(getMediaWikiApiUrl("althistory")).toBe("https://althistory.fandom.com/api.php");
  });

  it("reads namespace 4 from the configuration", () => {
    expect(NAMESPACE_CANONICAL_NAMES[4]).toBe(wikiosConfig.projectNamespace);
    expect(NAMESPACE_CANONICAL_NAMES[5]).toBe(`${wikiosConfig.projectNamespace} talk`);
  });

  describe("publicArticleUrl", () => {
    it.each([
      ["Main Page", "https://ixwiki.com/wiki/Main_Page"],
      ["File:Flag of Aurelia.svg", "https://ixwiki.com/wiki/File:Flag_of_Aurelia.svg"],
      ["Café & Sons?", "https://ixwiki.com/wiki/Caf%C3%A9_%26_Sons%3F"],
      ["Aurelia/History", "https://ixwiki.com/wiki/Aurelia/History"],
    ])("links %p", (title, url) => {
      expect(publicArticleUrl(title)).toBe(url);
    });

    it("links a page of a sister wiki on that wiki", () => {
      expect(publicArticleUrl("Portal:Eurth", "iiwiki")).toBe("https://iiwiki.com/wiki/Portal:Eurth");
    });
  });

  it("encodes a title path the way the canonical title does", () => {
    expect(titleUrlPath("User talk:Foo bar")).toBe("User_talk:Foo_bar");
  });

  describe("mediaWikiImageUrl", () => {
    it.each(["/images/8/88/Flag.svg", "images/8/88/Flag.svg"])("puts %p on the wiki's host", (path) => {
      expect(mediaWikiImageUrl(path)).toBe("https://ixwiki.com/images/8/88/Flag.svg");
    });
  });

  describe("isMediaWikiUrl", () => {
    it.each([
      "https://ixwiki.com/images/a.png",
      "http://ixwiki.com/wiki/X",
      "https://www.ixwiki.com/wiki/X",
      "//ixwiki.com/images/a.png",
    ])("recognises %p", (url) => {
      expect(isMediaWikiUrl(url)).toBe(true);
    });

    it.each([
      "https://forum.ixwiki.com/threads/1/",
      "https://ixwiki.com.evil.example/wiki/X",
      "https://notixwiki.com/wiki/X",
      "https://iiwiki.com/wiki/X",
      "/images/a.png",
      "javascript:alert(1)",
      "",
    ])("does not recognise %p", (url) => {
      expect(isMediaWikiUrl(url)).toBe(false);
    });
  });

  describe("mediaWikiHostPattern", () => {
    const pattern = new RegExp(`^https?://${mediaWikiHostPattern()}/`);

    it("matches the host and its www alias, with its dots escaped", () => {
      expect(pattern.test("https://ixwiki.com/wiki/X")).toBe(true);
      expect(pattern.test("http://www.ixwiki.com/wiki/X")).toBe(true);
      expect(pattern.test("https://ixwikiXcom/wiki/X")).toBe(false);
      expect(pattern.test("https://forum.ixwiki.com/wiki/X")).toBe(false);
    });
  });
});

describe("a configured environment", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it("is read once, when the module loads", async () => {
    process.env.NEXT_PUBLIC_MEDIAWIKI_URL = "https://wiki.example/";
    process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8081/api.php";
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "Mirror@wikios";
    jest.resetModules();

    const fresh = await import("~/lib/wiki-os/config");

    expect(fresh.mediaWikiOrigin()).toBe("https://wiki.example");
    expect(fresh.getMediaWikiApiUrl("ixwiki")).toBe("http://127.0.0.1:8081/api.php");
    expect(fresh.mediaWikiApiUrl({ internal: false })).toBe("https://wiki.example/api.php");
    expect(fresh.wikiosConfig.mediawiki.botUser).toBe("Mirror@wikios");
    expect(fresh.publicArticleUrl("Main Page")).toBe("https://wiki.example/wiki/Main_Page");
    expect(fresh.WIKI_SOURCES.ixwiki.baseUrl).toBe("https://wiki.example");
  });
});
