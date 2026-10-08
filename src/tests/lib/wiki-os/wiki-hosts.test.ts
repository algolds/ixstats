/** @jest-environment node */
/**
 * The sister wikis are one list (`wiki-hosts.ts`): every allowlist is built from it, so a host that is not an entry
 * is never fetched, and adding an entry is all a new MediaWiki host needs.
 */
import { getWiki, WIKIS } from "~/app/api/mediawiki/_config";
import { isAllowedMediaUrl } from "~/lib/wiki-os/media-hosts";
import { PROOF_SOURCES } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { WIKI_SOURCES } from "~/lib/wiki-os/config";
import {
  SISTER_READER_IDS,
  SISTER_WIKI_HOSTS,
  SISTER_WIKI_IDS,
  sisterWikiFileHosts,
  sisterWikiHost,
} from "~/lib/wiki-os/wiki-hosts";

describe("sister wiki hosts", () => {
  it("are https origins with no path, and api paths that start with a slash", () => {
    for (const host of Object.values(SISTER_WIKI_HOSTS)) {
      const origin = new URL(host.origin);
      expect(origin.protocol).toBe("https:");
      expect(origin.origin).toBe(host.origin);
      expect(host.apiPath.startsWith("/")).toBe(true);
    }
  });

  it("feed the wiki sources WikiOS reads, the proxies and account proof", () => {
    expect(SISTER_READER_IDS).toEqual(["iiwiki", "althistory"]);
    expect(Object.keys(WIKI_SOURCES)).toEqual(["ixwiki", "iiwiki", "althistory"]);
    expect(WIKI_SOURCES.iiwiki).toMatchObject({ name: "IIWiki", baseUrl: "https://iiwiki.com", apiEndpoint: "/api.php" });
    expect([...PROOF_SOURCES]).toEqual(["ixwiki", "iiwiki", "althistory"]);
    expect(Object.keys(WIKIS)).toEqual(["ixwiki", ...SISTER_WIKI_IDS]);
  });

  it("keep each wiki's proxy behaviour", () => {
    expect(getWiki("iiwiki")).toMatchObject({
      siteUrl: "https://iiwiki.com",
      corsOrigins: expect.arrayContaining(["https://iiwiki.com", "https://www.iiwiki.com"]),
      detectCloudflare: true,
      directImagePrefix: "images/",
      allowedActions: ["query", "opensearch", "parse"],
    });
    expect(getWiki("iiwiki")!.apiUrl()).toBe("https://iiwiki.com/api.php");
    expect(getWiki("althistory")).toMatchObject({ corsOrigins: ["*"], resolveRetries: 2 });
    expect(getWiki("commons")!.apiUrl()).toBe("https://commons.wikimedia.org/w/api.php");
    expect(getWiki("commons")!.imageInfoApiUrl()).toBe("https://commons.wikimedia.org/w/api.php");
    expect(getWiki("toString")).toBeNull();
    expect(getWiki("evil")).toBeNull();
  });

  it("let the media proxy fetch the wikis and their CDNs, and nothing else", () => {
    expect(isAllowedMediaUrl("https://iiwiki.com/images/a.png")).toBe(true);
    expect(isAllowedMediaUrl("https://static.wikia.nocookie.net/x/a.png")).toBe(true);
    expect(isAllowedMediaUrl("https://upload.wikimedia.org/x/a.png")).toBe(true);
    expect(isAllowedMediaUrl("https://iiwiki.com.evil.example/a.png")).toBe(false);
    expect(isAllowedMediaUrl("ftp://iiwiki.com/a.png")).toBe(false);
  });

  it("allow every configured wiki's own host, IxWiki's included", () => {
    for (const wiki of Object.values(WIKIS)) {
      expect(isAllowedMediaUrl(`${wiki.siteUrl}/images/a.png`)).toBe(true);
    }
  });

  it("give each wiki its own file hosts", () => {
    expect(sisterWikiFileHosts(SISTER_WIKI_HOSTS.iiwiki)).toEqual(["iiwiki.com"]);
    expect(sisterWikiFileHosts(SISTER_WIKI_HOSTS.althistory)).toEqual(["althistory.fandom.com", "static.wikia.nocookie.net"]);
    expect(sisterWikiHost("hasOwnProperty")).toBeNull();
  });
});
