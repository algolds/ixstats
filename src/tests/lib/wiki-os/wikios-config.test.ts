/** @jest-environment node */
/**
 * WikiOS's configuration: TemplateStyles fail closed for any unknown value, server-side calls go through the internal
 * URL, a public URL that is not one is refused by name, the wiki host is recognised with its dots escaped (never a
 * lookalike host), the media proxy fetches only the wikis and their CDNs, and each wiki keeps its own file hosts.
 */

import {
  buildWikiosConfig,
  isMediaWikiUrl,
  loopbackRendererMissing,
  mediaWikiHostPattern,
} from "~/lib/wiki-os/config";
import { isAllowedMediaUrl } from "~/lib/wiki-os/media-hosts";
import { SISTER_WIKI_HOSTS, sisterWikiFileHosts, sisterWikiHost } from "~/lib/wiki-os/wiki-hosts";

describe("buildWikiosConfig", () => {
  it("leaves TemplateStyles on only for an unset, empty, 1, true, on or yes WIKIOS_TEMPLATESTYLES: any other value fails closed", () => {
    expect(buildWikiosConfig({}).templateStyles).toBe(true);
    for (const on of ["", "  ", "1", "true", "TRUE", "On", " yes "]) {
      expect(buildWikiosConfig({ templateStyles: on }).templateStyles).toBe(true);
    }
    for (const off of ["0", "false", "off", "no", " 0", "disabled", "of", "tru", "2", "enabled", "ture", "anything"]) {
      expect(buildWikiosConfig({ templateStyles: off }).templateStyles).toBe(false);
    }
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
  it("refuses a public URL that is not a URL, by name", () => {
    expect(() => buildWikiosConfig({ publicUrl: "not a url" })).toThrow(/NEXT_PUBLIC_MEDIAWIKI_URL/);
  });
});

describe("loopbackRendererMissing", () => {
  const internal = "http://127.0.0.1:8081/api.php";

  afterEach(() => jest.restoreAllMocks());

  it("is missing only in production with no internal URL", () => {
    expect(loopbackRendererMissing({ NODE_ENV: "production" })).toBe(true);
    expect(loopbackRendererMissing({ NODE_ENV: "production", WIKIOS_MEDIAWIKI_INTERNAL_URL: "  " })).toBe(true);
    expect(loopbackRendererMissing({ NODE_ENV: "production", WIKIOS_MEDIAWIKI_INTERNAL_URL: internal })).toBe(false);
    expect(loopbackRendererMissing({ NODE_ENV: "development" })).toBe(false);
    expect(loopbackRendererMissing({ NODE_ENV: "test" })).toBe(false);
    expect(loopbackRendererMissing({})).toBe(false);
  });

  it("reads the environment at call time, not the configuration frozen at load", () => {
    jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "production", WIKIOS_MEDIAWIKI_INTERNAL_URL: "" });
    expect(loopbackRendererMissing()).toBe(true);
    jest.replaceProperty(process, "env", { ...process.env, WIKIOS_MEDIAWIKI_INTERNAL_URL: internal });
    expect(loopbackRendererMissing()).toBe(false);
  });
});

describe("the module's configuration and helpers", () => {
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

describe("the wiki hosts", () => {
  describe("sister wiki hosts", () => {
    it("let the media proxy fetch the wikis and their CDNs, and nothing else", () => {
      expect(isAllowedMediaUrl("https://iiwiki.com/images/a.png")).toBe(true);
      expect(isAllowedMediaUrl("https://static.wikia.nocookie.net/x/a.png")).toBe(true);
      expect(isAllowedMediaUrl("https://upload.wikimedia.org/x/a.png")).toBe(true);
      expect(isAllowedMediaUrl("https://iiwiki.com.evil.example/a.png")).toBe(false);
      expect(isAllowedMediaUrl("ftp://iiwiki.com/a.png")).toBe(false);
    });
    it("give each wiki its own file hosts", () => {
      expect(sisterWikiFileHosts(SISTER_WIKI_HOSTS.iiwiki)).toEqual(["iiwiki.com"]);
      expect(sisterWikiFileHosts(SISTER_WIKI_HOSTS.althistory)).toEqual(["althistory.fandom.com", "static.wikia.nocookie.net"]);
      expect(sisterWikiHost("hasOwnProperty")).toBeNull();
    });
  });
});
