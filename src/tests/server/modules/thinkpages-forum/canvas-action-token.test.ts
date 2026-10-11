/** @jest-environment node */
// Directives are attached by their `dir-<intentId>` token, and Canvas posts go through the MediaWiki render: the token must
// reach the card splitter as plain text whichever renderer ran.
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: jest.fn(),
}));
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import {
  directiveActivityId,
  parseActionTokens,
  parseTextActionTokens,
  splitActionTokens,
} from "~/lib/action-links";
import {
  renderPostWikitext,
  resetRenderLimitsForTests,
} from "~/server/modules/thinkpages-forum/render";
import { assertTokensArePlainText } from "~/server/modules/thinkpages-forum/writes-body";

const render = jest.mocked(renderArticleViaMediaWiki);
const DIRECTIVE = directiveActivityId("cm9x2k4f10000abcd1234efgh");
const WIKITEXT = `We acted.\n\n[ixaction=${DIRECTIVE}]\n\n* and [ixaction=a2]`;
const META = {
  links: [],
  templates: [],
  images: [],
  categories: [],
  displayTitle: null,
  properties: {},
};
const MW_HTML = `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><p>We acted.</p>\n<p>[ixaction=${DIRECTIVE}]</p>\n<ul><li>and [ixaction=a2]</li></ul></div>`;

beforeEach(() => {
  render.mockReset();
  resetRenderLimitsForTests();
});

describe("a Canvas post's action tokens", () => {
  it("survive the MediaWiki render as plain text and split into cards", async () => {
    render.mockResolvedValue({ html: MW_HTML, metadata: META });
    const out = await renderPostWikitext(WIKITEXT, "t1", "u1");
    expect(() => assertTokensArePlainText(out.contentHtml, out.plainText)).not.toThrow();
    expect(parseActionTokens(out.plainText)).toEqual([DIRECTIVE, "a2"]);
    expect(parseTextActionTokens(out.contentHtml)).toEqual([DIRECTIVE, "a2"]);
    const cards = splitActionTokens(out.contentHtml).filter((s) => s.kind === "action");
    expect(cards).toEqual([
      { kind: "action", id: DIRECTIVE },
      { kind: "action", id: "a2" },
    ]);
  });

  it("survive the in-process render used while the wiki is down", async () => {
    render.mockResolvedValue(null as never);
    const out = await renderPostWikitext(WIKITEXT, "t1", "u1");
    expect(out.renderedAt).toBeNull();
    expect(() => assertTokensArePlainText(out.contentHtml, out.plainText)).not.toThrow();
    expect(parseTextActionTokens(out.contentHtml)).toEqual([DIRECTIVE, "a2"]);
    expect(parseActionTokens(out.plainText)).toEqual([DIRECTIVE, "a2"]);
  });

  it("are refused when the render shows other ids than the text holds, even at the same count", () => {
    // <includeonly> and {{{x|default}}} make the source text and the rendered page differ.
    expect(() => assertTokensArePlainText("<p>[ixaction=theirs]</p>", "[ixaction=mine]")).toThrow(
      /plain text/
    );
    expect(() =>
      assertTokensArePlainText("<p>[ixaction=a] [ixaction=b]</p>", "[ixaction=b] [ixaction=a]")
    ).toThrow(/plain text/);
    expect(() =>
      assertTokensArePlainText("<p>[ixaction=a] [ixaction=b]</p>", "[ixaction=a] [ixaction=b]")
    ).not.toThrow();
  });
});
