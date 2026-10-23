import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { RealmCard } from "~/components/realms/RealmCard";
import type { DirectoryRealm } from "~/app/realms/_components/realm-directory";

jest.mock("~/components/ui/view-transition", () => ({
  SharedElement: ({ children }: { name: string; children: ReactNode }) => <>{children}</>,
}));

jest.mock("~/components/realms/RealmMapFace", () => ({
  RealmMapFace: () => <div data-testid="map-face" />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const IXNAY: DirectoryRealm = {
  id: "realm-ixnay",
  slug: "ixnay",
  name: "Ixnay",
  description: "A modern world.",
  thumbnail: null,
  bannerUrl: null,
  tags: ["Roleplay", "Modern", "Lore-heavy"],
  foundedAt: new Date("2026-01-01T00:00:00Z"),
  nationCount: 145,
  openNationCount: 127,
  openNationPageCount: 0,
  myNationCount: 0,
  maxNationsPerUser: 3,
  board: { recentPosts: 4, lastPostAt: null },
  boardMessagesThisWeek: 0,
};

const renderCard = (over: Partial<DirectoryRealm> = {}) =>
  render(
    <ul>
      <RealmCard realm={{ ...IXNAY, ...over }} />
    </ul>
  );

describe("atlas RealmCard", () => {
  it("links the name to the realm and stretches it over the card", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "Ixnay" });
    expect(link).toHaveAttribute("href", "/r/ixnay");
    expect(link.className).toContain("after:absolute");
  });

  it("shows the open chip only when nations are open", () => {
    const { unmount } = renderCard();
    expect(screen.getByText("127 open")).toBeInTheDocument();
    unmount();
    renderCard({ openNationCount: 0, openNationPageCount: 0 });
    expect(screen.queryByText(/ open$/)).not.toBeInTheDocument();
  });

  it("the open chip carries a decorative hatch swatch", () => {
    renderCard();
    const swatch = screen.getByTestId("open-swatch");
    expect(swatch).toHaveAttribute("aria-hidden", "true");
    expect(swatch.parentElement).toHaveTextContent("127 open");
  });

  it("Join goes to the Nations tab", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/r/ixnay/nations");
  });

  it("a holder below the cap sees Claim another", () => {
    renderCard({ myNationCount: 1 });
    expect(screen.getByRole("link", { name: "Claim another" })).toHaveAttribute(
      "href",
      "/r/ixnay/nations"
    );
    expect(screen.getByText("You hold 1 of 3")).toBeInTheDocument();
  });

  it("at the cap there is no Join, only the holding", () => {
    renderCard({ myNationCount: 3 });
    expect(screen.getByText("You hold 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Claim another" })).not.toBeInTheDocument();
  });

  it("tags and meta lines", () => {
    renderCard();
    expect(screen.getByText("Roleplay · Modern · Lore-heavy")).toBeInTheDocument();
    expect(screen.getByText(/^145 nations · /)).toBeInTheDocument();
  });
});
