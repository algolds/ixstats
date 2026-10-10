/** @jest-environment node */
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: jest.fn(),
}));
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { buildViewBundle } from "~/lib/wiki-os/services/view-bundle";
import { ForumError } from "~/server/modules/thinkpages-forum/errors";
import {
  composePostHtml,
  FORUM_RENDERER_VERSION,
  renderPostWikitext,
  resetRenderLimitsForTests,
} from "~/server/modules/thinkpages-forum/render";

const render = jest.mocked(renderArticleViaMediaWiki);
const MW_HTML =
  '<div class="mw-parser-output"><p>Hello <a href="/wiki/Urcea" title="Urcea">Urcea</a></p><h2><span class="mw-headline" id="Reaction">Reaction</span></h2><p>More</p><script>alert(1)</script></div>';
const meta = {
  links: [],
  templates: [{ ns: 10, title: "Template:Flag" }],
  images: [],
  categories: [],
  displayTitle: null,
  properties: {},
};

beforeEach(() => {
  render.mockReset();
  resetRenderLimitsForTests();
});

it("renders through MediaWiki exactly as articles do (same bundle), sanitized", async () => {
  render.mockResolvedValue({ html: MW_HTML, metadata: meta });
  const out = await renderPostWikitext("Hello [[Urcea]]", "t1", "u1");
  expect(render).toHaveBeenCalledWith("Hello [[Urcea]]", "ThinkPages:t1");
  expect(out.contentHtml).toBe(composePostHtml(buildViewBundle(MW_HTML)));
  expect(out.contentHtml).not.toContain("<script");
  expect(out.rendererVersion).toBe(FORUM_RENDERER_VERSION);
  expect(out.renderedAt).toBeInstanceOf(Date);
  expect(out.templates).toEqual(["Template:Flag"]);
  expect(out.plainText).toContain("Hello Urcea");
});

it("falls back in-process when MediaWiki is unavailable, marked stale", async () => {
  render.mockResolvedValue(null);
  const out = await renderPostWikitext("'''Bold''' text", "t1", "u1");
  expect(out.renderedAt).toBeNull();
  expect(out.contentHtml).toContain("Bold");
  expect(out.templates).toEqual([]);
});

it("refuses guarded input as a BAD_REQUEST without calling MediaWiki", async () => {
  await expect(renderPostWikitext("sig ~~~~", "t1", "u1")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(render).not.toHaveBeenCalled();
});

it("limits renders per user", async () => {
  render.mockResolvedValue({ html: MW_HTML, metadata: meta });
  for (let i = 0; i < 10; i++) await renderPostWikitext("x", "t1", "u1");
  await expect(renderPostWikitext("x", "t1", "u1")).rejects.toBeInstanceOf(ForumError);
  await expect(renderPostWikitext("x", "t1", "u2")).resolves.toBeDefined();
});

it("composes notices, a floated infobox and the body inside mw-parser-output", () => {
  const html = composePostHtml({
    bodyHtml: "<p>b</p>",
    infoboxHtml: "<table>i</table>",
    noticesHtml: "<div>n</div>",
    toc: [],
    rendererVersion: "x",
  } as never);
  expect(html.startsWith('<div class="mw-parser-output">')).toBe(true);
  expect(html.indexOf("n</div>")).toBeLessThan(html.indexOf("<table>"));
  expect(html.indexOf("<table>")).toBeLessThan(html.indexOf("<p>b</p>"));
});
