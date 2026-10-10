/** @jest-environment node */
import { buildViewBundle } from "~/lib/wiki-os/services/view-bundle";
import { linkQuoteSources } from "~/lib/thinkpages-forum/post-html";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { composePostHtml } from "~/server/modules/thinkpages-forum/render";

// What MediaWiki returns for quoteWikitext(...) followed by a reply paragraph.
const MW_HTML =
  '<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">' +
  '<blockquote class="forum-quote" data-post="cnative12"><div class="forum-quote-author"><b>Heku</b> wrote:</div>' +
  '<div class="forum-quote-body">Hello there</div></blockquote>\n<p>My reply\n</p></div>';

describe("a Canvas quote through the post render", () => {
  it("keeps the quote's class, data-post and author line in the stored html", () => {
    const html = composePostHtml(buildViewBundle(MW_HTML));
    expect(html).toContain('class="forum-quote"');
    expect(html).toContain('data-post="cnative12"');
    expect(html).toContain("forum-quote-author");
  });

  it("is then linked to its source post by the thread page", () => {
    const html = linkQuoteSources(composePostHtml(buildViewBundle(MW_HTML)));
    expect(html).toContain('class="forum-quote-source"');
    expect(html).toContain("cnative12");
  });

  it("the in-process fallback render (MediaWiki down) keeps them too", () => {
    const wikitext = `<blockquote class="forum-quote" data-post="cnative12"><div class="forum-quote-author">'''Heku''' wrote:</div><div class="forum-quote-body">Hello there</div></blockquote>\n`;
    const html = sanitizeWikiArticleHtml(parseWikitextToHtml(wikitext));
    expect(html).toContain('class="forum-quote"');
    expect(html).toContain('data-post="cnative12"');
    expect(html).toContain("forum-quote-author");
  });
});
