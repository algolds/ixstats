/** @jest-environment node */
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";

describe("sanitizeUserContent keeps the forum import's wiki and quote attributes", () => {
  it("keeps class, data-post, data-wiki-embed, data-wiki-title and data-width", () => {
    const html =
      '<blockquote class="forum-quote" data-post="abc123"><div>q</div></blockquote>' +
      '<div class="forum-wiki-embed" data-wiki-embed="image" data-wiki-title="File:X.jpg" data-width="300"><a href="https://ixwiki.com/wiki/File:X.jpg">File:X.jpg</a></div>' +
      '<a href="https://ixwiki.com/wiki/Y" class="forum-wikilink" data-wiki-title="Y">Y</a>';
    expect(sanitizeUserContent(html)).toBe(html);
  });

  it("neutralises a data-wiki-title that tries to close the attribute and open a script", () => {
    const out = sanitizeUserContent(
      "<a href=\"https://ixwiki.com/wiki/X\" data-wiki-title='&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'>x</a>"
    );
    expect(out).not.toContain("<script");
    expect(out).toBe('<a href="https://ixwiki.com/wiki/X">x</a>');
  });

  it("keeps a quote character in data-wiki-title escaped inside the attribute", () => {
    const out = sanitizeUserContent('<a data-wiki-title="Say &quot;hi&quot; onmouseover=x">x</a>');
    expect(out).toBe('<a data-wiki-title="Say &quot;hi&quot; onmouseover=x">x</a>');
  });

  it("still drops event handlers and unlisted data attributes", () => {
    const out = sanitizeUserContent(
      '<div data-wiki-title="T" onclick="x()" data-other="1">t</div>'
    );
    expect(out).toBe('<div data-wiki-title="T">t</div>');
  });
});
