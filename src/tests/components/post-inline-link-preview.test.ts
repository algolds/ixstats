// Plan 415 step 2: the link detectors of a ThinkPages post are built from the configured public host (no literal),
// and keep matching what they matched: a MyLeague/MyClub page on that host, a subdomain of it or localhost, with or
// without the app's base path, and an IxWiki or IIWiki article.
// The previews it renders pull in the whole editor stack; only the detector is under test.
jest.mock("~/components/dashboard/sections/feed/InlineWikiArticlePreview", () => ({
  InlineWikiArticlePreview: () => null,
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({ ForumLinkPreview: () => null }));

import { getInlinePreviewLink } from "~/components/thinkpages/post/PostInlineLinkPreview";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const ORIGIN = mediaWikiOrigin();

describe("getInlinePreviewLink", () => {
  it.each([
    [`See ${ORIGIN}/projects/ixstates/myleague/league_1 now`, `${ORIGIN}/projects/ixstates/myleague/league_1`],
    [`${ORIGIN}/myclub/club-9`, `${ORIGIN}/myclub/club-9`],
    ["http://localhost:3000/myleague/abc", "http://localhost:3000/myleague/abc"],
    ["/projects/ixstates/myclub/xyz", "/projects/ixstates/myclub/xyz"],
    [`https://staging.${new URL(ORIGIN).host}/myleague/zzz`, `https://staging.${new URL(ORIGIN).host}/myleague/zzz`],
  ])("finds the MyLeague or MyClub link in %p", (content, link) => {
    expect(getInlinePreviewLink(content)).toBe(link);
  });

  it.each([
    [`read ${ORIGIN}/wiki/Aurelian_Empire today`, `${ORIGIN}/wiki/Aurelian_Empire`],
    [`https://www.${new URL(ORIGIN).host}/wiki/Aurelia#History`, `https://www.${new URL(ORIGIN).host}/wiki/Aurelia`],
    ["https://iiwiki.com/wiki/Gallambria", "https://iiwiki.com/wiki/Gallambria"],
  ])("finds the wiki article link in %p", (content, link) => {
    expect(getInlinePreviewLink(content)).toBe(link);
  });

  it("finds a forum thread, and nothing in text without a link", () => {
    expect(getInlinePreviewLink("https://forum.ixwiki.com/threads/topic.123/")).toBe("https://forum.ixwiki.com/threads/topic.123");
    expect(getInlinePreviewLink("no links here, just myleague talk")).toBeNull();
    expect(getInlinePreviewLink(null)).toBeNull();
  });

  it("does not take another host's wiki page for IxWiki's", () => {
    expect(getInlinePreviewLink("https://example.org/wiki/Aurelia")).toBeNull();
    expect(getInlinePreviewLink(`https://notixwiki.test/wiki/Aurelia`)).toBeNull();
  });
});
