/** @jest-environment node */
/**
 * The action-token parser is fed player text: what reaches the wiki stays on its line with no markup, a token inside
 * an attribute is never cut out of its tag (which would let the rest of the attribute escape as HTML), only tokens in
 * text runs render cards (I7), and a removal cannot leave a token behind. The links, chains and wiki write are
 * scenarios/noncore/action-chain.
 */
import {
  chainWikiSection,
  isActivityId,
  parseTextActionTokens,
  splitActionTokens,
  withoutActionTokens,
} from "~/lib/action-links";

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
});

describe("parseTextActionTokens (I7)", () => {
  it("lists the distinct ids in text runs only, in first-seen order", () => {
    const html =
      '<p title="[ixaction=attr]">[ixaction=b] then [ixaction=a]</p><!-- [ixaction=c] -->[ixaction=b]';
    expect(parseTextActionTokens(html)).toEqual(["b", "a"]);
  });
});

describe("withoutActionTokens", () => {
  it("removes every token, including one formed by a removal", () => {
    expect(withoutActionTokens("a [ixaction=x] b [ixaction=[ixaction=y]z]")).toBe("a  b ");
  });
});
describe("activity ids", () => {
  it.each([
    ["dir-abc_1", true],
    ["a".repeat(65), false],
    ["<script>", false],
    ["a]b", false],
  ])("isActivityId(%j) is %s", (value, expected) => {
    expect(isActivityId(value)).toBe(expected);
  });
});
