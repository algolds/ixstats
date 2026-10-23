import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { RealmsHeader } from "~/app/realms/_components/RealmsHeader";
import type { DirectoryRealm } from "~/app/realms/_components/realm-directory";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const NEWCOMER = "Worlds with their own nations, boards and lore. Claim a nation and play.";

function realm(slug: string, nationCount: number, open: number): DirectoryRealm {
  return { slug, nationCount, openNationCount: open - 2, openNationPageCount: 2 } as DirectoryRealm;
}

const realms = [realm("ixnay", 200, 190), realm("eurth", 80, 72)];

describe("RealmsHeader", () => {
  it("signed out: newcomer line and sign in", () => {
    render(<RealmsHeader realms={realms} standing="signed-out" />);
    expect(screen.getByText(NEWCOMER)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to play" }).getAttribute("href")).toContain(
      "redirect_url="
    );
  });

  it("no nation: Join a realm to the atlas", () => {
    render(<RealmsHeader realms={realms} standing="no-nation" />);
    expect(screen.getByRole("link", { name: "Join a realm" })).toHaveAttribute("href", "#atlas");
    expect(screen.getByText(NEWCOMER)).toBeInTheDocument();
  });

  it("holder: Join another realm, no newcomer line", () => {
    render(<RealmsHeader realms={realms} standing="holds-nations" />);
    expect(screen.getByRole("link", { name: "Join another realm" })).toHaveAttribute(
      "href",
      "#atlas"
    );
    expect(screen.queryByText(NEWCOMER)).not.toBeInTheDocument();
  });

  it("counts line", () => {
    render(<RealmsHeader realms={realms} standing="no-nation" />);
    expect(screen.getByText("2 realms · 280 nations · 262 open")).toBeInTheDocument();
  });
});
