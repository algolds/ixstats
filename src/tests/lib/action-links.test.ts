/** @jest-environment node */
import {
  parseTextActionTokens,
  chainWikiSection,
  MAX_ACTIONS_PER_POST,
  countActionTokens,
  countTextActionTokens,
  mapHtmlRuns,
  parseActionTokens,
  postPermalinkPath,
  splitActionTokens,
  withoutActionTokens,
  withoutTokensInTags,
} from "~/lib/action-links";

describe("parseActionTokens", () => {
  it("returns nothing for a body without tokens", () => {
    expect(parseActionTokens("just roleplay")).toEqual([]);
  });

  it("returns distinct ids in first-seen order", () => {
    expect(parseActionTokens("[ixaction=b] then [ixaction=a] and [ixaction=b] again")).toEqual([
      "b",
      "a",
    ]);
  });

  it("ignores malformed tokens", () => {
    expect(parseActionTokens("[ixaction=] [ixaction=has space] [ixaction=ok_1-2]")).toEqual([
      "ok_1-2",
    ]);
  });

  it("caps at a known limit the caller can check", () => {
    const body = Array.from(
      { length: MAX_ACTIONS_PER_POST + 1 },
      (_, i) => `[ixaction=a${i}]`
    ).join(" ");
    expect(parseActionTokens(body)).toHaveLength(MAX_ACTIONS_PER_POST + 1);
  });
});

describe("postPermalinkPath", () => {
  it("points native posts at the ThinkPages permalink", () => {
    expect(postPermalinkPath("native", "p1")).toBe("/thinkpages/post/p1");
  });

  it("points a XenForo post at its legacy path, which redirects through the import id map (phase 4b)", () => {
    expect(postPermalinkPath("xenforo", "42")).toBe("/forum/post/42");
  });
});

describe("chainWikiSection", () => {
  it("writes a dated level-2 section listing each entry as an external link", () => {
    const text = chainWikiSection({
      title: "The Northern Pact",
      approvedIxTime: Date.UTC(2041, 2, 5),
      entries: [
        {
          title: "Signed treaty",
          type: "diplomatic",
          ixTime: Date.UTC(2041, 0, 2),
          url: "https://x/p/1",
        },
      ],
    });
    expect(text).toContain("== Story chain: The Northern Pact ==");
    expect(text).toContain("[https://x/p/1 Signed treaty]");
    expect(text).toContain("diplomatic");
  });

  it("strips wikitext control characters from player text", () => {
    const text = chainWikiSection({
      title: "Bad ]] [[Title",
      approvedIxTime: 0,
      entries: [{ title: "x]] {{y}}", type: "t", ixTime: 0, url: "https://x" }],
    });
    expect(text).not.toMatch(/\]\]|\[\[|\{\{|\}\}/);
  });

  it("keeps newline and inline-markup injection on the heading's single line", () => {
    const text = chainWikiSection({
      title: "x\n== Fake ==\n__NOTOC__ ~~~~ \'\'\'bold &#91; \'<\'",
      approvedIxTime: 0,
      entries: [{ title: "a\n* b", type: "t\n== T ==", ixTime: 0, url: "https://x" }],
    });
    const lines = text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("== Story chain: x == Fake == NOTOC bold #91; ==");
    expect([lines[0], lines[2]].join("\n")).not.toMatch(/__|~~~|''|&/);
    expect(lines[2]).toMatch(/^\* .*: \[https:\/\/x a \* b\] \(t == T ==\)$/);
  });
});

describe("splitActionTokens", () => {
  it("cuts a body on its tokens and drops empty html segments", () => {
    expect(splitActionTokens("a[ixaction=x1][ixaction=y_2]b")).toEqual([
      { kind: "html", text: "a" },
      { kind: "action", id: "x1" },
      { kind: "action", id: "y_2" },
      { kind: "html", text: "b" },
    ]);
    expect(splitActionTokens("")).toEqual([]);
  });

  it("keeps both halves of a paragraph as balanced html around the token", () => {
    expect(splitActionTokens("<p>before [ixaction=a1] after</p>")).toEqual([
      { kind: "html", text: "<p>before </p>" },
      { kind: "action", id: "a1" },
      { kind: "html", text: "<p> after</p>" },
    ]);
  });

  it("never cuts a token inside an attribute value", () => {
    const title = '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>';
    const href =
      '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>';
    expect(splitActionTokens(title)).toEqual([{ kind: "html", text: title }]);
    expect(splitActionTokens(href)).toEqual([{ kind: "html", text: href }]);
  });

  it("cuts a text token beside an attribute token without touching the tag", () => {
    const html = '<p><span title="[ixaction=bad]">a</span> [ixaction=a1] b</p>';
    expect(splitActionTokens(html)).toEqual([
      { kind: "html", text: '<p><span title="[ixaction=bad]">a</span> </p>' },
      { kind: "action", id: "a1" },
      { kind: "html", text: "<p> b</p>" },
    ]);
  });

  it("balances list items, quotes, headings and inline tags around a token", () => {
    expect(splitActionTokens("<ul><li>a [ixaction=a1] b</li></ul>")).toEqual([
      { kind: "html", text: "<ul><li>a </li></ul>" },
      { kind: "action", id: "a1" },
      { kind: "html", text: "<ul><li> b</li></ul>" },
    ]);
    expect(splitActionTokens("<blockquote><p>[ixaction=a1]</p></blockquote><h2>x</h2>")).toEqual([
      { kind: "action", id: "a1" },
      { kind: "html", text: "<blockquote><p></p></blockquote><h2>x</h2>" },
    ]);
    expect(splitActionTokens("<p>a <strong>b [ixaction=a1] c</strong><br> d</p>")).toEqual([
      { kind: "html", text: "<p>a <strong>b </strong></p>" },
      { kind: "action", id: "a1" },
      { kind: "html", text: "<p><strong> c</strong><br> d</p>" },
    ]);
  });

  it("keeps an image-only fragment and leaves a text run with a stray < uncut", () => {
    expect(splitActionTokens('<p><img src="https://e.com/a.png">[ixaction=a1]</p>')).toEqual([
      { kind: "html", text: '<p><img src="https://e.com/a.png"></p>' },
      { kind: "action", id: "a1" },
    ]);
    expect(splitActionTokens("a < b [ixaction=a1]")).toEqual([
      { kind: "html", text: "a < b [ixaction=a1]" },
    ]);
  });
});

describe("parseTextActionTokens (I7)", () => {
  it("lists the distinct ids in text runs only, in first-seen order", () => {
    const html =
      '<p title="[ixaction=attr]">[ixaction=b] then [ixaction=a]</p><!-- [ixaction=c] -->[ixaction=b]';
    expect(parseTextActionTokens(html)).toEqual(["b", "a"]);
  });

  it("is empty for markup-only tokens and plain text", () => {
    expect(parseTextActionTokens('<img src="x" alt="[ixaction=a]">')).toEqual([]);
    expect(parseTextActionTokens("<p>none</p>")).toEqual([]);
  });
});

describe("countTextActionTokens", () => {
  it("counts only the tokens outside tags and attributes", () => {
    const html = '<p title="[ixaction=x]">[ixaction=a1] and [ixaction=a1]</p><!-- [ixaction=c] -->';
    expect(countTextActionTokens(html)).toBe(2);
    expect(countActionTokens(html)).toBe(4);
  });
});

/** The split body re-joined, tokens in place: shows where splitActionTokens cuts paragraphs. */
const liftActionTokens = (html: string): string =>
  splitActionTokens(html)
    .map((s) => (s.kind === "html" ? s.text : `[ixaction=${s.id}]`))
    .join("");

describe("splitActionTokens paragraph lifting", () => {
  it("lifts a mid-paragraph token between two paragraphs", () => {
    expect(liftActionTokens("<p>before [ixaction=a1] after</p>")).toBe(
      "<p>before </p>[ixaction=a1]<p> after</p>"
    );
  });

  it("leaves no empty paragraph for a token at the start or end", () => {
    expect(liftActionTokens("<p>[ixaction=a1] after</p>")).toBe("[ixaction=a1]<p> after</p>");
    expect(liftActionTokens("<p>before [ixaction=a1]</p>")).toBe("<p>before </p>[ixaction=a1]");
    expect(liftActionTokens("<p>[ixaction=a1]</p>")).toBe("[ixaction=a1]");
  });

  it("lifts two tokens in one paragraph and keeps the opening tag attributes", () => {
    expect(liftActionTokens('<p class="x">a [ixaction=a1] b [ixaction=b2] c</p>')).toBe(
      '<p class="x">a </p>[ixaction=a1]<p class="x"> b </p>[ixaction=b2]<p class="x"> c</p>'
    );
  });

  it("leaves tokens outside paragraphs and other paragraphs untouched", () => {
    const html = "<p></p><p>plain</p>[ixaction=a1]<div>x</div>";
    expect(liftActionTokens(html)).toBe(html);
  });
});

describe("withoutTokensInTags", () => {
  it("cuts tokens out of tags and attribute values and leaves the text's tokens", () => {
    expect(
      withoutTokensInTags('<p><a href="https://x.test/[ixaction=a1]">x [ixaction=b2]</a></p>')
    ).toBe('<p><a href="https://x.test/">x [ixaction=b2]</a></p>');
  });

  it("never leaves a token that a cut formed inside a tag", () => {
    const out = withoutTokensInTags('<a href="[ixaction=[ixaction=a]b]">x</a>');
    expect(countActionTokens(out)).toBe(countTextActionTokens(out));
    expect(out).toBe('<a href="">x</a>');
  });

  it("leaves html without tokens unchanged", () => {
    const html = '<p class="a">one</p><img src="/a.png" alt="">';
    expect(withoutTokensInTags(html)).toBe(html);
  });
});

describe("withoutActionTokens", () => {
  it("removes every token, including one formed by a removal", () => {
    expect(withoutActionTokens("a [ixaction=x] b [ixaction=[ixaction=y]z]")).toBe("a  b ");
  });
});

describe("mapHtmlRuns", () => {
  it("maps tags and the text between them separately", () => {
    const out = mapHtmlRuns('<p title="t">ab</p>cd', {
      markup: (tag) => tag.toUpperCase(),
      text: (text) => `[${text}]`,
    });
    expect(out).toBe('<P TITLE="T">[ab]</P>[cd]');
  });

  it("leaves a side alone when no mapper is given for it", () => {
    expect(mapHtmlRuns("<b>x</b>", { text: () => "y" })).toBe("<b>y</b>");
    expect(mapHtmlRuns("<b>x</b>", { markup: () => "" })).toBe("x");
  });
});
