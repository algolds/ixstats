/** Card inset and motion, Stat icon slot, Badge palette, ActionPill, SegmentedControl overflow, ToggleGroup disallowEmpty, PopoverAnchor, FlagWatermark. */
import { motion } from "motion/react";
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionPill } from "~/components/ui/action-pill";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import "~/components/ui/facet/identity/FlagWatermark";
import { Card } from "~/components/ui/card";

const MotionCard = motion.create(Card);

const classOf = (el: Element) => el.getAttribute("class") ?? "";

describe('Card variant="well"', () => {
  it("stays pressable with onClick", () => {
    const onClick = jest.fn();
    render(
      <Card variant="well" onClick={onClick} interactive>
        Open
      </Card>
    );
    const panel = screen.getByRole("button", { name: "Open" });
    fireEvent.keyDown(panel, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("motion.create(Card)", () => {
  it("renders the Card surface and keeps motion props off the DOM", () => {
    render(
      <MotionCard
        data-testid="m"
        padding="md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden"
      >
        Body
      </MotionCard>
    );
    const el = screen.getByTestId("m");
    const cls = classOf(el);
    expect(el).toHaveAttribute("data-slot", "card");
    expect(cls).toContain("facet-pane");
    expect(cls).toContain("rounded-card");
    expect(cls).toContain("p-4");
    expect(cls).toContain("overflow-hidden");
    expect(el).not.toHaveAttribute("initial");
    expect(el).not.toHaveAttribute("animate");
  });

  it("supports the well variant and forwards its ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <MotionCard ref={ref} variant="well" data-testid="m">
        x
      </MotionCard>
    );
    expect(ref.current).toBe(screen.getByTestId("m"));
    expect(classOf(ref.current!)).toContain("facet-well");
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

  it("toggles aria-pressed and takes the secondary tone when pressed", () => {
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
    expect(classOf(pill)).toContain("text-tint-ink");
    expect(classOf(pill)).not.toContain("text-label-secondary");
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

describe("ToggleGroup disallowEmpty", () => {
  function Single(props: { disallowEmpty?: boolean }) {
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

  it("single with disallowEmpty keeps the active item pressed", () => {
    render(<Single disallowEmpty />);
    const a = screen.getByRole("radio", { name: "A" });
    fireEvent.click(a);
    expect(a).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("a")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(a).toHaveAttribute("aria-checked", "false");
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
    expect(screen.getByRole("toolbar", { name: "Filters" })).not.toHaveAttribute("required");
  });
});
