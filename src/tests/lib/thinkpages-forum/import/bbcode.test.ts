/** @jest-environment node */
import { transformBBCode } from "~/lib/thinkpages-forum/import/bbcode";

const html = (bbcode: string, options?: Parameters<typeof transformBBCode>[1]) =>
  transformBBCode(bbcode, options).contentHtml;

describe("transformBBCode (moved to the import lib)", () => {
  it("rewrites forum.ixwiki.com links to bridge routes by default, as before", () => {
    expect(html("[url=https://forum.ixwiki.com/threads/x.12/]t[/url]")).toBe(
      '<a href="/forum/thread/12" class="forum-link" rel="noopener">t</a>'
    );
    expect(html("[url]https://forum.ixwiki.com/forums/f.3/[/url]")).toContain('href="/forum/3"');
  });

  it("keeps forum.ixwiki.com links absolute with forumLinks: keep", () => {
    const out = html("[url=https://forum.ixwiki.com/threads/x.12/]t[/url]", { forumLinks: "keep" });
    expect(out).toContain('href="https://forum.ixwiki.com/threads/x.12/"');
  });

  it("links mentions to the bridge member page by default, as before", () => {
    expect(html("[user=7]Name[/user]")).toBe(
      '<a href="/forum/members/7" class="forum-mention">@Name</a>'
    );
  });

  it("renders mentions as plain @name text with mentions: text (XenForo's stored @ is not doubled)", () => {
    expect(html("hi [user=7]Name[/user]", { mentions: "text" })).toBe("hi @Name");
    expect(html("[USER=7]@Name[/USER]", { mentions: "text" })).toBe("@Name");
  });

  it("strips [ixaction] tokens by default and keeps them with actionTokens: keep", () => {
    expect(html("a [ixaction=act1] b")).toBe("a  b");
    expect(html("a [ixaction=act1] b", { actionTokens: "keep" })).toBe("a [ixaction=act1] b");
  });

  it('keeps the attachment placeholder for [attach], [attach=full] and XenForo 2.2\'s [ATTACH type="full"]', () => {
    for (const code of [
      "[attach]55[/attach]",
      "[attach=full]55[/attach]",
      '[ATTACH type="full" alt="m"]55[/ATTACH]',
    ]) {
      const result = transformBBCode(code);
      expect(result.contentHtml).toBe(
        '<div class="forum-attachment" data-attachment-id="55"></div>'
      );
      expect(result.attachments).toEqual([{ id: 55, inline: true }]);
    }
  });

  it("reads XenForo 2.2 tag options: [URL unfurl], [IMG width], [CODE=lang]", () => {
    expect(html('[URL unfurl="true"]https://x.test/a[/URL]')).toBe(
      '<a href="https://x.test/a" class="forum-link" rel="noopener">https://x.test/a</a>'
    );
    expect(html('[IMG width="200px"]https://x.test/a.png[/IMG]')).toBe(
      '<img src="https://x.test/a.png" class="forum-img" loading="lazy" alt="" />'
    );
    expect(html("[CODE=php]echo 1;[/CODE]")).toBe(
      '<pre class="forum-code"><code>echo 1;</code></pre>'
    );
    expect(html("[url='https://x.test/q']q[/url]")).toContain('href="https://x.test/q"');
  });

  it("names a quote's author without XenForo's post and member suffix or a second escape", () => {
    const out = html('[QUOTE="Ann & Co, post: 12, member: 7"]hi[/QUOTE]');
    expect(out).toContain('<div class="forum-quote-author">Ann &amp; Co wrote:</div>');
    expect(html('[quote="<img src=x onerror=1>"]x[/quote]')).toContain(
      "&lt;img src=x onerror=1&gt; wrote:"
    );
  });

  it("labels a titled spoiler with its unquoted title", () => {
    expect(html('[SPOILER="The end"]x[/SPOILER]')).toContain(
      '<summary class="forum-spoiler-toggle">The end</summary>'
    );
  });

  it("fully escapes generated URLs and percent-encodes brackets, so no later step reaches inside an attribute", () => {
    expect(html("[url=https://a.test/?x=1&y=<2>]t[/url]")).toBe(
      '<a href="https://a.test/?x=1&amp;y=&lt;2&gt;" class="forum-link" rel="noopener">t</a>'
    );
    const tail = html("[url=https://a.test/[z=1]]A[/url] tail");
    expect(tail).toBe(
      '<a href="https://a.test/%5Bz=1" class="forum-link" rel="noopener">]A</a> tail'
    );
    const quoted = html("[url]https://a/[quote]q[/quote][/url]");
    expect(quoted.match(/<a /g)).toHaveLength(1);
    expect(quoted).toContain('href="https://a/%5Bquote%5Dq%5B/quote%5D"');
    // [b] runs before [img]: its markup lands in the URL fully escaped
    expect(html("[img]https://a.test/[b]x[/b].png[/img]")).toContain(
      'src="https://a.test/&lt;strong&gt;x&lt;/strong&gt;.png"'
    );
    expect(html("[img]https://a.test/[x].png[/img]")).toContain('src="https://a.test/%5Bx%5D.png"');
  });

  it("strips unknown tags in text only", () => {
    expect(html("[url]https://a.test/[x][/url] [x]y")).toBe(
      '<a href="https://a.test/%5Bx%5D" class="forum-link" rel="noopener">https://a.test/</a> y'
    );
  });

  it("escapes raw HTML in text", () => {
    expect(html("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
