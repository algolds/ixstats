import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      getWikiArticleExcerpt: { useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) },
    },
  },
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WikiHtmlContent: () => null,
}));
jest.mock("~/lib/wiki-os/transformers/wikitext-parser", () => ({
  parseWikitextToHtml: jest.fn(() => ""),
}));

import { api } from "~/trpc/react";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { LoreWikiExcerpt } from "~/components/cards/display/LoreWikiExcerpt";

const card = (
  overrides: Partial<{
    description: string | null;
    excerpt: string | null;
    wikiSource: string | null;
    wikiArticleTitle: string | null;
    wikiUrl: string | null;
    artwork: string | null;
    descriptionUrl: string | null;
  }>
) => ({
  title: "Ostrozava",
  description: null,
  excerpt: null,
  wikiSource: null,
  wikiArticleTitle: null,
  wikiUrl: null,
  ...overrides,
});
describe("LoreWikiExcerpt link", () => {
  it("hides a Commons card's file page while its art is hidden, since the page is the image", () => {
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "File:Flag of Ireland.svg", wikiSource: "commons" })}
        wikiUrl="https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg"
        artHidden
      />
    );
    expect(screen.queryByRole("link", { name: "View the file page" })).toBeNull();
  });

  it("draws the excerpt without its images while the art is hidden, keeping the article link", () => {
    const parse = jest.mocked(parseWikitextToHtml);
    jest.mocked(api.cards.getWikiArticleExcerpt.useQuery).mockReturnValue({
      data: { wikitext: "Words [[File:Velarc.png]]", extract: null },
      isLoading: false,
    } as never);
    parse.mockClear();
    const { unmount } = render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "Velarc", wikiSource: "ixwiki" })}
        wikiUrl="/wiki/Velarc"
        artHidden
      />
    );
    expect(parse).toHaveBeenLastCalledWith("Words [[File:Velarc.png]]", "ixwiki", {
      images: false,
    });
    expect(screen.getByRole("link", { name: "Read the full article" })).not.toBeNull();
    unmount();
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "Velarc", wikiSource: "ixwiki" })}
        wikiUrl="/wiki/Velarc"
      />
    );
    expect(parse).toHaveBeenLastCalledWith("Words [[File:Velarc.png]]", "ixwiki", { images: true });
    jest.mocked(api.cards.getWikiArticleExcerpt.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);
  });
});
