import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/lib/system/wikios-standalone", () => ({
  ixstatesLinkHref: (path: string) => `ixstates:${path}`,
}));

import { TrophyCards } from "~/components/lorewards/TrophyCards";
import type { TrophyCardSummary } from "~/lib/lorewards/trophy-summary";

const trophy: TrophyCardSummary = {
  id: "t1",
  title: "Caphiria",
  contest: "daily",
  place: "winner",
  face: {
    cardId: "t1",
    title: "Caphiria",
    rarity: "LEGENDARY",
    cardType: "TROPHY",
    realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
    artwork: "https://art/t1.png",
    silhouette: false,
    number: 3,
    season: null,
    isRetired: false,
    copy: { ownershipId: "o1", finish: "SERIALISED", serialNumber: 1, level: 1 },
  },
};

const FACE_NAME = "Caphiria, Legendary, Serialised, Ixnay";

describe("TrophyCards", () => {
  it("shows each trophy as its face, opening the player's own sheet in Mine", () => {
    render(<TrophyCards cards={[trophy]} holderHandle="max" own />);
    const face = screen.getByRole("link", { name: FACE_NAME });
    expect(face).toHaveAttribute("href", "ixstates:/vault/cards/mine?card=t1");
    expect(face).toHaveAttribute("data-card-face");
    expect(face.querySelector("img")).toHaveAttribute("src", "https://art/t1.png");
    expect(screen.getByText("Daily winner")).toBeInTheDocument();
  });

  it("opens another player's trophy with its art, through their display", () => {
    render(<TrophyCards cards={[trophy]} holderHandle="ann" own={false} highlightCardId="t1" />);
    expect(screen.getByRole("link", { name: FACE_NAME })).toHaveAttribute(
      "href",
      "ixstates:/vault/cards/explore?card=t1&from=holder.ann"
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-highlighted");
  });

  it("opens another player's trophy in Explore when their account has no handle", () => {
    render(<TrophyCards cards={[trophy]} holderHandle={null} own={false} />);
    expect(screen.getByRole("link", { name: FACE_NAME })).toHaveAttribute(
      "href",
      "ixstates:/vault/cards/explore?card=t1"
    );
    expect(screen.getByRole("listitem")).not.toHaveAttribute("data-highlighted");
  });

  it("links each trophy to the article it was won for, named by its title", () => {
    render(<TrophyCards cards={[trophy]} holderHandle="max" own />);
    const article = screen.getByRole("link", { name: "The article, Caphiria" });
    expect(article).toHaveTextContent("The article");
    expect(article.getAttribute("href")).toMatch(/\/wiki\/Caphiria$/);
  });
});
