import React from "react";
import { render, screen, within } from "@testing-library/react";

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
  it("renders the banner, identity, counts, description, tags, activity and links", () => {
    const { container } = renderCard();
    const card = container.querySelector("li")!;
    expect(card).toHaveClass(
      "border-separator",
      "bg-surface",
      "rounded-card",
      "flex",
      "flex-col",
      "overflow-hidden",
      "border"
    );
    const banner = card.querySelector("a[aria-hidden='true']")!;
    expect(banner).toHaveAttribute("href", "/r/eurth");
    expect(banner).toHaveAttribute("tabindex", "-1");
    expect(banner.querySelector("img")).toHaveAttribute("src", "https://img.example/banner.png");
    expect(screen.getByRole("link", { name: "Eurth" })).toHaveAttribute("href", "/r/eurth");
    expect(card).toHaveTextContent("12 nations · 4 unclaimed · 2 pages to claim");
    expect(card).toHaveTextContent("A modern world of diplomacy.");
    const tags = within(screen.getByRole("list", { name: "Tags" })).getAllByRole("listitem");
    expect(tags.map((t) => t.textContent)).toEqual(["Modern", "Roleplay"]);
    expect(card).toHaveTextContent(`5 posts this week · last ${LAST.toLocaleDateString()}`);
    expect(screen.getByRole("link", { name: "Forum" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth/hub"
    );
    expect(screen.getByRole("link", { name: "Join · claim a nation" })).toHaveAttribute(
      "href",
      "/r/eurth/nations"
    );
  });

  it("links to the live board before the forum", () => {
    renderCard();
    const links = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute(
      "href",
      "/thinkpages/r/eurth"
    );
    expect(links.indexOf("/thinkpages/r/eurth")).toBeLessThan(
      links.indexOf("/thinkpages/r/eurth/hub")
    );
  });

  it("states the board's week as its own line, only when there were messages", () => {
    const { container } = renderCard({ boardMessagesThisWeek: 3 });
    const lines = [...container.querySelectorAll("p")].map((p) => p.textContent);
    expect(lines).toContain("3 board messages this week");
    expect(container.textContent).toContain("5 posts this week");
    expect(renderCard({ boardMessagesThisWeek: 1 }).container.textContent).toContain(
      "1 board message this week"
    );
    expect(renderCard({ boardMessagesThisWeek: 0 }).container.textContent).not.toContain(
      "board message"
    );
    expect(renderCard({ boardMessagesThisWeek: undefined }).container.textContent).not.toContain(
      "board message"
    );
  });

  it("leaves out what the realm lacks: banner image, description, tags, thumbnail", () => {
    const { container } = renderCard({ bannerUrl: null, description: null, tags: [] });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
    expect(container.querySelector("li")).not.toHaveTextContent("A modern world");
  });

  it("shows the realm's thumbnail in the avatar", () => {
    const { container } = renderCard({
      bannerUrl: null,
      thumbnail: "https://img.example/thumb.png",
    });
    expect(container.querySelector("img")).toHaveAttribute("src", "https://img.example/thumb.png");
  });

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

  it("describes the board's activity, or its absence", () => {
    const { container, unmount } = renderCard({ board: { recentPosts: 0, lastPostAt: null } });
    expect(container.querySelector("li")).toHaveTextContent("No posts yet");
    unmount();
    const week = renderCard({ board: { recentPosts: 3, lastPostAt: null } });
    expect(week.container.querySelector("li")).toHaveTextContent("3 posts this week");
    expect(week.container.querySelector("li")).not.toHaveTextContent("last");
  });

  it("uses the singular for one nation", () => {
    const { container } = renderCard({
      nationCount: 1,
      openNationCount: 1,
      openNationPageCount: 0,
    });
    expect(container.querySelector("li")).toHaveTextContent("1 nation · 1 unclaimed");
    expect(container.querySelector("li")).not.toHaveTextContent("to claim");
  });
});
