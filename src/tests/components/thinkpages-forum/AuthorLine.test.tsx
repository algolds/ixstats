import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/thinkpages/PersonaAuthorCard", () => ({
  PersonaAuthorCard: ({ username, children }: { username: string; children: React.ReactNode }) => (
    <span data-testid="persona-card" data-username={username}>
      {children}
    </span>
  ),
}));

import { AuthorLine } from "~/components/thinkpages-forum/AuthorMark";

describe("AuthorLine", () => {
  it.each([
    ["government", "Government"],
    ["media", "Media"],
    ["citizen", "Citizen"],
  ] as const)(
    "gives a %s persona a neutral %s chip, its hover card and @username, never a flag",
    (type, label) => {
      const { container } = render(
        <AuthorLine
          name="Caphiria News"
          personaUsername="caphnews"
          personaType={type}
          flagUrl={null}
        />
      );
      const chip = screen.getByText(label).closest('[data-slot="badge"]');
      expect(chip).toHaveClass("bg-fill-3", "text-label-secondary");
      expect(screen.getByTestId("persona-card")).toHaveAttribute("data-username", "caphnews");
      expect(screen.getByText("@caphnews")).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    }
  );

  it("names a deleted persona without a chip, card or flag", () => {
    const { container } = render(<AuthorLine name="Persona" personaType={null} flagUrl={null} />);
    expect(screen.getByText("Persona")).toBeInTheDocument();
    expect(screen.queryByTestId("persona-card")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
