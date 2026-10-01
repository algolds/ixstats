/** @jest-environment node */
/**
 * A Wikimedia Commons picture is proxied by file name (`/api/mediawiki/commons/Special:Filepath/<name>`,
 * which the proxy resolves through imageinfo). MediaWiki's imageinfo links end in tracking parameters
 * (`?utm_source=...`), and the query used to be encoded into the name, so Economy of Urcea's lead image
 * (and 12 other stored articles') loaded from `...Tugrik_symbol.svg%3Futm_source%3D...` and 404'd.
 */
import {
  extractLeadImage,
  getCommonsProxyUrl,
  normalizeWikiImageUrl,
} from "~/lib/wiki-os/transformers/image-url";

/** The exact `src` stored in Economy of Urcea's rendered HTML (the `&amp;` is the HTML's own). */
const STORED =
  "https://upload.wikimedia.org/wikipedia/commons/7/7f/Tugrik_symbol.svg?utm_source=commons.wikimedia.org&amp;utm_campaign=imageinfo&amp;utm_content=original";

describe("getCommonsProxyUrl", () => {
  it("names the file and drops the tracking query (the stored value of Economy of Urcea's lead image)", () => {
    expect(getCommonsProxyUrl(STORED)).toBe(
      "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg"
    );
    expect(normalizeWikiImageUrl(STORED)).toBe(
      "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg"
    );
  });

  it("puts nothing of the query, or of a fragment, in the name", () => {
    const proxied = getCommonsProxyUrl(`${STORED}#filelinks`);
    expect(proxied).toBe("/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg");
    expect(proxied).not.toMatch(/%3F|%23|%26|utm_/i);
  });

  it("keeps a percent-encoded name once-encoded, query or not (the notice icon of the page-top ambox)", () => {
    const name = "Bild_1c_%E2%80%93_Baustelle%2C_StVO_1953.svg";
    const expected = `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent("Bild_1c_–_Baustelle,_StVO_1953.svg")}`;

    expect(
      getCommonsProxyUrl(
        `https://upload.wikimedia.org/wikipedia/commons/b/b9/${name}?utm_source=commons.wikimedia.org&amp;utm_campaign=imageinfo`
      )
    ).toBe(expected);
    expect(getCommonsProxyUrl(`https://upload.wikimedia.org/wikipedia/commons/b/b9/${name}`)).toBe(
      expected
    );
  });

  it("turns a rasterised thumbnail back into the vector file, with or without a query", () => {
    const thumb =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Tugrik_symbol.svg/200px-Tugrik_symbol.svg.png";
    expect(getCommonsProxyUrl(thumb)).toBe(
      "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg"
    );
    expect(getCommonsProxyUrl(`${thumb}?utm_source=x`)).toBe(
      "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg"
    );
  });

  it("encodes the name of a Special:Filepath link once, not twice, and drops its query", () => {
    expect(
      getCommonsProxyUrl(
        "https://commons.wikimedia.org/wiki/Special:Filepath/%C3%89cole.svg?utm_source=x"
      )
    ).toBe(`/api/mediawiki/commons/Special:Filepath/${encodeURIComponent("École.svg")}`);
  });

  it("leaves an already proxied URL and a URL with no query as they were", () => {
    const proxied = "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg";
    expect(getCommonsProxyUrl(proxied)).toBe(proxied);
    expect(
      getCommonsProxyUrl("https://upload.wikimedia.org/wikipedia/commons/7/7f/Tugrik_symbol.svg")
    ).toBe(proxied);
  });
});

describe("the lead image of an article whose picture is a Commons file with a tracking query", () => {
  it("loads from the file's name", () => {
    const infobox = `<table class="infobox"><tr><td><span typeof="mw:File"><a href="/wiki/File:Tugrik_symbol.svg"><img src="${STORED}" width="50" height="50"></a></span></td></tr></table>`;

    expect(extractLeadImage(infobox)?.url).toBe(
      "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg"
    );
  });
});
