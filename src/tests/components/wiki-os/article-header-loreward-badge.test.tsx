/**
 * The "Loreward winner" badge of an article leads to the winner's trophies in the Vault and, once the trophy
 * card is minted, to that card.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { WikiOSHeader } from "~/components/wiki-os/reader/ArticleHeader";

jest.mock("react-dom", () => ({ ...jest.requireActual("react-dom"), preload: jest.fn() }));
jest.mock("~/components/wiki-os/reader/CategoryBreadcrumb", () => ({
  CategoryBreadcrumb: () => null,
}));
jest.mock("~/components/wiki-os/reader/WatchButton", () => ({ WatchButton: () => null }));
jest.mock("~/components/wiki-os/shared/MediaThemeContext", () => ({
  useWikiMediaTheme: () => ({ getImageAttributes: () => ({}) }),
}));
jest.mock("~/trpc/react", () => ({
  api: { wikios: { getAuthorProfile: { useQuery: () => ({ data: undefined }) } } },
}));
jest.mock("~/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

const award = (trophyCardId: string | null) => ({
  id: "e1",
  category: "LOREWARD",
  name: "Daily Loreward Winner",
  description: "Awarded to Ada for outstanding contributions.",
  recipientUsers: ["Ada"],
  awardedAt: "2026-10-10T00:00:00.000Z",
  metadata: null,
  trophyCardId,
});

const header = (trophyCardId: string | null, withImage: boolean) => {
  const props: ComponentProps<typeof WikiOSHeader> = {
    title: "Seastead Law",
    lastModified: null,
    featuredImageUrl: withImage ? "/api/mediawiki/ixwiki/images/a/ab/Flag.png" : null,
    awardsData: { hasAwards: true, hasLoreward: true, awards: [award(trophyCardId)] },
    tocLength: 0,
    onTocClick: () => undefined,
  };
  return <WikiOSHeader {...props} />;
};

describe.each([
  ["the hero header", true],
  ["the masthead header", false],
])("%s", (_name, withImage) => {
  it("links the Loreward badge to the winner's trophies and, once minted, to the trophy card", () => {
    render(header("card-e1", withImage));
    fireEvent.click(screen.getByRole("button", { name: /loreward winner/i }));

    expect(screen.getByRole("link", { name: /view trophies/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/vault/achievements?tab=lorewards")
    );
    expect(screen.getByRole("link", { name: /view trophy card/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/vault/achievements?tab=lorewards&card=card-e1")
    );
  });

  it("offers no trophy card link before the card is minted", () => {
    render(header(null, withImage));
    fireEvent.click(screen.getByRole("button", { name: /loreward winner/i }));

    expect(screen.getByRole("link", { name: /view trophies/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view trophy card/i })).toBeNull();
  });
});
