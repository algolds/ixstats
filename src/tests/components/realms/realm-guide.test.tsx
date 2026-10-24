import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { RealmGuide } from "~/app/realms/_components/RealmGuide";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("RealmGuide", () => {
  it("walks through the three steps in order", () => {
    render(<RealmGuide />);
    expect(screen.getByRole("heading", { name: "Realm guide" })).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(steps).toEqual(["Pick your region", "Claim your nation", "Govern and post"]);
  });

  it("links to the full help article", () => {
    render(<RealmGuide />);
    expect(screen.getByRole("link", { name: "Read the full guide" })).toHaveAttribute(
      "href",
      "/help/world/realms"
    );
  });
});
