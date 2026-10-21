import "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Signal } from "~/components/ui/signal";
const reveal = jest.fn();
jest.mock("~/lib/sound/cuelume", () => ({
  soundCues: { reveal: () => reveal() },
  soundEffects: {},
}));

let wide = true;
jest.mock("~/hooks/useMediaQuery", () => ({ useMediaQuery: () => wide }));
describe("Signal", () => {
  it("is a status banner that dismisses", () => {
    const onDismiss = jest.fn();
    render(
      <Signal tone="warning" title="Budget deficit" onDismiss={onDismiss}>
        Spending exceeds revenue.
      </Signal>
    );
    const signal = screen.getByRole("status");
    expect(signal).toHaveAttribute("data-content", "signal");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });
  it("uses role=alert for destructive and has no dismiss without onDismiss", () => {
    render(<Signal tone="destructive" title="Crisis" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
