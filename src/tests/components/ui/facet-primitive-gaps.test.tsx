/**
 * Facet 3 primitive gaps closed after the Phase 4 conversions: FacetCard inset + MotionFacetCard,
 * Stat icon slot, Badge system colours, ActionPill, SegmentedControl overflow, ToggleGroup
 * disallowEmpty, PopoverAnchor, FlagWatermark's new home.
 */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  FACET_CARD_SURFACE,
  FACET_INSET_SURFACE,
  FacetCard,
  MotionFacetCard,
} from "~/components/ui/facet-container";
import { Stat } from "~/components/ui/stat";
import { Badge, SYSTEM_TINTED, badgeVariants } from "~/components/ui/badge";
import { ActionPill } from "~/components/ui/action-pill";
import { SegmentedControl, MAX_SEGMENTS } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Popover, PopoverAnchor, PopoverContent } from "~/components/ui/popover";
import * as LegacyWatermark from "~/components/mycountry/shell/FlagWatermark";
import * as FacetIdentity from "~/components/ui/facet/identity/FlagWatermark";
import { SYSTEM_COLORS } from "~/lib/design/tokens";

const classOf = (el: Element) => el.getAttribute("class") ?? "";

describe('FacetCard variant="inset"', () => {
  it("is a surface-secondary rounded-row panel with 16px padding and no hairline or shadow", () => {
    render(
      <FacetCard data-testid="inset" variant="inset">
        Panel
      </FacetCard>
    );
    const el = screen.getByTestId("inset");
    const cls = classOf(el);
    expect(cls).toMatch(/\bbg-surface-secondary\b/);
    expect(cls).toMatch(/\brounded-row\b/);
    expect(cls).toMatch(/(^|\s)p-4(\s|$)/);
    expect(cls).not.toMatch(
      /\bshadow-card\b|\brounded-card\b|(^|\s)border(\s|$)|\bbg-surface(\s|$)/
    );
    expect(el).toHaveAttribute("data-slot", "facet-card");
    expect(el).toHaveAttribute("data-variant", "inset");
  });

  it("takes the padding scale and caller classes", () => {
    render(
      <>
        <FacetCard data-testid="none" variant="inset" padding="none" />
        <FacetCard data-testid="sm" variant="inset" padding="sm" className="space-y-2" />
      </>
    );
    expect(classOf(screen.getByTestId("none"))).not.toMatch(/(^|\s)p-\d/);
    expect(classOf(screen.getByTestId("sm"))).toMatch(/(^|\s)p-3(\s|$)/);
    expect(classOf(screen.getByTestId("sm"))).toContain("space-y-2");
  });

  it("stays pressable with onClick", () => {
    const onClick = jest.fn();
    render(
      <FacetCard variant="inset" onClick={onClick}>
        Open
      </FacetCard>
    );
    const panel = screen.getByRole("button", { name: "Open" });
    fireEvent.keyDown(panel, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("leaves the default card and legacy variant names unchanged", () => {
    render(
      <>
        <FacetCard data-testid="default">x</FacetCard>
        <FacetCard data-testid="legacy" variant="frosted">
          x
        </FacetCard>
      </>
    );
    for (const id of ["default", "legacy"]) {
      const el = screen.getByTestId(id);
      expect(classOf(el)).toContain("bg-surface");
      expect(classOf(el)).toContain("shadow-card");
      expect(classOf(el)).not.toMatch(/(^|\s)p-\d/);
      expect(el).not.toHaveAttribute("data-variant");
    }
  });

  it("exports the surface constants", () => {
    expect(FACET_CARD_SURFACE).toContain("rounded-card");
    expect(FACET_INSET_SURFACE).toBe("bg-surface-secondary text-label rounded-row");
  });
});

describe("MotionFacetCard", () => {
  it("renders the FacetCard surface and keeps motion props off the DOM", () => {
    render(
      <MotionFacetCard
        data-testid="m"
        padding="md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden"
      >
        Body
      </MotionFacetCard>
    );
    const el = screen.getByTestId("m");
    const cls = classOf(el);
    expect(el).toHaveAttribute("data-slot", "facet-card");
    expect(cls).toContain("bg-surface");
    expect(cls).toContain("rounded-card");
    expect(cls).toContain("p-4");
    expect(cls).toContain("overflow-hidden");
    expect(el).not.toHaveAttribute("initial");
    expect(el).not.toHaveAttribute("animate");
  });

  it("supports the inset variant and forwards its ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <MotionFacetCard ref={ref} variant="inset" data-testid="m">
        x
      </MotionFacetCard>
    );
    expect(ref.current).toBe(screen.getByTestId("m"));
    expect(classOf(ref.current!)).toContain("bg-surface-secondary");
  });
});

describe("Stat icon", () => {
  it("renders no label row without an icon (unchanged default)", () => {
    const { container } = render(<Stat label="GDP" value="1" />);
    expect(container.querySelector('[data-slot="stat-label-row"]')).toBeNull();
    expect(container.querySelector('[data-slot="stat-icon"]')).toBeNull();
  });

  it("leads the label with a decorative 14px icon by default", () => {
    const { container } = render(
      <Stat label="Heart rate" value="62" icon={<svg data-testid="glyph" />} />
    );
    const row = container.querySelector('[data-slot="stat-label-row"]')!;
    expect(row).toHaveAttribute("data-icon-placement", "leading");
    expect(classOf(row)).not.toContain("flex-row-reverse");
    const icon = container.querySelector('[data-slot="stat-icon"]')!;
    expect(icon).toHaveAttribute("aria-hidden");
    expect(classOf(icon)).toContain("[:where(&)_svg]:size-3.5");
    expect(classOf(icon)).toContain("text-label-secondary");
    expect(row.firstElementChild).toBe(icon);
    // The label keeps its Eyebrow style.
    expect(classOf(screen.getByText("Heart rate"))).toContain("text-eyebrow");
  });

  it("pins the icon to the end of the label row with iconPlacement=trailing", () => {
    const { container } = render(
      <Stat label="Forum" value="12" icon={<svg />} iconPlacement="trailing" />
    );
    const row = container.querySelector('[data-slot="stat-label-row"]')!;
    expect(row).toHaveAttribute("data-icon-placement", "trailing");
    expect(classOf(row)).toContain("flex-row-reverse");
    expect(classOf(row)).toContain("justify-between");
  });
});

describe("Badge system colours", () => {
  const names = Object.keys(SYSTEM_COLORS) as (keyof typeof SYSTEM_COLORS)[];

  it("has a variant for every system colour", () => {
    expect(Object.keys(SYSTEM_TINTED).sort()).toEqual([...names].sort());
  });

  it.each(names)("%s is its -ink on a 15%% fill", (name) => {
    const cls = badgeVariants({ variant: name });
    expect(cls).toContain(`bg-${name}/15`);
    expect(cls).toContain(`text-${name}-ink`);
    expect(cls).toContain("rounded-full");
    render(<Badge variant={name}>{name}</Badge>);
    expect(screen.getByText(name)).toHaveAttribute("data-variant", name);
  });

  it("keeps the existing variants as they were", () => {
    expect(badgeVariants({ variant: "success" })).toContain("bg-success/15 text-success");
    expect(badgeVariants()).toBe(badgeVariants({ variant: "tinted" }));
  });
});

describe("ActionPill", () => {
  it("is a plain action without aria-pressed when pressed is omitted", () => {
    render(<ActionPill icon={<svg />}>Share</ActionPill>);
    const pill = screen.getByRole("button", { name: "Share" });
    expect(pill).not.toHaveAttribute("aria-pressed");
    expect(pill).toHaveAttribute("type", "button");
    expect(classOf(pill)).toContain("rounded-full");
    expect(classOf(pill)).toContain("text-label-secondary");
    expect(pill.querySelector('[data-slot="action-pill-icon"]')).toHaveAttribute("aria-hidden");
  });

  it("toggles aria-pressed and takes the tint when pressed", () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <ActionPill pressed={on} onClick={() => setOn((v) => !v)}>
          Save
        </ActionPill>
      );
    }
    render(<Harness />);
    const pill = screen.getByRole("button", { name: "Save" });
    expect(pill).toHaveAttribute("aria-pressed", "false");
    expect(classOf(pill)).not.toContain("bg-tint-fill");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(pill).toHaveAttribute("data-state", "on");
    expect(classOf(pill)).toContain("bg-tint-fill");
    expect(classOf(pill)).toContain("text-tint");
    expect(classOf(pill)).not.toContain("text-label-secondary");
  });

  it("uses a system colour tone when pressed and renders a tabular count", () => {
    render(
      <ActionPill pressed tone="red" count={3} aria-label="Like">
        {null}
      </ActionPill>
    );
    const pill = screen.getByRole("button", { name: "Like" });
    expect(pill).toHaveAttribute("data-tone", "red");
    expect(classOf(pill)).toContain("bg-red/15");
    expect(classOf(pill)).toContain("text-red-ink");
    const count = pill.querySelector('[data-slot="action-pill-count"]')!;
    expect(count.textContent).toBe("3");
    expect(classOf(count)).toContain("tabular-nums");
  });

  it("hides an empty count and forwards its ref", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <ActionPill ref={ref} count={null}>
        Repost
      </ActionPill>
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Repost" }));
    expect(ref.current!.querySelector('[data-slot="action-pill-count"]')).toBeNull();
  });
});

describe("SegmentedControl overflow", () => {
  const opts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ value: `o${i}`, label: `Option ${i}` }));

  it(`does not scroll with up to ${MAX_SEGMENTS} options`, () => {
    render(<SegmentedControl aria-label="Few" options={opts(MAX_SEGMENTS)} defaultValue="o0" />);
    const group = screen.getByRole("radiogroup", { name: "Few" });
    expect(group).not.toHaveAttribute("data-scrollable");
    expect(classOf(group)).not.toContain("overflow-x-auto");
  });

  it("scrolls horizontally above five options, keeping segment widths", () => {
    render(<SegmentedControl aria-label="Many" options={opts(8)} defaultValue="o6" />);
    const group = screen.getByRole("radiogroup", { name: "Many" });
    expect(group).toHaveAttribute("data-scrollable", "true");
    expect(classOf(group)).toContain("overflow-x-auto");
    expect(classOf(group)).toContain("max-w-full");
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(8);
    expect(classOf(radios[0]!)).toContain("shrink-0");
    // Arrow keys still move the selection.
    fireEvent.keyDown(radios[6]!, { key: "ArrowRight" });
    expect(radios[7]).toHaveAttribute("aria-checked", "true");
  });

  it("lets scrollable force the behaviour either way", () => {
    render(
      <>
        <SegmentedControl aria-label="Forced" options={opts(3)} scrollable />
        <SegmentedControl aria-label="Off" options={opts(7)} scrollable={false} />
      </>
    );
    expect(screen.getByRole("radiogroup", { name: "Forced" })).toHaveAttribute("data-scrollable");
    expect(screen.getByRole("radiogroup", { name: "Off" })).not.toHaveAttribute("data-scrollable");
  });

  it("draws the small thumb from the radius tokens, not rounded-md", () => {
    render(<SegmentedControl aria-label="Small" size="sm" options={opts(2)} defaultValue="o0" />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(classOf(radio)).not.toContain("rounded-md");
      expect(classOf(radio)).toContain("rounded-[calc(var(--radius-control-sm)-0.125rem)]");
    }
  });
});

describe("ToggleGroup disallowEmpty", () => {
  function Single(props: { disallowEmpty?: boolean; required?: boolean }) {
    const [value, setValue] = useState("a");
    return (
      <>
        <ToggleGroup
          type="single"
          aria-label="View"
          value={value}
          onValueChange={setValue}
          {...props}
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
        </ToggleGroup>
        <output>{value || "(none)"}</output>
      </>
    );
  }

  it.each([{ disallowEmpty: true }, { required: true }])(
    "single with %j keeps the active item pressed",
    (props) => {
      render(<Single {...props} />);
      const a = screen.getByRole("button", { name: "A" });
      fireEvent.click(a);
      expect(a).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("a")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "B" }));
      expect(screen.getByText("b")).toBeInTheDocument();
      expect(a).toHaveAttribute("aria-pressed", "false");
    }
  );

  it("single without it still clears (unchanged default)", () => {
    render(<Single />);
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(screen.getByText("(none)")).toBeInTheDocument();
  });

  it("multiple keeps the last pressed item", () => {
    const onValueChange = jest.fn();
    render(
      <ToggleGroup
        type="multiple"
        aria-label="Filters"
        defaultValue={["x", "y"]}
        disallowEmpty
        onValueChange={onValueChange}
      >
        <ToggleGroupItem value="x">X</ToggleGroupItem>
        <ToggleGroupItem value="y">Y</ToggleGroupItem>
      </ToggleGroup>
    );
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["y"]);
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Y" })).toHaveAttribute("aria-pressed", "true");
    // Not forwarded to the DOM.
    expect(screen.getByRole("group", { name: "Filters" })).not.toHaveAttribute("required");
  });
});

describe("PopoverAnchor", () => {
  it("is exported and renders its child with the popover-anchor slot", () => {
    render(
      <Popover open>
        <PopoverAnchor asChild>
          <button type="button">Like</button>
        </PopoverAnchor>
        <PopoverContent>Reactions</PopoverContent>
      </Popover>
    );
    expect(screen.getByRole("button", { name: "Like" })).toHaveAttribute(
      "data-slot",
      "popover-anchor"
    );
    expect(screen.getByText("Reactions")).toBeInTheDocument();
  });
});

describe("FlagWatermark", () => {
  it("lives in ui/facet and is re-exported from its old MyCountry path", () => {
    expect(LegacyWatermark.FlagWatermark).toBe(FacetIdentity.FlagWatermark);
    expect(LegacyWatermark.TintHairline).toBe(FacetIdentity.TintHairline);
    expect(LegacyWatermark.WatermarkGlyph).toBe(FacetIdentity.WatermarkGlyph);
  });

  it("is decorative and renders nothing without a source", () => {
    const { container, rerender } = render(<FacetIdentity.FlagWatermark src={null} />);
    expect(container.firstChild).toBeNull();
    rerender(<FacetIdentity.FlagWatermark src="/flag.png" />);
    const mark = container.querySelector('[data-slot="flag-watermark"]')!;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(classOf(mark)).toContain("print:hidden");
  });
});
