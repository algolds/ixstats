/** The Passport's Lorewards modal shows the shared Lorewards view instead of a copy of its own. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/lorewards/LorewardsView", () => ({
  LorewardsView: (props: { focus: string; username?: string }) => (
    <div data-testid="view" data-focus={props.focus} data-username={props.username ?? ""} />
  ),
}));

import { PassportLorewardsModal } from "~/components/passport/modals/PassportLorewardsModal";

describe("PassportLorewardsModal", () => {
  it("renders the shared view with the you focus for the passport owner's wiki name", () => {
    render(
      <PassportLorewardsModal
        open
        onOpenChange={jest.fn()}
        handle="alex"
        wiki={{ username: "Ada" } as never}
      />
    );

    expect(screen.getByRole("dialog", { name: "Lorewards accolades" })).toBeInTheDocument();
    const view = screen.getByTestId("view");
    expect(view).toHaveAttribute("data-focus", "you");
    expect(view).toHaveAttribute("data-username", "Ada");
  });

  it("falls back to the passport handle when no wiki account is linked", () => {
    render(<PassportLorewardsModal open onOpenChange={jest.fn()} handle="alex" />);
    expect(screen.getByTestId("view")).toHaveAttribute("data-username", "alex");
  });

  it("links to the owner's wiki contributions", () => {
    render(<PassportLorewardsModal open onOpenChange={jest.fn()} handle="alex" />);
    expect(screen.getByRole("link", { name: /wiki contributions/i })).toHaveAttribute(
      "href",
      "/util/contributions/alex"
    );
  });
});
