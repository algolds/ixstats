import { htmlToDiscordMarkdown, formatThinkPagesEmbed } from "../discord-ixtwitter-sync";

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

describe("formatThinkPagesEmbed", () => {
  const account = {
    displayName: "SportsNews",
    username: "sportsnews",
    verified: true,
    profileImageUrl: "/logo.png",
  };

  test("formats normal posts as normal embeds and strips bulletin comments", () => {
    const post = {
      id: "post123",
      content: "<!-- sports-bulletin:{} --><p>Hello world!</p>",
      ixTimeTimestamp: new Date("2026-07-16T20:00:00.000Z"),
    };
    const embeds = formatThinkPagesEmbed(post, account);
    expect(embeds.length).toBe(1);
    expect(embeds[0].description).toBe("Hello world!");
    expect(embeds[0].color).toBe(0x9835ff);
  });

  test("formats matchday sports bulletins as rich structured embeds", () => {
    const sportsData = {
      league: { id: "league123", name: "Urcea Premier League" },
      sportEmoji: "⚽",
      matchDay: 15,
      results: [
        {
          home: { name: "Urcea", id: "club1" },
          away: { name: "Gaelia", id: "club2" },
          homeScore: 2,
          awayScore: 1,
        },
        {
          home: { name: "Apaturia" },
          away: { name: "Daxia" },
          homeScore: 0,
          awayScore: 3,
          isUpset: true,
        },
      ],
      movers: [{ name: "Daxia", id: "club3", oldRank: 7, newRank: 4 }],
      llmSummary: "A thrilling matchday with a big upset.",
    };
    const post = {
      id: "post456",
      content: `<!-- sports-bulletin:${JSON.stringify(sportsData)} -->\nSome text fallback`,
      ixTimeTimestamp: new Date("2026-07-16T20:00:00.000Z"),
    };

    const embeds = formatThinkPagesEmbed(post, account);
    expect(embeds.length).toBe(1);
    expect(embeds[0].title).toBe("⚽ Urcea Premier League — Matchday 15");
    expect(embeds[0].color).toBe(0x22c55e); // Green for soccer emoji
    expect(embeds[0].description).toContain("Urcea       2 - 1  Gaelia");
    expect(embeds[0].description).toContain("Apaturia    0 - 3  Daxia  [Upset ⭐]");
    expect(embeds[0].fields.length).toBe(2);
    expect(embeds[0].fields[0].name).toBe("📈 Table Movers");
    expect(embeds[0].fields[0].value).toContain("▲ **Daxia** (+3 spots, 7th → 4th)");
    expect(embeds[0].fields[1].name).toBe("📝 Summary");
    expect(embeds[0].fields[1].value).toBe("*A thrilling matchday with a big upset.*");
  });
});
