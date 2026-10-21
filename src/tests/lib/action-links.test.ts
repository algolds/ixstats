/** @jest-environment node */
import {
  isActivityId,
  parseTextActionTokens,
  chainWikiSection,
  MAX_ACTIONS_PER_POST,
  countActionTokens,
  countTextActionTokens,
  parseActionTokens,
  splitActionTokens,
  withoutActionTokens,
} from "~/lib/action-links";

describe("parseActionTokens", () => {
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

describe("chainWikiSection", () => {
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
});

describe("countTextActionTokens", () => {
  it("counts only the tokens outside tags and attributes", () => {
    const html = '<p title="[ixaction=x]">[ixaction=a1] and [ixaction=a1]</p><!-- [ixaction=c] -->';
    expect(countTextActionTokens(html)).toBe(2);
    expect(countActionTokens(html)).toBe(4);
  });
});
describe("withoutActionTokens", () => {
  it("removes every token, including one formed by a removal", () => {
    expect(withoutActionTokens("a [ixaction=x] b [ixaction=[ixaction=y]z]")).toBe("a  b ");
  });
});
describe("picker constants and ids", () => {
  it.each([
    ["dir-abc_1", true],
    ["a".repeat(64), true],
    ["a".repeat(65), false],
    ["", false],
    ["has space", false],
    ["<script>", false],
    ["a]b", false],
  ])("isActivityId(%j) is %s", (value, expected) => {
    expect(isActivityId(value)).toBe(expected);
  });
});
