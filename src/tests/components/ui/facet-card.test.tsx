import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FacetModal, FacetNavigation, resolveFacetSurface } from "~/components/ui/facet-container";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { Skeleton } from "~/components/ui/skeleton";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Progress } from "~/components/ui/progress";
import { Card } from "~/components/ui/card";

const classOf = (el: Element) => el.getAttribute("class") ?? "";

describe("FacetCard (opaque content card)", () => {
  it("renders the opaque surface and never a glass depth class", () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId("card");
    const cls = classOf(card);
    expect(cls).toMatch(/\bbg-surface\b/);
    expect(cls).toMatch(/\bborder-separator\b/);
    expect(cls).toMatch(/\brounded-card\b/);
    expect(cls).toMatch(/\bshadow-card\b/);
    expect(cls).not.toMatch(/facet-depth-|backdrop-blur|material-/);
    // Deprecated theme colours are ignored.
    expect(cls).not.toContain("emerald");
    // Not clickable → no button semantics.
    expect(card).not.toHaveAttribute("role");
    expect(card).not.toHaveAttribute("tabindex");
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

  it("is pressable with onClick: button role, focusable, Enter/Space activate", () => {
    const onClick = jest.fn();
    render(
      <Card data-testid="card" onClick={onClick} interactive>
        Open
      </Card>
    );
    const card = screen.getByRole("button", { name: "Open" });
    expect(card).toHaveAttribute("tabindex", "0");
    // Facet 3.1 press (.99) and hover lift, both off under Reduce Motion.
    expect(classOf(card)).toContain("facet-press");
    expect(classOf(card)).toContain("facet-press-subtle");
    expect(classOf(card)).toContain("facet-lift");
    expect(classOf(card)).toContain("focus-visible:outline-tint");
    expect(classOf(card)).toContain(
      "hover:bg-[image:linear-gradient(var(--color-fill-4),var(--color-fill-4))]"
    );
    fireEvent.click(card);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);
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

  it("gives interactive=hover a hover wash without button semantics", () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId("card");
    expect(classOf(card)).toContain("hover:bg-[image:");
    expect(card).not.toHaveAttribute("role");
  });

  it("keeps a caller-supplied role", () => {
    render(
      <Card role="region" aria-label="Summary">
        Body
      </Card>
    );
    expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument();
  });

  it("renders a texture overlay when asked", () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.querySelector(".facet-texture-dots")).not.toBeNull();
  });
});

describe("FacetContainer (deprecated) back-compat mapping", () => {
  it.each([
    [{ depth: 1 as const }, "card"],
    [{ depth: 2 as const }, "card"],
    [{ depth: 3 as const }, "card"],
    [{ depth: 4 as const }, "thick"],
    [{ depth: "modal" as const }, "thick"],
    [{ depth: 4 as const, surface: "solid" as const }, "card"],
    [{ surface: "solid" as const }, "card"],
    [{}, "card"],
    [{ material: "thin" as const, depth: 2 as const }, "thin"],
    [{ material: "regular" as const, surface: "solid" as const }, "regular"],
  ])("resolves %j to %s", (props, expected) => {
    expect(resolveFacetSurface(props)).toBe(expected);
  });

  it("renders depth 1–3 as the opaque card", () => {
    render(<Card data-testid="c">x</Card>);
    const cls = classOf(screen.getByTestId("c"));
    expect(cls).toContain("bg-surface");
    expect(cls).not.toMatch(/facet-depth-|material-/);
  });

  it("renders depth 4 and explicit materials as glass", () => {
    render(
      <>
        <Card data-testid="d4">x</Card>
        <Card data-testid="thin" material="thin">
          x
        </Card>
      </>
    );
    expect(classOf(screen.getByTestId("d4"))).toContain("material-thick");
    expect(classOf(screen.getByTestId("d4"))).not.toContain("bg-surface");
    expect(classOf(screen.getByTestId("thin"))).toContain("material-thin");
  });

  it("no longer cycles depth on click", () => {
    const onClick = jest.fn();
    render(
      <Card data-testid="c" interactive onClick={onClick}>
        x
      </Card>
    );
    const el = screen.getByTestId("c");
    const before = classOf(el);
    fireEvent.click(el);
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(classOf(el)).toBe(before);
    expect(el.getAttribute("style") ?? "").not.toContain("--facet-depth");
  });

  it("maps FacetModal to thick glass and FacetNavigation to regular glass", () => {
    render(
      <>
        <FacetModal data-testid="modal">x</FacetModal>
        <FacetNavigation data-testid="nav">x</FacetNavigation>
      </>
    );
    expect(classOf(screen.getByTestId("modal"))).toContain("material-thick");
    expect(classOf(screen.getByTestId("nav"))).toContain("material-regular");
  });
});

describe("FacetMaterial", () => {
  it("maps glass names to the material utilities and positions itself", () => {
    render(
      <FacetMaterial data-testid="m" material="thin">
        x
      </FacetMaterial>
    );
    const cls = classOf(screen.getByTestId("m"));
    expect(cls).toContain("material-thin");
    expect(cls).toContain("relative");
  });

  it("renders the deprecated satin value as regular glass", () => {
    render(
      <FacetMaterial data-testid="m" material="regular">
        x
      </FacetMaterial>
    );
    const cls = classOf(screen.getByTestId("m"));
    expect(cls).toContain("material-regular");
    expect(cls).not.toContain("facet-material-satin");
  });

  it("attaches pointer listeners through a callback ref", () => {
    let node: HTMLDivElement | null = null;
    const raf = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
    render(
      <FacetMaterial
        data-testid="m"
        material="paper"
        ref={(el) => {
          node = el;
        }}
      >
        x
      </FacetMaterial>
    );
    const el = screen.getByTestId("m");
    expect(node).toBe(el);
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
      }) as DOMRect;
    // jsdom's PointerEvent drops clientX/Y; a MouseEvent of the same type carries them.
    fireEvent(el, new MouseEvent("pointermove", { clientX: 25, clientY: 75, bubbles: true }));
    expect(el.style.getPropertyValue("--pointer-x")).toBe("25.00%");
    expect(el.style.getPropertyValue("--pointer-y")).toBe("75.00%");
    raf.mockRestore();
  });

  it("does not re-seed pointer vars on re-render", () => {
    const { rerender } = render(
      <FacetMaterial data-testid="m" material="paper">
        x
      </FacetMaterial>
    );
    const el = screen.getByTestId("m");
    el.style.setProperty("--pointer-x", "10%");
    rerender(
      <FacetMaterial data-testid="m" material="paper">
        y
      </FacetMaterial>
    );
    expect(el.style.getPropertyValue("--pointer-x")).toBe("10%");
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
