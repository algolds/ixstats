/**
 * Facet 3 selection primitives added for the admin Phase 4 leftovers: FacetRow tint selection,
 * RadioCardGroup/RadioCard, StepIndicator, the Facet 3 Table and Slider thumb naming.
 */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { StepIndicator } from "~/components/ui/step-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";

const classOf = (el: Element | null) => el?.getAttribute("class") ?? "";

describe('FacetRow selectionStyle="tint"', () => {
  it("marks the current master–detail row with tint-fill and aria-current", () => {
    const onClick = jest.fn();
    render(
      <FacetListSection aria-label="Jobs">
        <FacetRow title="Auctions" selected selectionStyle="tint" onClick={onClick} />
        <FacetRow title="Income" selectionStyle="tint" onClick={onClick} />
      </FacetListSection>
    );
    const current = screen.getByRole("button", { name: "Auctions" });
    const other = screen.getByRole("button", { name: "Income" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(other).not.toHaveAttribute("aria-current");
    expect(classOf(current)).toContain("bg-tint-fill");
    expect(classOf(current)).not.toContain("bg-fill-3");
    expect(current).not.toHaveAttribute("aria-pressed");
    fireEvent.click(other);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps aria-pressed (not aria-current) for tint check toggles", () => {
    render(
      <FacetListSection aria-label="Countries">
        <FacetRow
          title="Ixnay"
          selected
          selectionStyle="tint"
          accessory="check"
          onClick={() => {}}
        />
      </FacetListSection>
    );
    const row = screen.getByRole("button", { name: "Ixnay" });
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(row).not.toHaveAttribute("aria-current");
  });

  it("leaves the default fill selection unchanged and honours an explicit aria-current", () => {
    render(
      <FacetListSection aria-label="Rows">
        <FacetRow title="Default" selected onClick={() => {}} />
        <FacetRow title="Explicit" aria-current="location" onClick={() => {}} />
      </FacetListSection>
    );
    const plain = screen.getByRole("button", { name: "Default" });
    expect(classOf(plain)).toContain("bg-fill-3");
    expect(plain).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Explicit" })).toHaveAttribute(
      "aria-current",
      "location"
    );
  });
});

describe("RadioCardGroup / RadioCard", () => {
  function Harness({ initial = "b" }: { initial?: string | null }) {
    const [value, setValue] = useState<string | null>(initial);
    return (
      <>
        <RadioCardGroup aria-label="Mode" value={value} onValueChange={setValue} columns={3}>
          <RadioCard value="a" title="Alert" description="Everyone" />
          <RadioCard value="b" title="System" />
          <RadioCard value="c" title="Direct" disabled />
          <RadioCard value="d" title="Digest" />
        </RadioCardGroup>
        <output data-testid="value">{value ?? "none"}</output>
      </>
    );
  }

  it("is a named radiogroup of radios with one roving tab stop on the checked card", () => {
    render(<Harness />);
    expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const checked = screen.getByRole("radio", { name: /System/ });
    expect(checked).toHaveAttribute("aria-checked", "true");
    expect(checked).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /Alert/ })).toHaveAttribute("tabindex", "-1");
    // Tint selection ring + fill on the checked card only.
    expect(classOf(checked)).toContain("bg-tint-fill");
    expect(classOf(checked)).toContain("ring-tint");
    expect(classOf(screen.getByRole("radio", { name: /Alert/ }))).not.toContain("ring-tint");
  });

  it("selects on click and moves selection with the arrow keys, skipping disabled cards", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: /Alert/ }));
    expect(screen.getByTestId("value")).toHaveTextContent("a");

    const alert = screen.getByRole("radio", { name: /Alert/ });
    alert.focus();
    fireEvent.keyDown(alert, { key: "ArrowRight" });
    expect(screen.getByTestId("value")).toHaveTextContent("b");
    const system = screen.getByRole("radio", { name: /System/ });
    expect(system).toHaveFocus();

    fireEvent.keyDown(system, { key: "ArrowDown" });
    // "Direct" is disabled, so the next radio is "Digest".
    expect(screen.getByTestId("value")).toHaveTextContent("d");

    fireEvent.keyDown(screen.getByRole("radio", { name: /Digest/ }), { key: "ArrowRight" });
    expect(screen.getByTestId("value")).toHaveTextContent("a"); // wraps

    fireEvent.keyDown(screen.getByRole("radio", { name: /Alert/ }), { key: "End" });
    expect(screen.getByTestId("value")).toHaveTextContent("d");
  });

  it("stays controlled with nothing checked when value is null", () => {
    render(<Harness initial={null} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
    // The first enabled card is the tab stop.
    expect(screen.getByRole("radio", { name: /Alert/ })).toHaveAttribute("tabindex", "0");
  });
});

describe("StepIndicator", () => {
  const steps = [
    { id: "type", label: "Type" },
    { id: "scope", label: "Scope" },
    { id: "confirm", label: "Confirm" },
  ];

  it("marks the current step with aria-current=step inside a named nav", () => {
    render(<StepIndicator aria-label="Wizard progress" steps={steps} current={1} />);
    const nav = screen.getByRole("navigation", { name: "Wizard progress" });
    expect(nav.querySelectorAll("li")).toHaveLength(3);
    const current = nav.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("Scope");
    expect(screen.getByText(/\(completed\)/).closest("li")).toHaveTextContent("Type");
    // Without onStepClick nothing is a button.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("makes completed steps buttons when onStepClick is set; future steps stay text", () => {
    const onStepClick = jest.fn();
    render(<StepIndicator steps={steps} current={1} onStepClick={onStepClick} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it('lets navigable="all" jump forward too', () => {
    render(<StepIndicator steps={steps} current={0} onStepClick={() => {}} navigable="all" />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("Table (Facet 3)", () => {
  function Example({ sticky = false }: { sticky?: boolean }) {
    return (
      <Table containerClassName="max-h-40">
        <TableHeader sticky={sticky}>
          <TableRow>
            <TableHead>Country</TableHead>
            <TableHead>GDP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>Ixnay</TableCell>
            <TableCell>1,234</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  it("is an opaque surface with separator hairlines and no v2 classes or gradients", () => {
    const { container } = render(<Example />);
    const outer = container.querySelector('[data-slot="table-container"]')!;
    const cls = classOf(outer);
    expect(cls).toContain("bg-surface");
    expect(cls).toContain("border-separator");
    expect(cls).toContain("rounded-card");
    expect(cls).toContain("max-h-40");
    expect(container.innerHTML).not.toMatch(/bg-gradient|border-border\/50|bg-background\/50/);
    // The scroll hint is a mask on the scroller, not an overlay element.
    expect(classOf(container.querySelector('[data-slot="table-scroll"]'))).toContain("mask-image");
  });

  it("uses footnote/label-secondary headers, callout tabular cells, tint-fill selection", () => {
    render(<Example />);
    const head = screen.getByRole("columnheader", { name: "Country" });
    expect(classOf(head)).toContain("text-footnote");
    expect(classOf(head)).toContain("text-label-secondary");
    const cell = screen.getByRole("cell", { name: "1,234" });
    expect(classOf(cell)).toContain("text-callout");
    expect(classOf(cell)).toContain("tabular-nums");
    const row = cell.closest("tr")!;
    expect(classOf(row)).toContain("hover:bg-fill-4");
    expect(classOf(row)).toContain("data-[state=selected]:bg-tint-fill");
  });

  it("pins header cells only when the header is sticky", () => {
    const { container, rerender } = render(<Example />);
    const thead = () => container.querySelector("thead")!;
    expect(classOf(thead())).not.toContain("[&_th]:sticky");
    rerender(<Example sticky />);
    expect(classOf(thead())).toContain("[&_th]:sticky");
    expect(classOf(thead())).toContain("[&_th]:bg-surface");
  });

  it("drops its own surface inside a card (the card is the surface)", () => {
    const { container } = render(
      <Card>
        <Example />
      </Card>
    );
    const cls = classOf(container.querySelector('[data-slot="table-container"]'));
    expect(cls).toContain("in-data-[slot=card]:border-0");
    expect(cls).toContain("in-data-[slot=facet-card]:bg-transparent");
  });
});

describe("Slider naming", () => {
  beforeAll(() => {
    // Radix Slider measures its thumbs; jsdom has no ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("puts aria-label / aria-labelledby on the thumb, the element with role=slider", () => {
    render(
      <>
        <span id="temp-label">Temperature</span>
        <Slider aria-labelledby="temp-label" min={0} max={2} step={0.1} value={[0.7]} />
        <Slider aria-label="Speed" min={0} max={5} value={[1]} />
      </>
    );
    expect(screen.getByRole("slider", { name: "Temperature" })).toHaveAttribute(
      "aria-valuenow",
      "0.7"
    );
    expect(screen.getByRole("slider", { name: "Speed" })).toBeInTheDocument();
  });
});
