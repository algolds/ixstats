import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      getWikiArticleExcerpt: { useQuery: jest.fn(() => ({ data: undefined, isLoading: false })) },
    },
  },
}));
// The real compiler runs; the reader's HTML host only draws what it is given.
jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WikiHtmlContent: ({ html }: { html: string }) => (
    <div data-testid="excerpt" dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));

import { api } from "~/trpc/react";
import { LoreWikiExcerpt } from "~/components/cards/display/LoreWikiExcerpt";
import { proxiedFileUrl } from "~/lib/realms/sources/wiki-file-info";
import { IIWIKI_EXCERPT } from "~/tests/fixtures/cards/iiwiki-excerpt";

const card = (overrides: Partial<React.ComponentProps<typeof LoreWikiExcerpt>["card"]> = {}) => ({
  title: "Manamana League",
  description: null,
  excerpt: null,
  wikiSource: "iiwiki",
  wikiArticleTitle: "Manamana League",
  ...overrides,
});

const fetched = (wikitext: string) =>
  jest
    .mocked(api.cards.getWikiArticleExcerpt.useQuery)
    .mockReturnValue({ data: { wikitext, extract: wikitext }, isLoading: false } as never);

const imageSources = () =>
  Array.from(screen.getByTestId("excerpt").querySelectorAll("img")).map((img) =>
    img.getAttribute("src")
  );

describe("LoreWikiExcerpt by the card's own wiki", () => {
  it("reads an IIWiki card's lead text, with no raw infobox rows and its images through the IIWiki proxy", () => {
    fetched(IIWIKI_EXCERPT);
    render(<LoreWikiExcerpt card={card()} wikiUrl="/wiki/Manamana_League?source=iiwiki" />);
    const excerpt = screen.getByTestId("excerpt");
    expect(excerpt.textContent).toContain("is a multinational organization");
    expect(excerpt.textContent).not.toMatch(/Logo Size|Logo Caption|Map Alt|200px/);
    expect(excerpt.querySelector("table")).toBeNull();
    expect(imageSources()).toEqual([proxiedFileUrl("iiwiki", null, "Manamana Canal.jpg")]);
  });

  it("draws no image for an IIWiki card whose art is hidden", () => {
    fetched(IIWIKI_EXCERPT);
    render(
      <LoreWikiExcerpt card={card()} wikiUrl="/wiki/Manamana_League?source=iiwiki" artHidden />
    );
    expect(imageSources()).toEqual([]);
    expect(screen.getByTestId("excerpt").textContent).toContain("is a multinational organization");
  });

  it("draws a Commons card's own text against Commons, not IxWiki", () => {
    jest
      .mocked(api.cards.getWikiArticleExcerpt.useQuery)
      .mockReturnValue({ data: undefined, isLoading: false } as never);
    render(
      <LoreWikiExcerpt
        card={card({
          wikiSource: "commons",
          wikiArticleTitle: "File:Flag of Ireland.svg",
          description: "The flag. [[File:Flag of Ireland.svg|thumb|The flag]]",
        })}
        wikiUrl="https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg"
      />
    );
    const [src] = imageSources();
    expect(src).toContain("/api/mediawiki/commons/");
    expect(src).not.toContain("/api/mediawiki/ixwiki/");
  });
});
