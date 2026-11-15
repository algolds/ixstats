/**
 * The MyLeague and MyClub browse cards: the whole card is one link, the facts are one quiet line, there is at most
 * one status chip, and a competition with no picture still has a cover (its monogram on the app tint).
 */
import { render, screen } from "@testing-library/react";
import {
  FeaturedLeagueCard,
  LeagueEntityCard,
  leagueFacts,
  type LeagueSummary,
} from "~/components/sports/browse/LeagueEntityCard";
import { ClubEntityCard, clubFacts } from "~/components/sports/browse/ClubEntityCard";
import { monogram } from "~/components/sports/monogram";

const league: LeagueSummary = {
  id: "l1",
  name: "Premier Liga of Ixnay",
  sportPreset: "soccer",
  archetype: "league",
  status: "active",
  isCanonical: true,
  coverImage: null,
  teamCount: 20,
  seasonCount: 1,
};

describe("monogram", () => {
  it("takes up to three initials and skips joining words", () => {
    expect(monogram("Premier Liga of Ixnay")).toBe("PLI");
    expect(monogram("The Imperial Hockey Association League")).toBe("IHA");
  });

  it("uses two letters of a one-word name, and survives a name of joiners only", () => {
    expect(monogram("Bundesliga")).toBe("BU");
    expect(monogram("The")).toBe("TH");
    expect(monogram("")).toBe("");
  });
});

describe("league browse card", () => {
  it("writes the facts as one line with singular and plural counts", () => {
    expect(leagueFacts(league)).toBe("Soccer · League · 20 teams · 1 season");
    expect(leagueFacts({ ...league, isCanonical: false, seasonCount: 2 })).toBe(
      "Soccer · League · 20 teams · 2 seasons · Community made"
    );
  });

  it("is one link to the league, with one status chip and the invite button", () => {
    const { container } = render(<LeagueEntityCard league={league} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/myleague/l1");
    expect(links[0]).toHaveTextContent("Premier Liga of Ixnay");
    expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeInTheDocument();
    expect(container.querySelector('[data-content="entity"]')).not.toBeNull();
  });

  it("always paints a cover: the monogram under any picture", () => {
    const { container } = render(<LeagueEntityCard league={league} />);
    const cover = container.querySelector('[data-slot="league-cover"]');
    expect(cover).toHaveTextContent("PLI");
    expect(cover).toHaveClass("bg-tint-fill");
  });

  it("centres a logo on the tint when there is no cover photo, and drops the monogram", () => {
    const { container } = render(
      <LeagueEntityCard league={{ ...league, logo: "/logos/pli.png" }} />
    );
    const cover = container.querySelector('[data-slot="league-cover"]');
    expect(cover?.querySelector("img")).toHaveClass("object-contain");
    expect(cover).not.toHaveTextContent("PLI");
  });

  it("features a competition as a link with its name as the heading", () => {
    render(<FeaturedLeagueCard league={league} />);
    expect(screen.getByRole("heading", { level: 3, name: "Premier Liga of Ixnay" })).toBeVisible();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/myleague/l1");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("club browse card", () => {
  const club = {
    id: "t1",
    name: "Venceia FC",
    color: "#aa0000",
    stadiumCapacity: 42000,
    league: { name: "Premier Liga" },
    currentStandings: { position: 2, wins: 5, losses: 1, draws: 2 },
    form: ["W", "D", "L"],
  };

  it("writes position, record and stadium as one line", () => {
    expect(clubFacts(club)).toBe(`2nd place · 5-1-2 · ${(42000).toLocaleString()} seats`);
    expect(clubFacts({ id: "t2", name: "New" })).toBe(`${(5000).toLocaleString()} seats`);
    expect(clubFacts({ ...club, currentStandings: { position: 11, wins: 0, losses: 3 } })).toBe(
      `11th place · 0-3 · ${(42000).toLocaleString()} seats`
    );
  });

  it("links the card to the club and keeps the roster shortcut, with no buttons", () => {
    render(<ClubEntityCard club={club} />);
    expect(screen.getByRole("link", { name: "Venceia FC" })).toHaveAttribute("href", "/myclub/t1");
    expect(screen.getByRole("link", { name: "Roster" })).toHaveAttribute(
      "href",
      "/myclub/t1?tab=roster"
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("list", { name: "Recent form, latest first" })).toBeInTheDocument();
  });

  it("says so when no match has been played", () => {
    render(<ClubEntityCard club={{ id: "t2", name: "New" }} />);
    expect(screen.getByText("No matches played")).toBeInTheDocument();
  });
});
