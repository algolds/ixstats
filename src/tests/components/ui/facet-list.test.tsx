import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
describe("FacetList / FacetListSection / FacetRow", () => {
  it("renders sections as labelled lists with header and footer outside the group", () => {
    render(
      <FacetList>
        <FacetListSection header="Account" footer="Shown on your profile.">
          <FacetRow title="Name" trailing="Ada" />
          <FacetRow title="Email" subtitle="Primary" trailing="ada@example.com" />
        </FacetListSection>
      </FacetList>
    );

    const list = screen.getByRole("list", { name: "Account" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveAccessibleDescription("Shown on your profile.");
    // Header and footer are siblings of the group, not inside it.
    expect(within(list).queryByText("Account")).toBeNull();
    expect(within(list).queryByText("Shown on your profile.")).toBeNull();
    expect(screen.getByText("Account").className).toContain("text-subhead");
    expect(screen.getByText("Shown on your profile.").className).toContain("text-footnote");
    // Trailing text values are secondary and tabular.
    expect(screen.getByText("Ada").className).toContain("tabular-nums");
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("uses an aria-label for a section without a visible header", () => {
    render(
      <FacetListSection aria-label="Filters">
        <FacetRow title="One" />
      </FacetListSection>
    );
    expect(screen.getByRole("list", { name: "Filters" })).toBeInTheDocument();
  });
  it("marks the selected link row as the current page", () => {
    render(
      <FacetListSection header="Nav">
        <FacetRow href="/a" title="A" selected />
        <FacetRow href="/b" title="B" />
      </FacetListSection>
    );
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "B" })).not.toHaveAttribute("aria-current");
  });

  it("renders onClick rows as buttons that respond to activation", () => {
    const onClick = jest.fn();
    render(
      <FacetListSection header="Actions">
        <FacetRow title="Sign out" destructive onClick={onClick} />
      </FacetListSection>
    );
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Sign out").className).toContain("text-destructive");
  });

  it("disables a button row", () => {
    const onClick = jest.fn();
    render(
      <FacetListSection header="Actions">
        <FacetRow title="Export" disabled onClick={onClick} />
      </FacetListSection>
    );
    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a disabled href row as a non-link", () => {
    render(
      <FacetListSection header="Nav">
        <FacetRow href="/locked" title="Locked" disabled />
      </FacetListSection>
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Locked").closest('[data-slot="facet-row"]')).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("shows the check accessory only when selected and exposes the state", () => {
    render(
      <FacetListSection header="Period">
        <FacetRow title="Week" accessory="check" selected onClick={() => {}} />
        <FacetRow title="Month" accessory="check" onClick={() => {}} />
      </FacetListSection>
    );
    const week = screen.getByRole("button", { name: "Week" });
    const month = screen.getByRole("button", { name: "Month" });
    expect(week).toHaveAttribute("aria-pressed", "true");
    expect(month).toHaveAttribute("aria-pressed", "false");
    const weekCheck = week.querySelector('[data-slot="facet-row-check"]')!;
    const monthCheck = month.querySelector('[data-slot="facet-row-check"]')!;
    expect(weekCheck.getAttribute("class")).not.toContain("invisible");
    expect(monthCheck.getAttribute("class")).toContain("invisible");
  });

  it("renders static rows without interactive roles", () => {
    render(
      <FacetListSection header="Info">
        <FacetRow title="Version" trailing="3.0.0" accessory="none" />
      </FacetListSection>
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Version").closest("svg")).toBeNull();
  });
});
