import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge, badgeVariants } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Stepper } from "~/components/ui/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SearchField } from "~/components/ui/search-field";
import { MenuButton } from "~/components/ui/menu-button";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { AppleSwitch } from "~/components/ui/apple-switch";

describe("Button", () => {
  it.each([
    ["default", "filled"],
    ["secondary", "gray"],
    ["outline", "bordered"],
  ] as const)("aliases the legacy %s style to %s", (legacy, facet) => {
    expect(buttonVariants({ variant: legacy })).toBe(buttonVariants({ variant: facet }));
  });

  it("keeps ghost neutral: plain's shape with the label colour instead of the tint", () => {
    const ghost = buttonVariants({ variant: "ghost" });
    expect(ghost).toContain("text-label");
    expect(ghost).not.toContain("text-tint");
    expect(buttonVariants({ variant: "ghost" })).toContain("text-tint");
  });

  it("maps styles to Facet role tokens", () => {
    // Facet 3.1: the primary role (monochrome; gold in MyCountry/Builder), not the tint.
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary-fill");
    expect(buttonVariants({ variant: "default" })).toContain("text-on-primary");
    expect(buttonVariants({ variant: "default" })).not.toContain("bg-tint");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-tint-fill text-tint");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-fill-3");
    expect(buttonVariants({ variant: "outline" })).toContain("border-separator");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
  });

  it("sizes from the density-aware control heights; xs aliases sm; md is the default", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-(--control-height-sm)");
    expect(buttonVariants({ size: "xs" })).toBe(buttonVariants({ size: "sm" }));
    expect(buttonVariants()).toBe(buttonVariants({ size: "default", variant: "default" }));
    expect(buttonVariants({ size: "default" })).toBe(buttonVariants({ size: "default" }));
    expect(buttonVariants({ size: "lg" })).toContain("h-(--control-height-lg)");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-(--control-height-sm)");
  });

  it("has a coarse-pointer hit slop and a tint focus ring, and makes no sound", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("pointer-coarse:after:min-h-11");
    expect(button.className).toContain("focus-visible:outline-tint");
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button.getAttributeNames().some((n) => n.startsWith("data-cuelume"))).toBe(false);
  });

  it("lets caller classes override the size and colour", () => {
    render(
      <Button size="sm" className="h-10 text-white">
        Go
      </Button>
    );
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("h-10");
    expect(cls).not.toContain("h-(--control-height-sm)");
    expect(cls).toContain("text-white");
    expect(cls).not.toContain("text-on-tint");
  });
});

describe("Badge", () => {
  it("aliases default→tinted and secondary→neutral", () => {
    expect(badgeVariants({ variant: "default" })).toBe(badgeVariants({ variant: "tinted" }));
    expect(badgeVariants({ variant: "secondary" })).toBe(badgeVariants({ variant: "neutral" }));
  });

  it("colours status badges with their status ink on a fill of the colour", () => {
    render(<Badge variant="success">Active</Badge>);
    const badge = screen.getByText("Active");
    expect(badge.className).toContain("bg-success/15");
    expect(badge.className).toContain("text-success-ink");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("text-caption");
  });
});

function Period({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("week");
  return (
    <SegmentedControl
      aria-label="Period"
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      options={[
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month", disabled: true },
        { value: "year", label: "Year" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a named radiogroup with one checked radio as the only tab stop", () => {
    render(<Period />);
    expect(screen.getByRole("radiogroup", { name: "Period" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it("selects on click", () => {
    const onChange = jest.fn();
    render(<Period onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(onChange).toHaveBeenCalledWith("day");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves focus and selection with arrows (skipping disabled), Home and End", () => {
    render(<Period />);
    const radio = (name: string) => screen.getByRole("radio", { name });

    fireEvent.keyDown(radio("Week"), { key: "ArrowRight" });
    expect(radio("Year")).toHaveAttribute("aria-checked", "true");
    expect(radio("Year")).toHaveFocus();

    fireEvent.keyDown(radio("Year"), { key: "ArrowRight" });
    expect(radio("Day")).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radio("Day"), { key: "ArrowLeft" });
    expect(radio("Year")).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radio("Year"), { key: "Home" });
    expect(radio("Day")).toHaveAttribute("aria-checked", "true");
    expect(radio("Day")).toHaveFocus();

    fireEvent.keyDown(radio("Day"), { key: "End" });
    expect(radio("Year")).toHaveAttribute("aria-checked", "true");
  });

  it("exposes tabs instead of radios with asTabs", () => {
    render(
      <SegmentedControl
        asTabs
        aria-label="Views"
        defaultValue="map"
        getTabPanelId={(v) => `panel-${v}`}
        options={[
          { value: "map", label: "Map" },
          { value: "list", label: "List" },
        ]}
      />
    );
    expect(screen.getByRole("tablist", { name: "Views" })).toBeInTheDocument();
    const map = screen.getByRole("tab", { name: "Map" });
    expect(map).toHaveAttribute("aria-selected", "true");
    expect(map).toHaveAttribute("aria-controls", "panel-map");
    fireEvent.click(screen.getByRole("tab", { name: "List" }));
    expect(screen.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("ToggleGroup", () => {
  it("multiple: toggles each item independently with aria-pressed", () => {
    const onValueChange = jest.fn();
    render(
      <ToggleGroup type="multiple" aria-label="Filters" onValueChange={onValueChange}>
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b">Beta</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(screen.getByRole("group", { name: "Filters" })).toBeInTheDocument();
    const alpha = screen.getByRole("button", { name: "Alpha" });
    const beta = screen.getByRole("button", { name: "Beta" });
    expect(alpha).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(alpha);
    fireEvent.click(beta);
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "true");
    expect(onValueChange).toHaveBeenLastCalledWith(["a", "b"]);

    fireEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(onValueChange).toHaveBeenLastCalledWith(["b"]);
  });

  it("single: pressing one releases the other; pressing it again clears", () => {
    const onValueChange = jest.fn();
    render(
      <ToggleGroup type="single" aria-label="Sort" defaultValue="a" onValueChange={onValueChange}>
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b">Beta</ToggleGroupItem>
      </ToggleGroup>
    );
    const alpha = screen.getByRole("button", { name: "Alpha" });
    const beta = screen.getByRole("button", { name: "Beta" });
    expect(alpha).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(beta);
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(beta).toHaveAttribute("aria-pressed", "true");
    expect(onValueChange).toHaveBeenLastCalledWith("b");

    fireEvent.click(beta);
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("moves focus between items with the arrow keys", () => {
    render(
      <ToggleGroup type="multiple" aria-label="Filters">
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b" disabled>
          Beta
        </ToggleGroupItem>
        <ToggleGroupItem value="c">Gamma</ToggleGroupItem>
      </ToggleGroup>
    );
    const alpha = screen.getByRole("button", { name: "Alpha" });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Gamma" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Gamma" }), { key: "Home" });
    expect(alpha).toHaveFocus();
  });
});

describe("Stepper", () => {
  it("is a spinbutton with value and bounds", () => {
    render(<Stepper aria-label="Quantity" defaultValue={2} min={0} max={5} />);
    const spin = screen.getByRole("spinbutton", { name: "Quantity" });
    expect(spin).toHaveAttribute("aria-valuenow", "2");
    expect(spin).toHaveAttribute("aria-valuemin", "0");
    expect(spin).toHaveAttribute("aria-valuemax", "5");
    expect(spin.tabIndex).toBe(0);
  });

  it("steps with the buttons and clamps, disabling the button at the bound", () => {
    const onValueChange = jest.fn();
    render(
      <Stepper aria-label="Quantity" defaultValue={4} max={5} onValueChange={onValueChange} />
    );
    const inc = screen.getByRole("button", { name: "Increase" });
    fireEvent.click(inc);
    expect(onValueChange).toHaveBeenLastCalledWith(5);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-valuenow", "5");
    expect(inc).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-valuenow", "4");
  });

  it("handles arrows, PageUp/PageDown, Home and End", () => {
    render(<Stepper aria-label="Rate" defaultValue={0.5} min={0} max={3} step={0.1} />);
    const spin = screen.getByRole("spinbutton");
    const now = () => spin.getAttribute("aria-valuenow");

    fireEvent.keyDown(spin, { key: "ArrowUp" });
    expect(now()).toBe("0.6");
    fireEvent.keyDown(spin, { key: "ArrowDown" });
    fireEvent.keyDown(spin, { key: "ArrowDown" });
    expect(now()).toBe("0.4");
    fireEvent.keyDown(spin, { key: "PageUp" });
    expect(now()).toBe("1.4");
    fireEvent.keyDown(spin, { key: "PageDown" });
    fireEvent.keyDown(spin, { key: "PageDown" });
    expect(now()).toBe("0");
    fireEvent.keyDown(spin, { key: "End" });
    expect(now()).toBe("3");
    fireEvent.keyDown(spin, { key: "Home" });
    expect(now()).toBe("0");
  });
});

function TabsHarness() {
  return (
    <Tabs defaultValue="one">
      <TabsList aria-label="Sections">
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two" disabled>
          Two
        </TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="three">Third panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("wires tablist, tabs and the panel with ARIA and data-slots", () => {
    render(<TabsHarness />);
    const list = screen.getByRole("tablist", { name: "Sections" });
    expect(list).toHaveAttribute("data-slot", "tabs-list");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0]).toHaveAttribute("data-slot", "tabs-trigger");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("data-slot", "tabs-content");
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0]!.id);
    expect(tabs[0]).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveTextContent("First panel");
  });

  it("moves selection and focus with arrows (skipping disabled), Home and End", () => {
    render(<TabsHarness />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    fireEvent.keyDown(tab("One"), { key: "ArrowRight" });
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");
    expect(tab("Three")).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Third panel");

    fireEvent.keyDown(tab("Three"), { key: "ArrowRight" });
    expect(tab("One")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("One"), { key: "End" });
    expect(tab("Three")).toHaveFocus();
    fireEvent.keyDown(tab("Three"), { key: "Home" });
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });

  it("defers to a TabsList onKeyDown that handles the key itself", () => {
    const onKeyDown = jest.fn((e: React.KeyboardEvent) => e.preventDefault());
    render(
      <Tabs defaultValue="a">
        <TabsList onKeyDown={onKeyDown}>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "A" }), { key: "ArrowRight" });
    expect(onKeyDown).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps caller-provided ids and still switches on click", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" id="tab-a" aria-controls="panel-a">
            A
          </TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a" id="panel-a" aria-labelledby="tab-a">
          Panel A
        </TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("id", "tab-a");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-a");
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel B");
  });
});

describe("SearchField", () => {
  it("clears with the clear button and with Escape, reporting the empty value", () => {
    const onValueChange = jest.fn();
    function Harness() {
      const [q, setQ] = useState("tax");
      return (
        <SearchField
          aria-label="Search countries"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onValueChange={onValueChange}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole("searchbox", { name: "Search countries" });
    expect(input).toHaveAttribute("type", "search");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    fireEvent.change(input, { target: { value: "gdp" } });
    expect(input).toHaveValue("gdp");
    const escape = fireEvent.keyDown(input, { key: "Escape" });
    expect(escape).toBe(false); // handled: default prevented
    expect(input).toHaveValue("");
  });

  it("lets Escape through when already empty", () => {
    render(<SearchField aria-label="Search" />);
    expect(fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" })).toBe(true);
  });
});

describe("MenuButton", () => {
  it("is a menu trigger button that opens its menu from the keyboard", () => {
    render(
      <MenuButton label="Sort">
        <DropdownMenuItem>Name</DropdownMenuItem>
      </MenuButton>
    );
    const trigger = screen.getByRole("button", { name: "Sort" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("data-slot", "menu-button");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Name" })).toBeInTheDocument();
  });
});

describe("Switch", () => {
  it("is a switch with aria-checked and no sound attributes", () => {
    const onCheckedChange = jest.fn();
    render(<AppleSwitch aria-label="Notifications" onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole("switch", { name: "Notifications" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveAttribute("data-slot", "switch");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveAttribute("data-state", "checked");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sw.getAttributeNames().some((n) => n.startsWith("data-cuelume"))).toBe(false);
  });
});
