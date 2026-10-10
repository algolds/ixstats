/** @jest-environment node */
import { MAX_BBCODE_LENGTH, transformBBCode } from "~/lib/thinkpages-forum/import/bbcode";
import { importedPostBody } from "~/lib/thinkpages-forum/import/post-html";

/** The importer's options (post-html.ts). */
const imported = (bbcode: string) =>
  transformBBCode(bbcode, { forumLinks: "keep", mentions: "text", actionTokens: "keep" })
    .contentHtml;
const stored = (message: string) =>
  importedPostBody({ message, attachments: [], attachmentFor: () => null });

// Message strings copied from the real export (xf-20261009/posts.jsonl), posts 1, 2, 13, 14 and 16.
const WIKILINK = "[wikilink]Juan Kerr[/wikilink]";
const WIKISUMMARY = "[wikisummary]Juan Kerr[/wikisummary]";
const WIKIINFOBOX = "[wikiinfobox]Quicksilver Industries[/wikiinfobox]";
const ESCAPED_IMAGE = "\\[wikiimage=300]File:JuanKerr.jpg[/wikiimage]";
const QUOTES =
  '[QUOTE="admin, post: 15, member: 1"]\n[wikilink]Urcea[/wikilink]\n[/QUOTE]\n[QUOTE="admin, post: 13, member: 1"]\n[wikiinfobox]Quicksilver Industries[/wikiinfobox]\n[/QUOTE]';

describe("wiki BBCode", () => {
  it("[wikilink] becomes a link to the wiki page", () => {
    expect(imported(WIKILINK)).toBe(
      '<a href="https://ixwiki.com/wiki/Juan_Kerr" class="forum-wikilink" data-wiki-title="Juan Kerr">Juan Kerr</a>'
    );
  });

  it("[wikisummary] and [wikiinfobox] become embed placeholders with a plain link inside", () => {
    expect(imported(WIKISUMMARY)).toBe(
      '<div class="forum-wiki-embed" data-wiki-embed="summary" data-wiki-title="Juan Kerr"><a href="https://ixwiki.com/wiki/Juan_Kerr">Juan Kerr</a></div>'
    );
    expect(imported(WIKIINFOBOX)).toBe(
      '<div class="forum-wiki-embed" data-wiki-embed="infobox" data-wiki-title="Quicksilver Industries"><a href="https://ixwiki.com/wiki/Quicksilver_Industries">Quicksilver Industries</a></div>'
    );
  });

  it("[wikiimage=W] keeps its width", () => {
    expect(imported("[wikiimage=300]File:JuanKerr.jpg[/wikiimage]")).toBe(
      '<div class="forum-wiki-embed" data-wiki-embed="image" data-wiki-title="File:JuanKerr.jpg" data-width="300"><a href="https://ixwiki.com/wiki/File:JuanKerr.jpg">File:JuanKerr.jpg</a></div>'
    );
  });

  it("clamps the image width to 1..1200 and omits it when it is not digits or absent", () => {
    expect(imported("[wikiimage=5000]File:A.jpg[/wikiimage]")).toContain('data-width="1200"');
    expect(imported("[wikiimage=0]File:A.jpg[/wikiimage]")).toContain('data-width="1"');
    for (const opener of ["[wikiimage=abc]", "[wikiimage=12px]", "[wikiimage=-5]", "[wikiimage]"]) {
      const out = imported(`${opener}File:A.jpg[/wikiimage]`);
      expect(out).toContain('data-wiki-embed="image"');
      expect(out).not.toContain("data-width");
    }
  });

  it("matches the tags case-insensitively", () => {
    expect(imported("[WIKILINK]Juan Kerr[/WikiLink]")).toContain('data-wiki-title="Juan Kerr"');
  });

  it("encodes each path segment of the href and escapes every attribute value", () => {
    const out = imported("[wikilink]Queen's Gambit (A & B)/Notes?[/wikilink]");
    expect(out).toContain('href="https://ixwiki.com/wiki/Queen&#039;s_Gambit_(A_%26_B)/Notes%3F"');
    expect(out).toContain('data-wiki-title="Queen&#039;s Gambit (A &amp; B)/Notes?"');
    expect(out).toContain(">Queen&#039;s Gambit (A &amp; B)/Notes?</a>");
  });

  it("never builds an href from a URL the author wrote", () => {
    const out = imported("[wikilink]https://evil.example/x[/wikilink]");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href");
    expect(imported("[wikilink]mailto:a@b.c[/wikilink]")).toContain(
      'href="https://ixwiki.com/wiki/mailto:a%40b.c"'
    );
  });

  it.each([
    ["markup characters", '[wikilink]"><script>alert(1)</script>[/wikilink]'],
    ["a quote", '[wikilink]Say "hi"[/wikilink]'],
    ["an angle bracket", "[wikilink]a<b[/wikilink]"],
    ["a newline", "[wikilink]one\ntwo[/wikilink]"],
    ["a square bracket", "[wikilink]a[b[/wikilink]"],
    ["a pipe or brace", "[wikilink]a|b{c}[/wikilink]"],
    ["a fragment", "[wikilink]Page#Section[/wikilink]"],
    ["a dot segment", "[wikilink]../../admin[/wikilink]"],
    ["an empty segment", "[wikilink]a//b[/wikilink]"],
    ["nothing", "[wikilink]   [/wikilink]"],
    ["nested BBCode", "[wikilink][b]Juan[/b][/wikilink]"],
    ["a title past 255 characters", `[wikilink]${"x".repeat(256)}[/wikilink]`],
  ])("leaves a title with %s as literal text", (_name, message) => {
    const out = imported(message);
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("forum-wiki");
    expect(out).not.toContain("<script");
    expect(out).toContain("&#91;wiki");
  });

  it("applies the same rules to the embed tags", () => {
    for (const tag of ["wikisummary", "wikiinfobox", "wikiimage=300"]) {
      const out = imported(`[${tag}]"><img src=x onerror=1>[/${tag.split("=")[0]}]`);
      expect(out).not.toContain("forum-wiki-embed");
      expect(out).not.toContain("<img");
    }
  });

  it("leaves an escaped tag as the literal text the author wrote", () => {
    const out = stored(ESCAPED_IMAGE);
    expect(out.contentHtml).not.toContain("forum-wiki-embed");
    expect(out.plainText).toBe("\\[wikiimage=300]File:JuanKerr.jpg[/wikiimage]");
    expect(stored("\\[wikilink]Juan[/wikilink]").plainText).toBe("\\[wikilink]Juan[/wikilink]");
    expect(stored("\\[wikilink]alone").plainText).toBe("\\[wikilink]alone");
  });

  it("survives the import's sanitizer with its class and data attributes", () => {
    expect(stored(WIKILINK).contentHtml).toBe(
      '<a href="https://ixwiki.com/wiki/Juan_Kerr" class="forum-wikilink" data-wiki-title="Juan Kerr">Juan Kerr</a>'
    );
    expect(stored("[wikiimage=300]File:JuanKerr.jpg[/wikiimage]").contentHtml).toBe(
      '<div class="forum-wiki-embed" data-wiki-embed="image" data-wiki-title="File:JuanKerr.jpg" data-width="300"><a href="https://ixwiki.com/wiki/File:JuanKerr.jpg">File:JuanKerr.jpg</a></div>'
    );
  });
});

describe("quote post ids", () => {
  it("keeps the quoted XenForo post id on the blockquote", () => {
    expect(imported('[QUOTE="admin, post: 12, member: 1"]hi[/QUOTE]')).toBe(
      '<blockquote class="forum-quote" data-post="12"><div class="forum-quote-author">admin wrote:</div><div class="forum-quote-body">hi</div></blockquote>'
    );
  });

  it("reads the id wherever the option puts it, and only as digits", () => {
    expect(imported('[QUOTE="a, member: 1, post: 5"]x[/QUOTE]')).toContain('data-post="5"');
    for (const option of ["admin", "admin, post: 12abc, member: 1", 'a, post: "><b>']) {
      expect(imported(`[QUOTE="${option}"]x[/QUOTE]`)).not.toContain("data-post");
    }
    expect(imported("[quote]x[/quote]")).not.toContain("data-post");
  });

  it("keeps both ids of the real export's double quote and renders the wiki tags inside", () => {
    const out = stored(QUOTES).contentHtml;
    expect(out).toContain('<blockquote class="forum-quote" data-post="15">');
    expect(out).toContain('<blockquote class="forum-quote" data-post="13">');
    expect(out).toContain('class="forum-wikilink" data-wiki-title="Urcea"');
    expect(out).toContain('data-wiki-embed="infobox"');
  });
});

describe("wiki BBCode on hostile input", () => {
  const fill = (piece: string, tail = "") =>
    piece.repeat(Math.floor((MAX_BBCODE_LENGTH - tail.length) / piece.length)) + tail;
  const bodies: Array<[string, string]> = [
    ["[wikilink] openers", fill("[wikilink]")],
    ["escaped [wikilink] openers", fill("\\[wikilink]")],
    ["escaped openers with text", fill("\\[wikiimage=3]text ", "[/wikiimage]")],
    ["[wikiimage= openers with no ]", fill("[wikiimage=")],
    ["[wikilink] openers before one pair", fill("[wikilink]x", "[/wikilink]")],
    ["valid pairs", fill("[wikilink]Page[/wikilink]")],
  ];

  it.each(bodies)("handles a capped body of %s in well under 150 ms", (_, bbcode) => {
    expect(bbcode.length).toBeLessThanOrEqual(MAX_BBCODE_LENGTH);
    const started = performance.now();
    transformBBCode(bbcode);
    expect(performance.now() - started).toBeLessThan(150);
  });
});
