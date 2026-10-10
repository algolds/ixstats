/** @jest-environment node */
import {
  linkMentionsInHtml,
  mentionAnchorNames,
  mentionNamesInHtml,
  unwrapMentionAnchors,
} from "~/server/modules/thinkpages-forum/mention-html";

const KNOWN = new Set(["kir", "aria_v", "bob"]);
const hrefOf = (name: string) => (KNOWN.has(name) ? `/id/${name}` : null);
const link = (name: string, text = `@${name}`) =>
  `<a class="forum-mention" href="/id/${name}">${text}</a>`;

describe("mentionNamesInHtml", () => {
  it("reads names from text, not from quotes, code, links, attributes, styles or scripts", () => {
    const html =
      "<p>Hi @Kir</p><blockquote>@quoted said</blockquote><code>@incode</code><pre>@inpre</pre>" +
      '<a href="/x">@inlink</a><img alt="@inalt" src="/a.png"><style>@instyle{}</style>' +
      "<script>@inscript</script>";
    expect(mentionNamesInHtml(html)).toEqual(["kir"]);
  });

  it("finds a name next to markup, and not an email address or a 25-character name", () => {
    expect(
      mentionNamesInHtml("<p><b>@aria_v</b>, mail kir@example.com or @" + "a".repeat(25) + "</p>")
    ).toEqual(["aria_v"]);
  });

  it("ignores a body nested past the parser ceiling, however the tags are spelled", () => {
    const deep = "<div>".repeat(500) + "@kir" + "</div>".repeat(500);
    expect(mentionNamesInHtml(deep)).toEqual([]);
    // Few tags, but the parser keeps the formatting elements open: it nests far deeper than the tags say.
    const adopted = "<i><b>".repeat(300) + "</i>".repeat(300) + "@kir";
    expect(mentionNamesInHtml(adopted)).toEqual([]);
  });

  it("does not parse anything without an @", () => {
    expect(mentionNamesInHtml("<p>nothing here</p>")).toEqual([]);
  });

  it("reads the contents of a noscript as the sanitizer's parser does, as elements nobody is mentioned in", () => {
    expect(mentionNamesInHtml("<noscript><p>@kir</p></noscript>")).toEqual([]);
    expect(mentionNamesInHtml('<noscript><p title="</noscript>@kir">x</p></noscript>')).toEqual([]);
  });
});

describe("linkMentionsInHtml", () => {
  it("wraps known names in a link and leaves unknown ones as text, keeping the typed case", () => {
    expect(linkMentionsInHtml("<p>Hi @Kir and @nobody</p>", hrefOf)).toBe(
      `<p>Hi ${link("kir", "@Kir")} and @nobody</p>`
    );
  });

  it("returns the very same string when nothing is linked", () => {
    const html =
      '<p>Hi @nobody <a href="/x">@kir</a> <code>@bob</code></p><blockquote>@kir</blockquote>';
    expect(linkMentionsInHtml(html, hrefOf)).toBe(html);
  });

  it("links twice in one text and keeps the text between", () => {
    expect(linkMentionsInHtml("<p>@kir, @bob!</p>", hrefOf)).toBe(
      `<p>${link("kir")}, ${link("bob")}!</p>`
    );
  });

  it("keeps escaped characters escaped, so markup in the text cannot become markup", () => {
    expect(linkMentionsInHtml("<p>1 &lt; 2 &lt;b&gt;@kir&lt;/b&gt;</p>", hrefOf)).toBe(
      `<p>1 &lt; 2 &lt;b&gt;${link("kir")}&lt;/b&gt;</p>`
    );
  });

  it("does not touch attributes", () => {
    const html = '<p title="@kir"><img alt="@kir" src="/a.png"></p>';
    expect(linkMentionsInHtml(html, hrefOf)).toBe(html);
  });

  it("leaves a noscript as it was written and links the text beside it (parser differential)", () => {
    const trap = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">@kir</p></noscript>';
    expect(linkMentionsInHtml(`<p>@kir</p>${trap}`, hrefOf)).toBe(`<p>${link("kir")}</p>${trap}`);
  });

  it("does not link a body the links would push past the nesting ceiling", () => {
    const html = "<div>".repeat(399) + "<p>@kir</p>" + "</div>".repeat(399);
    expect(linkMentionsInHtml(html, hrefOf)).toBe(html);
  });
});

describe("unwrapMentionAnchors", () => {
  it("replaces a mention link by its text, and drops the class from any other element", () => {
    expect(
      unwrapMentionAnchors(
        '<p><a class="forum-mention" href="/id/victim">@kir</a> <a class="x Forum-Mention y" href="/z">z <b>b</b></a><span class="forum-mention a">s</span></p>'
      )
    ).toBe('<p>@kir z b<span class="a">s</span></p>');
  });

  it("finds it inside a template and a noscript too", () => {
    const out = unwrapMentionAnchors(
      '<template><a class="forum-mention" href="/a">@kir</a></template><noscript><a class="forum-mention">@kir</a></noscript>'
    );
    expect(out).not.toMatch(/forum-mention/i);
    expect(out).not.toMatch(/<a\b/);
  });

  it("leaves other links and classes, and returns the same string when there is no mention link", () => {
    const html = '<p class="x"><a class="mw-redirect" href="/id/kir">@kir</a></p>';
    expect(unwrapMentionAnchors(html)).toBe(html);
    expect(unwrapMentionAnchors("<p>plain</p>")).toBe("<p>plain</p>");
  });
});

describe("mentionAnchorNames", () => {
  it("reads the names of the mention links, not other links, and not forged ones in a quote", () => {
    const html =
      `<p>${link("kir")} <a href="/x">@bob</a></p>` +
      `<blockquote>${link("aria_v")}</blockquote><p>${link("bob")}</p>`;
    expect(mentionAnchorNames(html)).toEqual(["kir", "bob"]);
  });

  it("is empty for a post with no links", () => {
    expect(mentionAnchorNames("<p>plain</p>")).toEqual([]);
  });

  it("trusts a persona link at its canonical profile path in any case, once per name", () => {
    const persona = '<a class="forum-mention" href="/dashboard/profile/Aria_V">@aria_v</a>';
    expect(mentionAnchorNames(`<p>${persona} ${persona}</p>`)).toEqual(["aria_v"]);
  });

  it("does not trust a forged anchor: another href, another name, other text, or not the whole text", () => {
    const forged = [
      '<a class="forum-mention" href="/id/victim">@kir</a>',
      '<a class="forum-mention" href="https://evil.example/id/kir">@kir</a>',
      '<a class="forum-mention" href="/id/kir">@bob</a>',
      '<a class="forum-mention" href="/id/kir">hello @kir</a>',
      '<a class="forum-mention" href="/id/kir"><b>@kir</b></a>',
      '<a class="forum-mention">@kir</a>',
      '<a class="other" href="/id/kir">@kir</a>',
      '<a class="Forum-Mention" href="/id/kir">@kir</a>',
    ];
    for (const anchor of forged) expect(mentionAnchorNames(`<p>${anchor}</p>`)).toEqual([]);
  });
});
