import "react";
import { render, screen } from "@testing-library/react";

import { RealmCard } from "~/components/realms/RealmCard";

const LAST = new Date("2026-10-01T00:00:00Z");
const REALM = {
  id: "r1",
  slug: "eurth",
  name: "Eurth",
  description: "A modern world of diplomacy.",
  thumbnail: null as string | null,
  bannerUrl: "https://img.example/banner.png" as string | null,
  tags: ["Modern", "Roleplay"],
  foundedAt: new Date("2025-01-01"),
  nationCount: 12,
  openNationCount: 4,
  openNationPageCount: 2,
  myNationCount: 0,
  maxNationsPerUser: 2,
  board: { recentPosts: 5, lastPostAt: LAST as Date | null },
};

function renderCard(over: object = {}) {
  return render(
    <ul>
      <RealmCard realm={{ ...REALM, ...over } as never} />
    </ul>
  );
}

describe("the directory realm card", () => {
  it("says how many nations the viewer holds and offers another below the cap", () => {
    renderCard({ myNationCount: 1 });
    expect(screen.getByText("You hold 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claim another nation" })).toHaveAttribute(
      "href",
      "/r/eurth/nations"
    );
  });

  it("offers no claim link at the cap", () => {
    renderCard({ myNationCount: 2 });
    expect(screen.getByText("You hold 2 of 2")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /claim/i })).toBeNull();
  });
});
