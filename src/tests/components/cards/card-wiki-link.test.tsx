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
import { cardWikiHref } from "~/components/cards/display/card-wiki-href";
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

describe("cardWikiHref", () => {
  it("opens an IxWiki article in WikiOS, with no ixwiki.com host", () => {
    const href = cardWikiHref(card({ wikiArticleTitle: "Ostrozava City", wikiSource: "ixwiki" }));
    expect(href).toBe("/wiki/Ostrozava_City");
    expect(href).not.toContain("ixwiki.com");
  });

  it("treats a card with no source as IxWiki", () => {
    expect(cardWikiHref(card({ wikiArticleTitle: "Velarc" }))).toBe("/wiki/Velarc");
  });

  it("converts an absolute ixwiki.com URL to the WikiOS path", () => {
    expect(
      cardWikiHref(
        card({ wikiUrl: "https://ixwiki.com/wiki/Kirav_Lighthouse", wikiSource: "ixwiki" })
      )
    ).toBe("/wiki/Kirav_Lighthouse");
  });

  it("keeps an in-app path as it is", () => {
    expect(cardWikiHref(card({ wikiUrl: "/wiki/Velarc" }))).toBe("/wiki/Velarc");
  });

  it("opens an IIWiki article in the WikiOS reader, with no iiwiki.com host", () => {
    const href = cardWikiHref(card({ wikiArticleTitle: "Some Page", wikiSource: "iiwiki" }));
    expect(href).toBe("/wiki/Some_Page?source=iiwiki");
    expect(href).not.toContain("iiwiki.com");
  });

  it("converts an absolute IIWiki URL to the reader path", () => {
    expect(
      cardWikiHref(
        card({ wikiUrl: "https://iiwiki.com/wiki/Kirav_Lighthouse", wikiSource: "iiwiki" })
      )
    ).toBe("/wiki/Kirav_Lighthouse?source=iiwiki");
  });

  it("repairs the old lore-generator /w/<title> URL from the card's title", () => {
    expect(
      cardWikiHref(card({ wikiUrl: "/w/Velarc", wikiArticleTitle: "Velarc", wikiSource: "ixwiki" }))
    ).toBe("/wiki/Velarc");
    expect(
      cardWikiHref(
        card({
          wikiUrl: "https://iiwiki.com/w/Page",
          wikiArticleTitle: "Page",
          wikiSource: "iiwiki",
        })
      )
    ).toBe("/wiki/Page?source=iiwiki");
  });

  it("opens an AltHistory article in WikiOS's reader with its source", () => {
    expect(
      cardWikiHref(card({ wikiArticleTitle: "Balkanized North America", wikiSource: "althistory" }))
    ).toBe("/wiki/Balkanized_North_America?source=althistory");
  });

  it("reads an AltHistory article URL when the card has no title", () => {
    expect(
      cardWikiHref(
        card({
          wikiUrl: "https://althistory.fandom.com/wiki/Balkanized_North_America",
          wikiSource: "althistory",
        })
      )
    ).toBe("/wiki/Balkanized_North_America?source=althistory");
  });

  it("links a Commons file to its Commons page, not an IxWiki one", () => {
    expect(
      cardWikiHref(card({ wikiArticleTitle: "File:Flag of Ireland.svg", wikiSource: "commons" }))
    ).toBe("https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg");
  });

  it("links a legacy Commons card, stored with no title, to the file its description URL or art names", () => {
    const page = "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg";
    const upload = "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg";
    expect(cardWikiHref(card({ wikiSource: "commons", descriptionUrl: upload }))).toBe(page);
    expect(cardWikiHref(card({ wikiSource: "commons", artwork: upload }))).toBe(page);
    expect(
      cardWikiHref(
        card({
          wikiSource: "commons",
          wikiUrl: null,
          descriptionUrl: "javascript:alert(1)",
        })
      )
    ).toBeNull();
  });

  it("keeps a URL that names no article as it is", () => {
    expect(cardWikiHref(card({ wikiUrl: "https://example.com/x", wikiSource: "iiwiki" }))).toBe(
      "https://example.com/x"
    );
  });

  it("has no link without a URL or title", () => {
    expect(cardWikiHref(card({}))).toBeNull();
    expect(cardWikiHref({ wikiSource: "ixwiki", wikiArticleTitle: null })).toBeNull();
    expect(cardWikiHref(null)).toBeNull();
  });
});

describe("LoreWikiExcerpt link", () => {
  it("credits AltHistory by name", () => {
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "Page", wikiSource: "althistory" })}
        wikiUrl="/wiki/Page?source=althistory"
      />
    );
    expect(screen.getByText("From AltHistory Wiki")).not.toBeNull();
  });

  it("links a Commons card out to Commons, credited, with no article fetch", () => {
    const useQuery = jest.mocked(api.cards.getWikiArticleExcerpt.useQuery);
    useQuery.mockClear();
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "File:Flag of Ireland.svg", wikiSource: "commons" })}
        wikiUrl="https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg"
      />
    );
    const link = screen.getByRole("link", { name: "View the file page" });
    expect(link.getAttribute("href")).toBe(
      "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("From Wikimedia Commons")).not.toBeNull();
    expect(useQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: false });
  });

  it("links an IxWiki card in-app as Read the full article", () => {
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "Velarc", wikiSource: "ixwiki" })}
        wikiUrl="/wiki/Velarc"
      />
    );
    const link = screen.getByRole("link", { name: "Read the full article" });
    expect(link.getAttribute("href")).toBe("/wiki/Velarc");
    expect(link.getAttribute("target")).toBeNull();
    expect(link.textContent).not.toMatch(/IxWiki/);
  });

  it("links a card with no source in-app too", () => {
    render(<LoreWikiExcerpt card={card({ wikiArticleTitle: "Velarc" })} wikiUrl="/wiki/Velarc" />);
    expect(screen.getByRole("link", { name: "Read the full article" })).not.toBeNull();
  });

  it("links an IIWiki card in-app too, crediting IIWiki as the source", () => {
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "Page", wikiSource: "iiwiki" })}
        wikiUrl="/wiki/Page?source=iiwiki"
      />
    );
    const link = screen.getByRole("link", { name: "Read the full article" });
    expect(link.getAttribute("href")).toBe("/wiki/Page?source=iiwiki");
    expect(link.getAttribute("target")).toBeNull();
    expect(screen.getByText("From IIWiki")).not.toBeNull();
  });

  it("shows the stored excerpt while the article loads, and asks the card's own wiki", () => {
    const useQuery = jest.mocked(api.cards.getWikiArticleExcerpt.useQuery);
    useQuery.mockClear();
    useQuery.mockReturnValueOnce({ data: undefined, isLoading: true } as never);
    render(
      <LoreWikiExcerpt
        card={card({ wikiArticleTitle: "Page", wikiSource: "iiwiki", excerpt: "Stored words" })}
        wikiUrl="/wiki/Page?source=iiwiki"
      />
    );
    expect(screen.queryByText("Loading article excerpt...")).toBeNull();
    expect(useQuery.mock.calls[0]?.[0]).toEqual({ articleTitle: "Page", wikiSource: "iiwiki" });
    expect(useQuery.mock.calls[0]?.[1]).toMatchObject({ enabled: true });
  });

  it("titles the excerpt below the section that holds it", () => {
    render(<LoreWikiExcerpt card={card({ wikiArticleTitle: "Velarc_City" })} wikiUrl={null} />);
    expect(screen.getByRole("heading", { level: 4, name: "Velarc City" })).not.toBeNull();
  });

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
