import "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Card, SurfaceReset } from "~/components/ui/card";

const classOf = (el: Element) => el.getAttribute("class") ?? "";

describe("Card", () => {
  it("a Card inside a Card is a well; an explicit variant wins", () => {
    render(
      <Card data-testid="outer">
        <Card data-testid="inner">
          <Card data-testid="deeper">x</Card>
        </Card>
        <Card data-testid="forced" variant="pane">
          y
        </Card>
      </Card>
    );
    const inner = screen.getByTestId("inner");
    expect(inner).toHaveAttribute("data-variant", "well");
    expect(classOf(inner)).toMatch(/\bfacet-well\b/);
    expect(classOf(inner)).toMatch(/\brounded-row\b/);
    expect(classOf(inner)).toContain("p-4");
    expect(classOf(inner)).not.toMatch(/facet-pane|shadow-card/);
    expect(screen.getByTestId("deeper")).toHaveAttribute("data-variant", "well");
    expect(screen.getByTestId("forced")).toHaveAttribute("data-variant", "pane");
  });

  it("starts a fresh pane inside an overlay", () => {
    render(
      <Card data-testid="outer">
        <SurfaceReset>
          <Card data-testid="in-overlay">x</Card>
        </SurfaceReset>
      </Card>
    );
    expect(screen.getByTestId("in-overlay")).toHaveAttribute("data-variant", "pane");
  });
  it("is pressable when interactive with onClick: button role, Enter/Space activate", () => {
    const onClick = jest.fn();
    render(
      <Card onClick={onClick} interactive>
        Open
      </Card>
    );
    const card = screen.getByRole("button", { name: "Open" });
    expect(card).toHaveAttribute("tabindex", "0");
    expect(classOf(card)).toContain("facet-press");
    expect(classOf(card)).toContain("focus-visible:outline-tint");
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("has no button semantics without interactive", () => {
    render(
      <Card data-testid="card" onClick={jest.fn()}>
        Body
      </Card>
    );
    expect(screen.getByTestId("card")).not.toHaveAttribute("role");
  });

  it("does not double-activate when the caller handles the key itself", () => {
    const onClick = jest.fn();
    render(
      <Card
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onClick();
          }
        }}
        interactive
      >
        Open
      </Card>
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a caller-supplied role", () => {
    render(
      <Card role="region" aria-label="Summary">
        Body
      </Card>
    );
    expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument();
  });
});
