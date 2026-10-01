import React from "react";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "~/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders icon, title, message and a single action", () => {
    render(
      <EmptyState
        icon={<svg data-testid="icon" />}
        title="No drafts"
        message="Drafts you save appear here."
        action={<button type="button">New draft</button>}
      />
    );
    expect(screen.getByText("No drafts").className).toContain("text-title-3");
    const message = screen.getByText("Drafts you save appear here.");
    expect(message.className).toContain("text-callout");
    expect(message.className).toContain("text-label-secondary");
    expect(screen.getByRole("button", { name: "New draft" })).toBeInTheDocument();
    const iconWrap = screen.getByTestId("icon").parentElement!;
    expect(iconWrap).toHaveAttribute("aria-hidden");
    expect(iconWrap.className).toContain("text-label-secondary");
    expect(iconWrap.className).toContain("size-10");
  });

  it("has a compact variant for use inside cards", () => {
    const { container } = render(
      <EmptyState compact icon={<svg data-testid="icon" />} title="Nothing here" />
    );
    const root = container.firstElementChild!;
    expect(root.className).toContain("py-6");
    expect(screen.getByTestId("icon").parentElement!.className).toContain("size-8");
  });

  it("omits optional parts", () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('[data-slot="empty-state-icon"]')).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
