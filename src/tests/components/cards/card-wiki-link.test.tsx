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
      getWikiArticleExcerpt: { useQuery: () => ({ data: undefined, isLoading: false }) },
    },
  },
}));
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WikiHtmlContent: () => null,
}));
jest.mock("~/lib/wiki-os/transformers/wikitext-parser", () => ({
  parseWikitextToHtml: () => "",
}));

import { cardWikiHref } from "~/components/cards/display/card-wiki-href";
import { LoreWikiExcerpt } from "~/components/cards/display/LoreWikiExcerpt";
import type { CardInstance } from "~/types/cards-display";

const card = (overrides: Partial<CardInstance>) =>
  ({ id: "c", title: "Ostrozava", ...overrides }) as CardInstance;

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

  it("keeps a URL that names no article as it is", () => {
    expect(cardWikiHref(card({ wikiUrl: "https://example.com/x", wikiSource: "iiwiki" }))).toBe(
      "https://example.com/x"
    );
  });

  it("has no link without a URL or title", () => {
    expect(cardWikiHref(card({}))).toBeNull();
    expect(cardWikiHref(null)).toBeNull();
  });
});

describe("LoreWikiExcerpt link", () => {
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
});
