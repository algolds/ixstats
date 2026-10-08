/** @jest-environment node */
import {
  chainWikiSection,
  MAX_ACTIONS_PER_POST,
  parseActionTokens,
  postPermalinkPath,
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
    const body = Array.from({ length: MAX_ACTIONS_PER_POST + 1 }, (_, i) => `[ixaction=a${i}]`).join(
      " "
    );
    expect(parseActionTokens(body)).toHaveLength(MAX_ACTIONS_PER_POST + 1);
  });
});

describe("postPermalinkPath", () => {
  it("points native posts at the ThinkPages permalink", () => {
    expect(postPermalinkPath("native", "p1")).toBe("/thinkpages/p/p1");
  });

  it("points imported XenForo posts at the forum", () => {
    expect(postPermalinkPath("xenforo", "42")).toBe("https://forum.ixwiki.com/posts/42/");
  });
});

describe("chainWikiSection", () => {
  it("writes a dated level-2 section listing each entry as an external link", () => {
    const text = chainWikiSection({
      title: "The Northern Pact",
      approvedIxTime: Date.UTC(2041, 2, 5),
      entries: [
        { title: "Signed treaty", type: "diplomatic", ixTime: Date.UTC(2041, 0, 2), url: "https://x/p/1" },
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
