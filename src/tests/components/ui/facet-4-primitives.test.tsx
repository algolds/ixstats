/**
 * Facet status primitives: the live-region role each tone announces with (polite status, assertive alert), a
 * dismiss only when there is somewhere to dismiss to, deltas that never rely on colour alone, and the IxCredits
 * symbol's accessible name.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { Alert } from "~/components/ui/alert";
import { Signal } from "~/components/ui/signal";
import { Stat } from "~/components/ui/stat";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";

describe("live-region roles", () => {
  it.each([
    ["Alert info", <Alert variant="info" data-testid="s" />, "status"],
    ["Alert success", <Alert variant="success" data-testid="s" />, "status"],
    ["Alert caution", <Alert variant="caution" data-testid="s" />, "alert"],
    ["Alert destructive", <Alert variant="destructive" data-testid="s" />, "alert"],
    ["Alert default", <Alert data-testid="s" />, "alert"],
    ["Alert with a caller's role", <Alert variant="warning" role="note" data-testid="s" />, "note"],
    ["Signal warning", <Signal tone="warning" title="Budget deficit" data-testid="s" />, "status"],
    ["Signal destructive", <Signal tone="destructive" title="Crisis" data-testid="s" />, "alert"],
  ])("%s announces as %s", (_name, ui, role) => {
    render(ui);
    expect(screen.getByRole(role)).toBeInTheDocument();
  });

  it("a Signal offers Dismiss only with onDismiss, and reports it", () => {
    const onDismiss = jest.fn();
    const { rerender } = render(<Signal tone="warning" title="Budget deficit" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
    rerender(<Signal tone="warning" title="Budget deficit" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Stat", () => {
  it.each([
    ["up", "Up"],
    ["down", "Down"],
    ["neutral", "No change"],
  ] as const)("pairs a %s delta with a hidden icon and words, never colour alone", (direction, words) => {
    const { container } = render(
      <Stat label="Growth" value="3%" delta={{ value: "0.4 pts", direction }} />
    );
    const delta = container.querySelector('[data-slot="stat-delta"]')!;
    expect(delta.querySelector("svg")).toHaveAttribute("aria-hidden");
    expect(delta.textContent).toContain(words);
    expect(delta.textContent).toContain("0.4 pts");
  });
});

describe("IxCreditsSymbol", () => {
  it("is an image named IxCredits by default, and hidden when decorative or aria-hidden", () => {
    const { rerender } = render(<IxCreditsSymbol data-testid="ixc" />);
    expect(screen.getByRole("img", { name: "IxCredits" })).toBe(screen.getByTestId("ixc"));
    for (const ui of [<IxCreditsSymbol decorative data-testid="ixc" />, <IxCreditsSymbol aria-hidden data-testid="ixc" />]) {
      rerender(ui);
      const svg = screen.getByTestId("ixc");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).not.toHaveAttribute("role");
      expect(svg).not.toHaveAttribute("aria-label");
    }
  });
});
