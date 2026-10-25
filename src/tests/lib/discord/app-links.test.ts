/** @jest-environment node */
/**
 * IxStates links sent to Discord (markdown.ts, ixtwitter-sync.ts) are absolute on the app URL (app-url.ts): the origin
 * of NEXT_PUBLIC_APP_URL and production's base path, once, never maps.ixwiki.com.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { formatThinkPagesEmbed, htmlToDiscordMarkdown } from "~/lib/discord/ixtwitter-sync";

const KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL", "BASE_PATH", "NEXT_PUBLIC_BASE_PATH"] as const;
const env = process.env as Record<string, string | undefined>;
const saved = KEYS.map((key) => [key, env[key]] as const);
const APP = "https://ixwiki.com/projects/ixstates";

beforeEach(() => {
  for (const key of KEYS) delete env[key];
  env.NEXT_PUBLIC_APP_URL = APP;
  env.BASE_PATH = "/projects/ixstates";
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
});

describe("Discord links on the app URL", () => {
  it("a site-relative link and a wiki embed become app permalinks; other links stay", () => {
    const markdown = htmlToDiscordMarkdown(
      '<p><a href="/wiki/Holy_See">See</a> <a href="https://example.org/x">out</a> <a href="//cdn.example/y">cdn</a></p>' +
        '<div data-wikiembed="true" data-title="Port of Ixnay" data-summary="A port." data-source="ixwiki"></div>'
    );
    expect(markdown).toContain(`[See](${APP}/wiki/Holy_See)`);
    expect(markdown).toContain("[out](https://example.org/x)");
    expect(markdown).toContain("[cdn](//cdn.example/y)");
    expect(markdown).toContain(`**Wiki Embed: [Port of Ixnay](${APP}/wiki/Port_of_Ixnay)**`);
    expect(markdown).not.toContain("maps.ixwiki.com");
  });

  it("a ThinkPages embed links the post, its author's image and the footer logo on the app URL", () => {
    const [embed] = formatThinkPagesEmbed(
      { id: "p1", content: "Hello", ixTimeTimestamp: "2026-10-25T00:00:00.000Z" },
      {
        displayName: "Ana",
        username: "ana",
        verified: false,
        profileImageUrl: "/projects/ixstates/u/ana.png",
      },
      ["/projects/ixstates/images/discord/a.png", "https://cdn.example/b.png"]
    ) as Array<{
      url: string;
      author: { icon_url: string };
      footer: { icon_url: string };
      image: { url: string };
    }>;
    expect(embed?.url).toBe(`${APP}/dashboard/post/p1`);
    expect(embed?.footer.icon_url).toBe(`${APP}/thinkpages-logo.svg`);
    // stored paths already carry the base path: only the origin goes in front
    expect(embed?.author.icon_url).toBe("https://ixwiki.com/projects/ixstates/u/ana.png");
    expect(embed?.image.url).toBe("https://ixwiki.com/projects/ixstates/images/discord/a.png");
  });

  it("an upload's root path (stored without the base path) gets the base path once, in media and the author image", () => {
    const embeds = formatThinkPagesEmbed(
      { id: "p2", content: "Pictures", ixTimeTimestamp: "2026-10-25T00:00:00.000Z" },
      {
        displayName: "Ana",
        username: "ana",
        verified: false,
        profileImageUrl: "/images/uploads/ana.png",
      },
      ["/images/uploads/a.png", "/images/uploads/b.png", "https://cdn.example/c.png"]
    ) as Array<{ author?: { icon_url: string }; image: { url: string } }>;
    expect(embeds[0]?.author?.icon_url).toBe(`${APP}/images/uploads/ana.png`);
    expect(embeds.map((embed) => embed.image.url)).toEqual([
      `${APP}/images/uploads/a.png`,
      `${APP}/images/uploads/b.png`,
      "https://cdn.example/c.png",
    ]);
  });
});
