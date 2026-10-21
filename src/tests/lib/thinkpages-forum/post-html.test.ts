/** @jest-environment node */
import {
  embedFileTitle,
  embedTitle,
  embedWidth,
  isPostId,
  linkQuoteSources,
  quotedPostIds,
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
  it.each(["<script>", 'a"b', "a>b", "a\nb", "a\u0000b", "", "   ", "x".repeat(256), null])(
    "refuses %p",
    (title) => {
      expect(embedTitle(title)).toBeNull();
    }
  );
});

describe("embedFileTitle", () => {
  it.each([
    "Juan Kerr",
    "File:../../x?y",
    "File:../secret.png",
    "File:a/b.png",
    "File:a\\b.png",
    "File:a.png?x=1",
    "File:a.png#frag",
    "File:%2e%2e%2fx.png",
    "File:",
    null,
  ])("refuses %p", (title) => {
    expect(embedFileTitle(title)).toBeNull();
  });
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
  it("does not take other markup in the author line as part of the link text", () => {
    const html = quote('class="forum-quote" data-post="p9"', '<img src="x" onerror="y"> wrote:');
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
});

describe("quotedPostIds", () => {
  it("lists the posts a post quotes, once each, valid ids only", () => {
    const html =
      '<blockquote class="forum-quote" data-post="p1"><div>x</div></blockquote>' +
      '<blockquote data-post="p1"></blockquote>' +
      '<blockquote data-post="bad id!"></blockquote>' +
      '<blockquote data-post="p2"></blockquote>';
    expect(quotedPostIds(html)).toEqual(["p1", "p2"]);
  });

  it("stops at five and ignores a data-post that is not on a blockquote", () => {
    const many = Array.from({ length: 9 }, (_, i) => `<blockquote data-post="q${i}"></blockquote>`);
    expect(quotedPostIds(many.join(""))).toHaveLength(5);
    expect(quotedPostIds('<div data-post="p1"></div><a data-post="p2">x</a>')).toEqual([]);
  });
});
