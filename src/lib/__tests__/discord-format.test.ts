/**
 * Tests for htmlToDiscordMarkdown - HTML to Discord Markdown formatter
 */

import { htmlToDiscordMarkdown } from "../discord-ixtwitter-sync";

describe("htmlToDiscordMarkdown", () => {
  test("strips standard paragraph tags and trims whitespace", () => {
    expect(htmlToDiscordMarkdown("<p>We are now on Thinkpages!</p>")).toBe(
      "We are now on Thinkpages!"
    );
    expect(htmlToDiscordMarkdown("<p>Line 1</p><p>Line 2</p>")).toBe("Line 1\n\nLine 2");
  });

  test("handles formatting tags (bold, italic, underline, strikethrough, code)", () => {
    expect(htmlToDiscordMarkdown("<strong>bold</strong> and <em>italic</em>")).toBe(
      "**bold** and *italic*"
    );
    expect(htmlToDiscordMarkdown("<b>bold b</b> and <i>italic i</i>")).toBe(
      "**bold b** and *italic i*"
    );
    expect(htmlToDiscordMarkdown("<u>underlined text</u>")).toBe("__underlined text__");
    expect(
      htmlToDiscordMarkdown(
        "<s>strike</s> and <del>delete</del> and <strike>strikethrough</strike>"
      )
    ).toBe("~~strike~~ and ~~delete~~ and ~~strikethrough~~");
    expect(htmlToDiscordMarkdown("<code>inline code</code>")).toBe("`inline code`");
    expect(htmlToDiscordMarkdown("<pre>code block</pre>")).toBe("```\ncode block\n```");
  });

  test("handles nested tags correctly", () => {
    expect(htmlToDiscordMarkdown("<strong><em>bold italic</em></strong>")).toBe(
      "***bold italic***"
    );
    expect(htmlToDiscordMarkdown("<u><strong>underlined bold</strong></u>")).toBe(
      "__**underlined bold**__"
    );
  });

  test("converts lists to markdown lists", () => {
    const listHtml = "<ul><li>item 1</li><li>item 2</li></ul>";
    expect(htmlToDiscordMarkdown(listHtml)).toBe("- item 1\n- item 2");
  });

  test("converts links to Discord markdown links", () => {
    expect(htmlToDiscordMarkdown('<a href="https://ixwiki.com">Wiki</a>')).toBe(
      "[Wiki](https://ixwiki.com)"
    );
  });

  test("resolves relative wiki links to absolute URLs", () => {
    expect(htmlToDiscordMarkdown('<a href="/wiki/Urcea">Urcea</a>')).toBe(
      "[Urcea](https://maps.ixwiki.com/wiki/Urcea)"
    );
  });

  test("formats wiki embed cards", () => {
    const embedHtml =
      '<div data-wikiembed="true" data-title="Urcea" data-summary="A major nation" data-source="ixwiki"></div>';
    const expected =
      "**Wiki Embed: [Urcea](https://maps.ixwiki.com/wiki/Urcea)**\n*Source: ixwiki*\n> A major nation";
    expect(htmlToDiscordMarkdown(embedHtml)).toBe(expected);
  });

  test("decodes HTML entities", () => {
    expect(htmlToDiscordMarkdown("A &amp; B &lt; C &gt; D &quot; E &#39; F")).toBe(
      "A & B < C > D \" E ' F"
    );
  });

  test("gracefully handles invalid HTML or unclosed tags via fallback", () => {
    expect(htmlToDiscordMarkdown("<p>incomplete <strong>bold tag")).toBe("incomplete **bold tag**");
  });
});
