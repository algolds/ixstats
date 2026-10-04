import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { Skeleton } from "~/components/ui/skeleton";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { Card, CardTitle, SurfaceReset } from "~/components/ui/card";

const classOf = (el: Element) => el.getAttribute("class") ?? "";

describe("Card", () => {
  it("renders the glass pane by default", () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId("card");
    const cls = classOf(card);
    expect(cls).toMatch(/\bfacet-pane\b/);
    expect(cls).toMatch(/\brounded-card\b/);
    expect(cls).not.toMatch(/backdrop-blur|material-|\bbg-surface\b/);
    expect(card).toHaveAttribute("data-variant", "pane");
    expect(card).not.toHaveAttribute("role");
  });

  it("applies the padding prop and lets className override the radius", () => {
    render(
      <Card data-testid="card" padding="md" className="rounded-2xl">
        Body
      </Card>
    );
    const cls = classOf(screen.getByTestId("card"));
    expect(cls).toContain("p-4");
    expect(cls).toContain("md:p-5");
    expect(cls).toContain("rounded-2xl");
    expect(cls).not.toContain("rounded-card");
  });

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

  it("sets data-content from the content prop", () => {
    render(
      <Card data-testid="card" content="data">
        x
      </Card>
    );
    expect(screen.getByTestId("card")).toHaveAttribute("data-content", "data");
  });

  it("CardTitle renders a tinted icon before the title", () => {
    render(<CardTitle icon={<svg data-testid="icon" />}>Budget</CardTitle>);
    const icon = screen.getByTestId("icon").parentElement!;
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(classOf(icon)).toContain("text-tint");
    expect(screen.getByText("Budget")).toBeInTheDocument();
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

describe("FacetMaterial", () => {
  it.each(["chrome", "overlay"] as const)(
    "maps %s to its layer utility and positions itself",
    (layer) => {
      render(
        <FacetMaterial data-testid="m" layer={layer}>
          x
        </FacetMaterial>
      );
      const cls = classOf(screen.getByTestId("m"));
      expect(cls).toContain(`facet-${layer}`);
      expect(cls).toContain("relative");
    }
  );

  it("defaults to chrome", () => {
    render(<FacetMaterial data-testid="m">x</FacetMaterial>);
    expect(classOf(screen.getByTestId("m"))).toContain("facet-chrome");
  });
});

describe("Skeleton, Eyebrow, Progress", () => {
  it("Skeleton is a fill-3 pulse that stops under reduced motion, with no blur", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.firstElementChild as HTMLElement;
    expect(classOf(el)).toContain("bg-fill-3");
    expect(classOf(el)).toContain("animate-pulse");
    expect(classOf(el)).toContain("motion-reduce:animate-none");
    expect(el.style.filter).toBe("");
    expect(el.style.willChange).toBe("");
  });

  it("Eyebrow uses the text-eyebrow style", () => {
    render(<Eyebrow>Population</Eyebrow>);
    const cls = classOf(screen.getByText("Population"));
    expect(cls).toContain("text-eyebrow");
    expect(cls).toContain("text-label-secondary");
  });

  it("Progress has a fill-2 track, tint indicator and exposes its value", () => {
    const { container, rerender } = render(<Progress value={40} aria-label="Done" />);
    const bar = screen.getByRole("progressbar", { name: "Done" });
    expect(classOf(bar)).toContain("bg-fill-2");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    const indicator = container.querySelector('[data-slot="progress-indicator"]')!;
    expect(classOf(indicator)).toContain("bg-tint");
    rerender(<Progress value={140} tone="destructive" aria-label="Done" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(classOf(container.querySelector('[data-slot="progress-indicator"]')!)).toContain(
      "bg-destructive"
    );
  });
});
