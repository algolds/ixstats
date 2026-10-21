/** @jest-environment node */
// Directives are attached by their `dir-<intentId>` token, and Canvas posts go through the MediaWiki render: the token must
// reach the card splitter as plain text whichever renderer ran.
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  renderArticleViaMediaWiki: jest.fn(),
}));
import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";
import { resetRenderLimitsForTests } from "~/server/modules/thinkpages-forum/render";
import { assertTokensArePlainText } from "~/server/modules/thinkpages-forum/writes-body";

const render = jest.mocked(renderArticleViaMediaWiki);
beforeEach(() => {
  render.mockReset();
  resetRenderLimitsForTests();
});

describe("a Canvas post's action tokens", () => {
  it("are refused when the render shows other ids than the text holds, even at the same count", () => {
    // <includeonly> and {{{x|default}}} make the source text and the rendered page differ.
    expect(() => assertTokensArePlainText("<p>[ixaction=theirs]</p>", "[ixaction=mine]")).toThrow(
      /plain text/
    );
    expect(() =>
      assertTokensArePlainText("<p>[ixaction=a] [ixaction=b]</p>", "[ixaction=a] [ixaction=c]")
    ).toThrow(/plain text/);
    expect(() =>
      assertTokensArePlainText("<p>[ixaction=a] [ixaction=b]</p>", "[ixaction=a] [ixaction=b]")
    ).not.toThrow();
  });

  it("accept the same ids in another order, as when MediaWiki moves a ref to the end of the page", () => {
    expect(() =>
      assertTokensArePlainText(
        "<p>[ixaction=b]</p><p>[ixaction=a]</p>",
        "[ixaction=a] [ixaction=b]"
      )
    ).not.toThrow();
  });
});
