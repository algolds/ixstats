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
  it("draws no image for an IIWiki card whose art is hidden", () => {
    fetched(IIWIKI_EXCERPT);
    render(
      <LoreWikiExcerpt card={card()} wikiUrl="/wiki/Manamana_League?source=iiwiki" artHidden />
    );
    expect(imageSources()).toEqual([]);
    expect(screen.getByTestId("excerpt").textContent).toContain("is a multinational organization");
  });
});
