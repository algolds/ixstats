/**
 * Facet selection and input controls: the roles, keyboard model and controlled state other screens rely on.
 * The single-choice keyboard model (arrows skip a disabled choice and wrap, focus lands on the selected choice) is
 * one table over SegmentedControl, SegmentedControl asTabs, Tabs and RadioCardGroup.
 */
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { SearchField } from "~/components/ui/search-field";

const CHOICES = [
  { value: "one", label: "One" },
  { value: "two", label: "Two", disabled: true },
  { value: "three", label: "Three" },
];

function Segmented({ asTabs = false }: { asTabs?: boolean }) {
  const [value, setValue] = useState("one");
  return (
    <SegmentedControl
      asTabs={asTabs}
      aria-label="Choice"
      value={value}
      onValueChange={setValue}
      options={CHOICES}
    />
  );
}

function TabsChoice() {
  return (
    <Tabs defaultValue="one">
      <TabsList aria-label="Choice">
        {CHOICES.map((c) => (
          <TabsTrigger key={c.value} value={c.value} disabled={c.disabled}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="three">Third panel</TabsContent>
    </Tabs>
  );
}

function RadioCards() {
  const [value, setValue] = useState<string | null>("one");
  return (
    <RadioCardGroup aria-label="Choice" value={value} onValueChange={setValue}>
      {CHOICES.map((c) => (
        <RadioCard key={c.value} value={c.value} title={c.label} disabled={c.disabled} />
      ))}
    </RadioCardGroup>
  );
}

const SegmentedRadios = () => <Segmented />;
const SegmentedTabs = () => <Segmented asTabs />;

describe.each([
  {
    control: "SegmentedControl",
    Ui: SegmentedRadios,
    group: "radiogroup",
    item: "radio",
    state: "aria-checked",
  },
  {
    control: "SegmentedControl asTabs",
    Ui: SegmentedTabs,
    group: "tablist",
    item: "tab",
    state: "aria-selected",
  },
  { control: "Tabs", Ui: TabsChoice, group: "tablist", item: "tab", state: "aria-selected" },
  {
    control: "RadioCardGroup",
    Ui: RadioCards,
    group: "radiogroup",
    item: "radio",
    state: "aria-checked",
  },
] as const)("$control keyboard model", ({ Ui, group, item, state }) => {
  const choice = (name: string) => screen.getByRole(item, { name: new RegExp(`^${name}`) });
  const selected = () =>
    screen
      .getAllByRole(item)
      .filter((el) => el.getAttribute(state) === "true")
      .map((el) => el.textContent);

  it("is a named group with only the selected choice marked; focusing the group lands on it", () => {
    render(<Ui />);
    const list = screen.getByRole(group, { name: "Choice" });
    expect(selected()).toEqual([expect.stringContaining("One")]);
    fireEvent.focus(list);
    expect(choice("One")).toHaveFocus();
  });

  it("moves the selection with the arrows, skipping the disabled choice and wrapping", async () => {
    render(<Ui />);
    choice("One").focus();
    fireEvent.keyDown(choice("One"), { key: "ArrowRight" });
    await waitFor(() => expect(choice("Three")).toHaveAttribute(state, "true"));
    expect(choice("Three")).toHaveFocus();

    fireEvent.keyDown(choice("Three"), { key: "ArrowRight" });
    await waitFor(() => expect(choice("One")).toHaveAttribute(state, "true"));
    expect(choice("One")).toHaveFocus();
    expect(selected()).toHaveLength(1);
  });
});

// Home and End select like the arrows. A Radix radio group checks only on the arrows, so SegmentedControl selects on
// Home and End itself (each keyup is fired: Radix ignores the keys while an arrow is still held).
describe.each([
  { control: "SegmentedControl", Ui: SegmentedRadios, item: "radio", state: "aria-checked" },
  { control: "SegmentedControl asTabs", Ui: SegmentedTabs, item: "tab", state: "aria-selected" },
  { control: "Tabs", Ui: TabsChoice, item: "tab", state: "aria-selected" },
] as const)("$control Home and End", ({ Ui, item, state }) => {
  it("select the first and the last choice", async () => {
    render(<Ui />);
    const choice = (name: string) => screen.getByRole(item, { name });
    choice("One").focus();
    fireEvent.keyDown(choice("One"), { key: "ArrowRight" });
    fireEvent.keyUp(choice("One"), { key: "ArrowRight" });
    await waitFor(() => expect(choice("Three")).toHaveFocus());
    fireEvent.keyDown(choice("Three"), { key: "Home" });
    fireEvent.keyUp(choice("Three"), { key: "Home" });
    await waitFor(() => expect(choice("One")).toHaveAttribute(state, "true"));
    expect(choice("One")).toHaveFocus();
    fireEvent.keyDown(choice("One"), { key: "End" });
    fireEvent.keyUp(choice("One"), { key: "End" });
    await waitFor(() => expect(choice("Three")).toHaveAttribute(state, "true"));
    expect(choice("Three")).toHaveFocus();
  });
});

describe("SegmentedControl", () => {
  it("with manual activation, the arrows move focus and only Enter, Space or a press select", async () => {
    function Manual() {
      const [value, setValue] = useState("one");
      return (
        <SegmentedControl
          asTabs
          activationMode="manual"
          aria-label="Sections"
          value={value}
          onValueChange={setValue}
          options={[
            { value: "one", label: "One" },
            { value: "two", label: "Two" },
            { value: "three", label: "Three" },
          ]}
        />
      );
    }
    render(<Manual />);
    const tab = (name: string) => screen.getByRole("tab", { name });
    tab("One").focus();
    fireEvent.keyDown(tab("One"), { key: "ArrowRight" });
    await waitFor(() => expect(tab("Two")).toHaveFocus());
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tab("Two"), { key: "Enter" });
    expect(tab("Two")).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tab("Two"), { key: "End" });
    await waitFor(() => expect(tab("Three")).toHaveFocus());
    fireEvent.keyDown(tab("Three"), { key: " " });
    expect(tab("Three")).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(tab("One"));
    expect(tab("One")).toHaveAttribute("aria-selected", "true");
  });
});

describe("Tabs", () => {
  it("wires each tab to its panel, keeping caller-provided ids", () => {
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
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "panel-a");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-a");
    expect(panel.tabIndex).toBe(0);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "B" }));
    const next = screen.getByRole("tabpanel");
    expect(next).toHaveTextContent("Panel B");
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("aria-controls", next.id);
  });
});

describe("RadioCardGroup", () => {
  it("stays controlled with nothing checked when the value is null", () => {
    render(
      <RadioCardGroup aria-label="Mode" value={null} onValueChange={() => {}}>
        <RadioCard value="a" title="Alert" />
        <RadioCard value="b" title="System" />
      </RadioCardGroup>
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
  });
});

describe("ToggleGroup", () => {
  it("multiple: a toolbar of buttons pressed independently, focus moved by the arrows past a disabled one", async () => {
    const onValueChange = jest.fn();
    render(
      <ToggleGroup type="multiple" aria-label="Filters" onValueChange={onValueChange}>
        <ToggleGroupItem value="a">Alpha</ToggleGroupItem>
        <ToggleGroupItem value="b" disabled>
          Beta
        </ToggleGroupItem>
        <ToggleGroupItem value="c">Gamma</ToggleGroupItem>
      </ToggleGroup>
    );
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeInTheDocument();
    const alpha = screen.getByRole("button", { name: "Alpha" });
    const gamma = screen.getByRole("button", { name: "Gamma" });
    fireEvent.click(alpha);
    fireEvent.click(gamma);
    expect(onValueChange).toHaveBeenLastCalledWith(["a", "c"]);
    fireEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(gamma).toHaveAttribute("aria-pressed", "true");

    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowRight" });
    await waitFor(() => expect(gamma).toHaveFocus());
    fireEvent.keyDown(gamma, { key: "Home" });
    await waitFor(() => expect(alpha).toHaveFocus());
  });

  it("with disallowEmpty keeps the last pressed item, single or multiple", () => {
    function Single() {
      const [value, setValue] = useState("a");
      return (
        <ToggleGroup
          type="single"
          aria-label="View"
          value={value}
          onValueChange={setValue}
          disallowEmpty
        >
          <ToggleGroupItem value="a">A</ToggleGroupItem>
          <ToggleGroupItem value="b">B</ToggleGroupItem>
        </ToggleGroup>
      );
    }
    const { unmount } = render(<Single />);
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
    unmount();

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
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Y" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("SearchField", () => {
  it("clears on Escape, claiming the key, and lets Escape through when empty", () => {
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
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(input).toHaveValue("");
    expect(onValueChange).toHaveBeenLastCalledWith("");
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  });
});
