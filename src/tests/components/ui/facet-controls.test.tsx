import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import { Button, buttonVariants } from "~/components/ui/button";
import { Badge, badgeVariants } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SearchField } from "~/components/ui/search-field";
import { Switch } from "~/components/ui/switch";

describe("Button", () => {
  it("maps styles to role tokens", () => {
    expect(buttonVariants({ variant: "default" })).toContain("bg-primary-fill");
    expect(buttonVariants({ variant: "default" })).toContain("text-on-primary");
    expect(buttonVariants({ variant: "default" })).not.toContain("bg-tint");
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-fill-3");
    expect(buttonVariants({ variant: "outline" })).toContain("border-separator");
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "ghost" })).toContain("text-label");
    expect(buttonVariants({ variant: "ghost" })).not.toContain("text-tint");
  });

  it("presses with an instant colour change, not a scale", () => {
    for (const variant of ["default", "secondary", "outline", "ghost", "destructive"] as const) {
      const cls = buttonVariants({ variant });
      expect(cls).toContain("active:");
      expect(cls).not.toContain("facet-press");
      expect(cls).not.toContain("scale-");
    }
  });

  it("sizes from the density-aware control heights", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-(--control-height-sm)");
    expect(buttonVariants({ size: "xs" })).not.toBe(buttonVariants({ size: "sm" }));
    expect(buttonVariants()).toBe(buttonVariants({ size: "default", variant: "default" }));
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
  it("defaults to the neutral palette; secondary is the tint's ink on its fill", () => {
    expect(badgeVariants()).toBe(badgeVariants({ variant: "default" }));
    expect(badgeVariants({ variant: "default" })).toContain("bg-fill-3");
    expect(badgeVariants({ variant: "secondary" })).toContain("bg-tint-fill text-tint-ink");
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
  it("is a named radiogroup with one checked radio", () => {
    render(<Period />);
    expect(screen.getByRole("radiogroup", { name: "Period" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
  });

  it("selects on click", () => {
    const onChange = jest.fn();
    render(<Period onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(onChange).toHaveBeenCalledWith("day");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves focus with arrows (skipping disabled), Home and End", async () => {
    render(<Period />);
    const radio = (name: string) => screen.getByRole("radio", { name });

    radio("Week").focus();
    fireEvent.keyDown(radio("Week"), { key: "ArrowRight" });
    await waitFor(() => expect(radio("Year")).toHaveFocus());

    fireEvent.keyDown(radio("Year"), { key: "Home" });
    await waitFor(() => expect(radio("Day")).toHaveFocus());

    fireEvent.keyDown(radio("Day"), { key: "End" });
    await waitFor(() => expect(radio("Year")).toHaveFocus());
  });

  it("keeps the current choice when it is pressed again", () => {
    render(<Period />);
    fireEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
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
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }));
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
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeInTheDocument();
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
    const alpha = screen.getByRole("radio", { name: "Alpha" });
    const beta = screen.getByRole("radio", { name: "Beta" });
    expect(alpha).toHaveAttribute("aria-checked", "true");

    fireEvent.click(beta);
    expect(alpha).toHaveAttribute("aria-checked", "false");
    expect(beta).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenLastCalledWith("b");

    fireEvent.click(beta);
    expect(beta).toHaveAttribute("aria-checked", "false");
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("single with disallowEmpty keeps the pressed item pressed", () => {
    render(
      <ToggleGroup type="single" aria-label="Sort" defaultValue="a" disallowEmpty>
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b">Beta</ToggleGroupItem>
      </ToggleGroup>
    );
    fireEvent.click(screen.getByRole("radio", { name: "Alpha" }));
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves focus between items with the arrow keys", async () => {
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Gamma" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("button", { name: "Gamma" }), { key: "Home" });
    await waitFor(() => expect(alpha).toHaveFocus());
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
    expect(tabs[0]).toHaveAttribute("data-slot", "tabs-trigger");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("data-slot", "tabs-content");
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0]!.id);
    expect(tabs[0]).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveTextContent("First panel");
    expect(panel.tabIndex).toBe(0);
  });

  it("moves selection and focus with arrows (skipping disabled), Home and End", async () => {
    render(<TabsHarness />);
    const tab = (name: string) => screen.getByRole("tab", { name });

    tab("One").focus();
    fireEvent.keyDown(tab("One"), { key: "ArrowRight" });
    await waitFor(() => expect(tab("Three")).toHaveAttribute("aria-selected", "true"));
    expect(tab("Three")).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Third panel");

    fireEvent.keyDown(tab("Three"), { key: "ArrowRight" });
    await waitFor(() => expect(tab("One")).toHaveAttribute("aria-selected", "true"));

    fireEvent.keyDown(tab("One"), { key: "End" });
    await waitFor(() => expect(tab("Three")).toHaveFocus());
    fireEvent.keyDown(tab("Three"), { key: "Home" });
    await waitFor(() => expect(tab("One")).toHaveAttribute("aria-selected", "true"));
  });

  it("keeps caller-provided ids and still switches on press", () => {
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
    fireEvent.mouseDown(screen.getByRole("tab", { name: "B" }));
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

describe("Switch", () => {
  it("is a switch with aria-checked and no sound attributes", () => {
    const onCheckedChange = jest.fn();
    render(<Switch aria-label="Notifications" onCheckedChange={onCheckedChange} />);
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
