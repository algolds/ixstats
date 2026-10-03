import { render, screen } from "@testing-library/react";

jest.mock(
  "next/link",
  () =>
    ({ children }: { children: React.ReactNode }) =>
      children
);

import { IdentityPills } from "~/components/mycountry/shared/tabs/OverviewTab";

describe("MyCountry overview identity pills", () => {
  it("shows wiki infobox values as plain text, without their markup", () => {
    const { container } = render(
      <IdentityPills
        identity={
          {
            capitalCity: '<b>Vila Nova</b><div style="padding-top:0.5em;"></div>',
            demonym: "Pelaxian",
          } as React.ComponentProps<typeof IdentityPills>["identity"]
        }
      />
    );
    expect(screen.getByText("Vila Nova")).toBeInTheDocument();
    expect(screen.getByText("Pelaxian")).toBeInTheDocument();
    expect(container.textContent).not.toContain("<");
  });
});
