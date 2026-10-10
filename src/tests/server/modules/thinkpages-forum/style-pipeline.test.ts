/** @jest-environment node */
import { stripPositioning } from "~/lib/thinkpages-forum/strip-positioning";
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";

// The fallback path of render.ts: sanitize the parsed HTML, then strip positioning. The sanitizer keeps `style`,
// so whatever it lets through must not reach the stored post with an overlay in it.
const pipeline = (html: string): string => stripPositioning(sanitizeWikiArticleHtml(html));

describe("sanitize then strip", () => {
  it.each([
    ["U+2003", " "],
    ["U+2028", " "],
    ["U+FEFF", "﻿"],
    ["U+3000", "　"],
    ["U+00A0", " "],
  ])("leaves no overlay style behind a bad url that starts with %s", (_name, space) => {
    const html = `<div style="a:url(${space}&quot;y);position:absolute;inset:0;z-index:9999;b:&quot;)">x</div>`;
    const out = pipeline(html);

    expect(out).toContain("x");
    expect(out).not.toMatch(/position|inset|z-index/i);
  });

  it("keeps a normal infobox style", () => {
    const out = pipeline(
      '<table class="infobox" style="width:22em;background:#f8f9fa url(https://ixwiki.com/images/bg.png);float:right"><tr><td>x</td></tr></table>'
    );

    expect(out).toContain("width:22em");
    expect(out).toContain("float:right");
    expect(out).toContain("url(https://ixwiki.com/images/bg.png)");
  });
});
