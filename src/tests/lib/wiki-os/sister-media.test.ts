/** @jest-environment node */
/**
 * sister-media: the one way an image of a sister wiki (IIWiki, AltHistory) reaches a reader: through that wiki's media
 * proxy (`/api/mediawiki/<wiki>/…`, under the base path once). The wiki's own files, relative or absolute, and a
 * Fandom CDN file (as `Special:FilePath` of its name) map there; anything else is null, so the sanitizer drops it.
 */
import { afterEach, describe, expect, it } from "@jest/globals";
import { isSisterMediaPath, sisterMediaPath } from "~/lib/wiki-os/sister-media";

const savedPublic = process.env.NEXT_PUBLIC_BASE_PATH;
const savedServer = process.env.BASE_PATH;

afterEach(() => {
  if (savedPublic === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedPublic;
  if (savedServer === undefined) delete process.env.BASE_PATH;
  else process.env.BASE_PATH = savedServer;
});

describe("sisterMediaPath", () => {
  it("a URL already under the wiki's proxy is returned as is", () => {
    const path = "/api/mediawiki/iiwiki/images/a/ab/Flag.png";
    expect(sisterMediaPath(path, "iiwiki")).toBe(path);
    expect(sisterMediaPath("/api/mediawiki/iiwiki/wiki/Special:FilePath/Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/wiki/Special:FilePath/Flag.png"
    );
  });

  it("the other wiki's proxy, or a path of the proxy that is not a file, is null", () => {
    expect(sisterMediaPath("/api/mediawiki/althistory/images/a/ab/X.png", "iiwiki")).toBeNull();
    expect(sisterMediaPath("/api/mediawiki/ixwiki/images/a/ab/X.png", "iiwiki")).toBeNull();
    expect(sisterMediaPath("/api/mediawiki/iiwiki/api.php", "iiwiki")).toBeNull();
    expect(sisterMediaPath("/api/mediawiki/iiwikix/images/a.png", "iiwiki")).toBeNull();
  });

  it("a dot segment that climbs out of the files is null, as a browser resolves it", () => {
    expect(sisterMediaPath("/api/mediawiki/iiwiki/images/../api.php", "iiwiki")).toBeNull();
    expect(sisterMediaPath("/api/mediawiki/iiwiki/images/%2e%2e/api.php", "iiwiki")).toBeNull();
    expect(sisterMediaPath("/images/../../api.php", "iiwiki")).toBeNull();
    // a sibling proxy whose name is as long as the wiki's: still out of this wiki's files
    expect(sisterMediaPath("/api/mediawiki/iiwiki/../ixwiki/images/a.png", "iiwiki")).toBeNull();
  });

  it("a relative /images/, /thumb/ or /data/ path maps under the proxy's /images/ or /data/", () => {
    expect(sisterMediaPath("/images/a/ab/Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
    expect(sisterMediaPath("/thumb/a/ab/Flag.png/120px-Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/thumb/a/ab/Flag.png/120px-Flag.png"
    );
    expect(sisterMediaPath("/data/x.png", "althistory")).toBe(
      "/api/mediawiki/althistory/data/x.png"
    );
    expect(sisterMediaPath("/wiki/Special:FilePath/Map.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/wiki/Special:FilePath/Map.png"
    );
  });

  it("an absolute or protocol-relative URL on the wiki's origin (or www.) maps to its path under the proxy", () => {
    expect(sisterMediaPath("https://iiwiki.com/images/a/ab/Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
    expect(sisterMediaPath("http://www.iiwiki.com/images/a/ab/Flag.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
    expect(sisterMediaPath("//iiwiki.com/images/thumb/a/ab/F.png/9px-F.png", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/thumb/a/ab/F.png/9px-F.png"
    );
    expect(
      sisterMediaPath("https://althistory.fandom.com/wiki/Special:FilePath/Flag.svg", "althistory")
    ).toBe("/api/mediawiki/althistory/wiki/Special:FilePath/Flag.svg");
  });

  it("a proxied path keeps its query; an absolute file URL loses it", () => {
    expect(sisterMediaPath("/api/mediawiki/iiwiki/images/a/ab/F.png?v=2", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/F.png?v=2"
    );
    expect(sisterMediaPath("https://iiwiki.com/images/a/ab/F.png?v=2#x", "iiwiki")).toBe(
      "/api/mediawiki/iiwiki/images/a/ab/F.png"
    );
  });

  it("a page of the wiki's origin that is not a file is null", () => {
    expect(sisterMediaPath("https://iiwiki.com/wiki/Main_Page", "iiwiki")).toBeNull();
    expect(sisterMediaPath("https://iiwiki.com/api.php?action=query", "iiwiki")).toBeNull();
  });

  it("a Fandom CDN thumbnail becomes Special:FilePath of its file", () => {
    expect(
      sisterMediaPath(
        "https://static.wikia.nocookie.net/althistory/images/a/ab/Flag_of_X.png/revision/latest/scale-to-width-down/220?cb=2020",
        "althistory"
      )
    ).toBe("/api/mediawiki/althistory/wiki/Special:FilePath/Flag_of_X.png");
    expect(
      sisterMediaPath(
        "//static.wikia.nocookie.net/althistory/images/thumb/c/c4/Map%20one.png/300px-Map%20one.png",
        "althistory"
      )
    ).toBe("/api/mediawiki/althistory/wiki/Special:FilePath/Map%20one.png");
  });

  it("a Fandom CDN path of another wiki, or not of a file, is null", () => {
    const cdn = "https://static.wikia.nocookie.net";
    expect(sisterMediaPath(`${cdn}/otherwiki/images/a/ab/X.png`, "althistory")).toBeNull();
    expect(sisterMediaPath(`${cdn}/althistory/images/a/zz/X.png`, "althistory")).toBeNull();
    expect(sisterMediaPath(`${cdn}/althistory/images/a/bc/X.png`, "althistory")).toBeNull();
    expect(sisterMediaPath(`${cdn}/althistory/images/a/ab/..`, "althistory")).toBeNull();
    expect(sisterMediaPath(`${cdn}/althistory/images/a/ab/`, "althistory")).toBeNull();
    expect(sisterMediaPath(`${cdn}/althistory/other/a/ab/X.png`, "althistory")).toBeNull();
    // iiwiki has no upload CDN: the same file there is another host
    expect(sisterMediaPath(`${cdn}/iiwiki/images/a/ab/X.png`, "iiwiki")).toBeNull();
  });

  it("another host is null, however it is spelled", () => {
    for (const url of [
      "https://evil.test/images/a.png",
      "//evil.test/images/a.png",
      "https://iiwiki.com.evil.test/images/a.png",
      "https://iiwiki.com@evil.test/images/a.png",
      "https://evil.test\\@iiwiki.com/images/a.png",
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.png",
      "ftp://iiwiki.com/images/a.png",
      "http://[::1/images/a.png",
      "/\\evil.test/images/a.png",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "Flag.png",
      "",
    ]) {
      expect([url, sisterMediaPath(url, "iiwiki")]).toEqual([url, null]);
    }
  });

  it("under the production base path the proxy path carries it once", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    const proxied = "/projects/ixstates/api/mediawiki/iiwiki/images/a/ab/Flag.png";
    expect(sisterMediaPath("/images/a/ab/Flag.png", "iiwiki")).toBe(proxied);
    expect(sisterMediaPath("https://iiwiki.com/images/a/ab/Flag.png", "iiwiki")).toBe(proxied);
    expect(sisterMediaPath(proxied, "iiwiki")).toBe(proxied);
    // without the base path it is not the proxy any more
    expect(sisterMediaPath("/api/mediawiki/iiwiki/images/a/ab/Flag.png", "iiwiki")).toBeNull();
  });
});

describe("isSisterMediaPath", () => {
  it("is true only for a file path under the wiki's own proxy", () => {
    expect(isSisterMediaPath("/api/mediawiki/iiwiki/images/a/ab/Flag.png", "iiwiki")).toBe(true);
    expect(isSisterMediaPath("/images/a/ab/Flag.png", "iiwiki")).toBe(false);
    expect(isSisterMediaPath("https://iiwiki.com/images/a/ab/Flag.png", "iiwiki")).toBe(false);
    expect(isSisterMediaPath("/api/mediawiki/iiwiki/images/a/ab/Flag.png", "althistory")).toBe(
      false
    );
    expect(isSisterMediaPath("/api/mediawiki/iiwiki/api.php", "iiwiki")).toBe(false);
    expect(isSisterMediaPath("//api/mediawiki/iiwiki/images/a.png", "iiwiki")).toBe(false);
    // as long as the proxy base up to a file path: still not under it
    expect(isSisterMediaPath("https://evil.test/abc/images/a.png", "iiwiki")).toBe(false);
  });
});
