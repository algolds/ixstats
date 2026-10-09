/** @jest-environment node */
import { JSDOM } from "jsdom";
import { countActionTokens, countTextActionTokens } from "~/lib/action-links";
import { MAX_BBCODE_LENGTH } from "~/lib/thinkpages-forum/import/bbcode";
import {
  importedPostBody,
  type AttachmentRender,
  type PostHtmlInput,
} from "~/lib/thinkpages-forum/import/post-html";
import type { XfAttachment } from "~/lib/thinkpages-forum/import/xenforo-types";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";

const file = (
  attachment_id: number,
  filename: string,
  content_type = "image/png"
): XfAttachment => ({
  attachment_id,
  filename,
  file_size: 100,
  content_type,
});

const RENDERS: Record<number, AttachmentRender | "omitted" | null> = {
  55: { kind: "image", url: "/images/uploads/forum/55-abc-map.png", filename: "map.png" },
  56: { kind: "link", url: "/images/uploads/forum/56-def-rules.pdf", filename: "rules.pdf" },
  57: "omitted",
  58: null,
};

const body = (message: string, attachments: XfAttachment[] = [], renders = RENDERS) =>
  importedPostBody({
    message,
    attachments,
    attachmentFor: (id) => renders[id] ?? null,
  } satisfies PostHtmlInput);

/** Every attribute of every element of a stored body. */
function attributesOf(contentHtml: string): Array<[string, string]> {
  const doc = new JSDOM(contentHtml).window.document;
  return [...doc.body.querySelectorAll("*")].flatMap((el) =>
    el.getAttributeNames().map((name): [string, string] => [name, el.getAttribute(name) ?? ""])
  );
}

function expectInert(contentHtml: string): void {
  const doc = new JSDOM(contentHtml).window.document;
  expect(doc.querySelectorAll("script, iframe, style, object, embed")).toHaveLength(0);
  const attributes = attributesOf(contentHtml);
  expect(attributes.filter(([name]) => name.startsWith("on") || name === "style")).toEqual([]);
  // A script URL may survive as visible text, never in an attribute.
  expect(attributes.filter(([, value]) => /javascript:|vbscript:|^\s*data:/i.test(value))).toEqual(
    []
  );
}

describe("importedPostBody: stored XSS (Review Focus 1)", () => {
  const PAYLOADS = [
    "<script>alert(1)</script> text",
    "[url=javascript:alert(1)]x[/url]",
    "[url]javascript:alert(1)[/url]",
    "[img]data:text/html,<script>alert(1)</script>[/img]",
    '[img]x" onerror="alert(1)[/img]',
    '[img]https://x.test/a.png" onerror="alert(1)[/img]',
    "[color=red;background:url(x)]c[/color]",
    '[quote="<img src=x onerror=1>"]q[/quote]',
    "[url=https://x.test/[ixaction=a]]y[/url]",
    "[url]https://x.test/[ixaction=a][/url]",
    "[url]java[ixaction=a]script:alert(1)[/url]",
    "[url]https://x.test/&#91;ixaction=a&#93;[/url]",
    "[url=https://x.test/&#91;ixaction=a&#93;]y[/url]",
    "[spoiler=<img src=x onerror=alert(1)>]s[/spoiler]",
    '[media=youtube]"><script>alert(1)</script>[/media]',
  ];

  it.each(PAYLOADS)("stores an inert body for %s", (message) => {
    const { contentHtml } = body(message);
    expectInert(contentHtml);
  });

  it.each(PAYLOADS)(
    "stores HTML the sanitizer leaves unchanged, with the token invariant: %s",
    (message) => {
      const { contentHtml } = body(message);
      expect(sanitizeUserContent(contentHtml)).toBe(contentHtml);
      expect(countTextActionTokens(contentHtml)).toBe(countActionTokens(contentHtml));
    }
  );

  it("keeps escaped HTML as visible text", () => {
    expect(body("<script>alert(1)</script>").plainText).toBe("<script>alert(1)</script>");
  });

  it("refuses an inline attachment url that is not http(s) or site-relative", () => {
    const { contentHtml } = body("[attach]55[/attach]", [file(55, "map.png")], {
      55: { kind: "image", url: "javascript:alert(1)", filename: 'a" onerror="x.png' },
    });
    expectInert(contentHtml);
  });
});

describe("importedPostBody: generated attributes never break their quoting", () => {
  it("keeps the text around a link whose URL holds a token or a bracketed option", () => {
    const result = body("before [url=https://x.test/[ixaction=a]]y[/url] after [b]kept[/b]");
    expect(result.plainText).toBe("before ]y after kept");
    expect(result.contentHtml).toContain(
      '<a href="https://x.test/%5Bixaction=a" class="forum-link">]y</a>'
    );
    expect(body("[url=https://a.test/[z=1]]A[/url] tail").plainText).toBe("]A tail");
  });

  it("stores no class but the transformer's own for the overlay payload", () => {
    const { contentHtml } = body(
      "[url=https://a.test/[z=1]]A[/url] [url=x><a href=https://evil.test class=fixed&#32;inset-0&#32;z-50>overlay</a>]B[/url]" +
        " [url=https://a.test/[z=1]]C[/url] [url=x><a class=x&#32;y data-wikiembed=1 data-imageurl=https://evil.test/i.png>o</a>]D[/url]"
    );
    expectInert(contentHtml);
    const attributes = attributesOf(contentHtml);
    expect(
      attributes.filter(([name, value]) => name === "class" && !/^forum-[a-z-]+$/.test(value))
    ).toEqual([]);
    expect(attributes.filter(([name]) => name.startsWith("data-"))).toEqual([]);
    expect(new JSDOM(contentHtml).window.document.querySelectorAll("a")).toHaveLength(4);
  });
});

describe("importedPostBody: action tokens (Review Focus 6)", () => {
  it("keeps tokens in text and cuts them out of markup, counting both", () => {
    const result = body(
      "see [ixaction=act1] and [url=https://x.test/]y[/url] [img]https://x.test/[ixaction=act2].png[/img]"
    );
    expect(result.contentHtml).toContain("[ixaction=act1]");
    expect(result.contentHtml).not.toContain("[ixaction=act2]");
    expect(result.tokens).toEqual({ kept: 1, stripped: 1, overLimit: 0 });
    expect(countTextActionTokens(result.contentHtml)).toBe(countActionTokens(result.contentHtml));
    expect(countActionTokens(result.plainText)).toBe(1);
  });

  it("re-strips a token the sanitizer decoded into an attribute", () => {
    const result = body("[url]https://x.test/&#91;ixaction=a&#93;[/url]");
    expect(countTextActionTokens(result.contentHtml)).toBe(countActionTokens(result.contentHtml));
    expect(result.tokens.kept).toBe(0);
  });

  it("counts distinct token ids beyond the per-post limit", () => {
    const message = Array.from({ length: 12 }, (_, i) => `[ixaction=a${i}]`).join(" ");
    expect(body(message).tokens).toEqual({ kept: 12, stripped: 0, overLimit: 2 });
  });
});

describe("importedPostBody: degrading what the sanitizer would drop", () => {
  it("turns a spoiler into a labelled quote", () => {
    const result = body("[spoiler=Ending]He lives.[/spoiler][spoiler]x[/spoiler]");
    expect(result.contentHtml).toBe(
      "<blockquote><p><strong>Spoiler: Ending</strong></p><div>He lives.</div></blockquote>" +
        "<blockquote><p><strong>Spoiler</strong></p><div>x</div></blockquote>"
    );
    expect(result.features.spoiler).toBe(true);
  });

  it("turns a YouTube embed into a link", () => {
    const result = body("[media=youtube]dQw4w9WgXcQ[/media]");
    expect(result.contentHtml).toBe(
      '<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">YouTube video</a></p>'
    );
    expect(result.features.youtube).toBe(true);
  });

  it("turns table rows into paragraphs of cells joined by |", () => {
    const result = body(
      "[table]\n[tr][th]Nation[/th][th]GDP[/th][/tr]\n[tr][td]Urcea[/td][td]1[/td][/tr]\n[/table]"
    );
    expect(result.contentHtml).toBe("<p>Nation | GDP</p><p>Urcea | 1</p>");
    expect(result.features.table).toBe(true);
  });

  it("drops rules, keeps strikethrough as <s> and drops colour styles", () => {
    const result = body("a[hr]b [s]old[/s] [color=red]red[/color]");
    expect(result.contentHtml).toBe("ab <s>old</s> <span>red</span>");
    expect(result.features).toMatchObject({ hr: true, color: true });
  });

  it("breaks template openers and closers in text so the sanitizer keeps the text", () => {
    const result = body("[code]{{Infobox country}}[/code] and ${x} and <%= y %>");
    expect(result.plainText.replace(/\u200B/g, "")).toBe(
      "{{Infobox country}} and ${x} and <%= y %>"
    );
    expect(result.contentHtml).toContain("Infobox country");
    expect(result.features.templateSyntax).toBe(true);
    expect(body("plain").features.templateSyntax).toBe(false);
  });

  it("breaks template syntax in attachment notes and file names too", () => {
    const result = body(
      "",
      [file(57, "{{x}}.exe", "application/x-msdownload"), file(56, "${y}.pdf")],
      {
        57: "omitted",
        56: { kind: "link", url: "/images/uploads/forum/56.pdf", filename: "${y}.pdf" },
      }
    );
    expect(result.plainText.replace(/\u200B/g, "")).toBe(
      "Attachments [attachment omitted: {{x}}.exe] ${y}.pdf"
    );
    expect(result.features.templateSyntax).toBe(true);
  });

  it("counts template syntax in a URL, which the sanitizer blanks", () => {
    expect(body("[url=https://x.test/{{a}}]t[/url]").features.templateUrl).toBe(true);
    expect(body("[url=https://x.test/a]{{t}}[/url]").features.templateUrl).toBe(false);
  });

  it("counts http: images without rewriting them", () => {
    const result = body("[img]http://x.test/a.png[/img]");
    expect(result.contentHtml).toContain('src="http://x.test/a.png"');
    expect(result.features.httpImage).toBe(true);
  });

  it("keeps forum.ixwiki.com links absolute and mentions as text", () => {
    const result = body("[url=https://forum.ixwiki.com/threads/a.12/]t[/url] [USER=7]@Ann[/USER]");
    expect(result.contentHtml).toContain('href="https://forum.ixwiki.com/threads/a.12/"');
    expect(result.contentHtml).toContain("@Ann");
    expect(result.contentHtml).not.toContain("/forum/members/");
  });
});

describe("importedPostBody: attachments", () => {
  const all = [
    file(55, "map.png"),
    file(56, "rules.pdf", "application/pdf"),
    file(57, "x.exe", "application/x-msdownload"),
    file(58, "gone.png"),
  ];

  it("replaces inline placeholders by kind and appends the rest under Attachments", () => {
    const result = body('a [ATTACH type="full"]55[/ATTACH] b', all);
    expect(result.contentHtml).toBe(
      'a <p><img src="/images/uploads/forum/55-abc-map.png" alt="map.png"></p> b' +
        "<p>Attachments</p>" +
        '<p><a href="/images/uploads/forum/56-def-rules.pdf">rules.pdf</a></p>' +
        "<p>[attachment omitted: x.exe]</p>"
    );
    expect(result.attachments).toEqual({ inline: 1, appended: 1, omitted: 1 });
  });

  it("removes a placeholder whose attachment renders as nothing, or is not this post's", () => {
    const result = body("a [attach]58[/attach][attach]99[/attach] b", [file(58, "gone.png")], {
      ...RENDERS,
      99: { kind: "image", url: "/images/uploads/forum/99-x.png", filename: "x.png" },
    });
    expect(result.contentHtml).toBe("a  b");
    expect(result.contentHtml).not.toContain("data-attachment-id");
    expect(result.attachments).toEqual({ inline: 0, appended: 0, omitted: 0 });
  });

  it("adds no Attachments header when nothing is appended", () => {
    expect(body("[attach]55[/attach]", [file(55, "map.png")]).contentHtml).not.toContain(
      "Attachments"
    );
  });

  it("keeps an image-only body with empty plain text", () => {
    const result = body("[attach]55[/attach]", [file(55, "map.png")]);
    expect(result.plainText).toBe("");
    expect(result.contentHtml).toContain("<img");
  });

  it("escapes file names and cuts tokens out of them", () => {
    const result = body("", [file(56, "x")], {
      56: {
        kind: "link",
        url: "/images/uploads/forum/56.pdf",
        filename: "<b>[ixaction=a1]</b>.pdf",
      },
    });
    expect(result.contentHtml).toContain("&lt;b&gt;&lt;/b&gt;.pdf");
    expect(countActionTokens(result.contentHtml)).toBe(0);
  });

  it("notes a body over the transformer's length cap, kept as escaped text", () => {
    const result = body(`[b]<i>x</i>[/b]${"y".repeat(MAX_BBCODE_LENGTH)}`);
    expect(result.features.tooLong).toBe(true);
    expect(result.contentHtml.startsWith("[b]&lt;i&gt;x&lt;/i&gt;[/b]yyy")).toBe(true);
    expect(body("[b]x[/b]").features.tooLong).toBe(false);
  });
});
