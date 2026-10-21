/** The two homes of the Lorewards view: the WikiOS page (contest focus) and the Vault tab (you focus). */
import React from "react";
import { render, screen } from "@testing-library/react";

let mockQuery = "";
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockQuery),
}));
jest.mock("~/components/lorewards/LorewardsView", () => ({
  LorewardsView: (props: { focus: string; highlightCardId?: string; username?: string }) => (
    <div
      data-testid="view"
      data-focus={props.focus}
      data-highlight={props.highlightCardId ?? ""}
      data-username={props.username ?? ""}
    />
  ),
}));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <main aria-label={title}>{children}</main>
  ),
}));

import LorewardsPage from "~/app/(wiki-os)/util/lorewards/page";
import { VaultLorewardsPanel } from "~/components/vault/sections/VaultLorewardsPanel";

describe("/util/lorewards", () => {
  it("is a real page rendering the contest focus, not a redirect to the passport", async () => {
    render(await LorewardsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("main", { name: "Lorewards" })).toBeInTheDocument();
    expect(screen.getByTestId("view")).toHaveAttribute("data-focus", "contest");
    expect(screen.getByTestId("view")).toHaveAttribute("data-username", "");
  });

  it("opens on a winner's trophies, and the card the article badge linked to, for ?user= and ?card=", async () => {
    render(
      await LorewardsPage({ searchParams: Promise.resolve({ user: "Ada", card: ["card2", "x"] }) })
    );

    expect(screen.getByTestId("view")).toHaveAttribute("data-username", "Ada");
    expect(screen.getByTestId("view")).toHaveAttribute("data-highlight", "card2");
  });
});

describe("the Vault Lorewards tab", () => {
  it("renders the you focus", () => {
    mockQuery = "tab=lorewards";
    render(<VaultLorewardsPanel />);
    expect(screen.getByTestId("view")).toHaveAttribute("data-focus", "you");
    expect(screen.getByTestId("view")).toHaveAttribute("data-highlight", "");
  });

  it("marks the trophy card ?trophy= names, leaving ?card= to the card sheet", () => {
    mockQuery = "tab=lorewards&trophy=card2&card=card9";
    render(<VaultLorewardsPanel />);
    expect(screen.getByTestId("view")).toHaveAttribute("data-highlight", "card2");
  });

  it("still marks the trophy card of an older ?card= link", () => {
    mockQuery = "tab=lorewards&card=card2";
    render(<VaultLorewardsPanel />);
    expect(screen.getByTestId("view")).toHaveAttribute("data-highlight", "card2");
  });
});
