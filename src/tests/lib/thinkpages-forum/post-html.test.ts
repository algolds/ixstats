/** @jest-environment node */
import {
  embedTitle,
  embedWidth,
  isPostId,
  linkQuoteSources,
  relatedWikiTitles,
} from "~/lib/thinkpages-forum/post-html";

describe("isPostId", () => {
  it.each(["cm1abc", "cnative13", "a_b-c", "x".repeat(64)])("accepts %s", (id) => {
    expect(isPostId(id)).toBe(true);
  });

  it.each(["", "x".repeat(65), 'a"b', "a b", "a<b", "../x", "a/b", null, undefined])(
    "refuses %p",
    (id) => {
      expect(isPostId(id)).toBe(false);
    }
  );
});

describe("embedTitle", () => {
  it("keeps an ordinary title, trimmed", () => {
    expect(embedTitle("  Juan Kerr ")).toBe("Juan Kerr");
    expect(embedTitle("File:JuanKerr.jpg")).toBe("File:JuanKerr.jpg");
  });

  it.each(['<script>', 'a"b', "a>b", "a\nb", "a\u0000b", "", "   ", "x".repeat(256), null])(
    "refuses %p",
    (title) => {
      expect(embedTitle(title)).toBeNull();
    }
  );
});

describe("embedWidth", () => {
  it("is absent without the attribute, and clamped to 1..1200 with it", () => {
    expect(embedWidth(null)).toEqual({ width: null });
    expect(embedWidth("300")).toEqual({ width: 300 });
    expect(embedWidth("0")).toEqual({ width: 1 });
    expect(embedWidth("5000")).toEqual({ width: 1200 });
  });

  it.each(["abc", "12px", "-4", "1.5", "", " 3", "9999999"])("refuses %p", (value) => {
    expect(embedWidth(value)).toBeNull();
  });
});

describe("linkQuoteSources", () => {
  const quote = (attrs: string, author = "Ann &amp; Co wrote:") =>
    `<blockquote ${attrs}><div class="forum-quote-author">${author}</div><div class="forum-quote-body">hi</div></blockquote>`;

  it("links the author line to the quoted post when data-post is a valid id", () => {
    expect(linkQuoteSources(quote('class="forum-quote" data-post="p9"'))).toContain(
      '<div class="forum-quote-author"><a class="forum-quote-source" href="/thinkpages/post/p9">Ann &amp; Co wrote:</a></div>'
    );
  });

  it("finds data-post before class, and one quote inside another", () => {
    const html = `<blockquote data-post="p1" class="forum-quote"><div class="forum-quote-author">A wrote:</div><div class="forum-quote-body">${quote('class="forum-quote" data-post="p2"', "B wrote:")}</div></blockquote>`;
    const out = linkQuoteSources(html);
    expect(out).toContain('href="/thinkpages/post/p1">A wrote:</a>');
    expect(out).toContain('href="/thinkpages/post/p2">B wrote:</a>');
  });

  it.each([
    ['class="forum-quote"'],
    ['class="forum-quote" data-post=""'],
    ['class="forum-quote" data-post="a&quot;onmouseover=x"'],
    ['class="forum-quote" data-post="../../admin"'],
    ['class="forum-quote" data-post="a b"'],
  ])("leaves a quote with %s as written", (attrs) => {
    const html = quote(attrs);
    expect(linkQuoteSources(html)).toBe(html);
  });

  it("leaves a quote without an author line as written", () => {
    const html = '<blockquote class="forum-quote" data-post="p1"><p>text</p></blockquote>';
    expect(linkQuoteSources(html)).toBe(html);
  });
});

describe("relatedWikiTitles", () => {
  const a = (href: string, cls = "") => `<a href="${href}"${cls ? ` class="${cls}"` : ""}>x</a>`;

  it("lists article titles from relative and absolute wiki links, once each, at most three", () => {
    const html = [
      a("/wiki/River_compacts"),
      a("https://ixwiki.com/wiki/Juan_Kerr", "forum-wikilink"),
      a("/wiki/River_compacts#History"),
      a("/wiki/Fiannria"),
      a("/wiki/Urcea"),
    ].join(" ");
    expect(relatedWikiTitles(html)).toEqual(["River compacts", "Juan Kerr", "Fiannria"]);
  });

  it("skips files, categories, other sites, edit links and malformed escapes", () => {
    const html = [
      a("/wiki/File:Flag.svg"),
      a("/wiki/Category:Places"),
      a("https://example.com/wiki/Elsewhere"),
      a("/w/index.php?title=Nope&action=edit"),
      a("/wiki/100%"),
      a("/wiki/Good_page"),
    ].join(" ");
    expect(relatedWikiTitles(html)).toEqual(["Good page"]);
  });

  it("decodes percent escapes and entities in the href", () => {
    expect(relatedWikiTitles(a("/wiki/Caf%C3%A9_Royal"))).toEqual(["Café Royal"]);
    expect(relatedWikiTitles(a("/wiki/A&amp;B"))).toEqual(["A&B"]);
  });

  it("is empty when nothing links to the wiki", () => {
    expect(relatedWikiTitles("<p>plain</p>")).toEqual([]);
  });
});
