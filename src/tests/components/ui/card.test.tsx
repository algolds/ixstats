/**
 * Facet pressable surfaces and rows: the roles, keyboard activation, touch targets and state other screens rely on,
 * and the glass-never-on-glass nesting rule. Pressables, rows and their states are tables.
 */
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Card, SurfaceReset } from "~/components/ui/card";
import { CutoutCard } from "~/components/ui/cutout-card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { ActionPill } from "~/components/ui/action-pill";
import { StepIndicator } from "~/components/ui/step-indicator";

const classOf = (el: Element) => el.getAttribute("class") ?? "";

describe.each([
  {
    surface: "an interactive Card",
    ui: (fn: () => void) => (
      <Card onClick={fn} interactive>
        Open
      </Card>
    ),
  },
  {
    surface: "a well Card",
    ui: (fn: () => void) => (
      <Card variant="well" onClick={fn} interactive>
        Open
      </Card>
    ),
  },
  {
    surface: "a CutoutCard",
    ui: (fn: () => void) => <CutoutCard onClick={fn} aria-label="Open" />,
  },
])("$surface", ({ ui }) => {
  it("is one focusable button, 44pt on touch with its focus ring outside the clip, activated by click, Enter and Space", () => {
    const onClick = jest.fn();
    render(ui(onClick));
    const el = screen.getByRole("button", { name: "Open" });
    const cls = classOf(el);
    expect(el).toHaveAttribute("tabindex", "0");
    expect(cls).toContain("pointer-coarse:min-h-11");
    expect(cls).toContain("focus-visible:outline-offset-2");
    expect(cls).not.toMatch(/focus-visible:ring-|outline-offset-\[-/);
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.keyDown(el, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});

describe("Card", () => {
  it("has no button semantics or tab stop without interactive, and keeps a caller's role", () => {
    render(
      <>
        <Card data-testid="static" onClick={jest.fn()}>
          Body
        </Card>
        <Card role="region" aria-label="Summary">
          Body
        </Card>
      </>
    );
    expect(screen.getByTestId("static")).not.toHaveAttribute("role");
    expect(screen.getByTestId("static")).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument();
  });

  it("never puts glass on glass: a Card in a Card is a well, an explicit variant wins, an overlay starts a fresh pane", () => {
    render(
      <Card>
        <Card data-testid="inner">
          <Card data-testid="deeper">x</Card>
        </Card>
        <Card data-testid="forced" variant="pane">
          y
        </Card>
        <SurfaceReset>
          <Card data-testid="in-overlay">z</Card>
        </SurfaceReset>
      </Card>
    );
    expect(screen.getByTestId("inner")).toHaveAttribute("data-variant", "well");
    expect(screen.getByTestId("deeper")).toHaveAttribute("data-variant", "well");
    expect(screen.getByTestId("forced")).toHaveAttribute("data-variant", "pane");
    expect(screen.getByTestId("in-overlay")).toHaveAttribute("data-variant", "pane");
  });
});

describe("FacetList rows", () => {
  it("renders sections as labelled lists, the header and footer outside the group", () => {
    render(
      <FacetList>
        <FacetListSection header="Account" footer="Shown on your profile.">
          <FacetRow title="Name" trailing="Ada" />
          <FacetRow title="Email" trailing="ada@example.com" />
        </FacetListSection>
        <FacetListSection aria-label="Filters">
          <FacetRow title="One" />
        </FacetListSection>
      </FacetList>
    );
    const list = screen.getByRole("list", { name: "Account" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveAccessibleDescription("Shown on your profile.");
    expect(within(list).queryByText("Account")).toBeNull();
    expect(screen.getByRole("list", { name: "Filters" })).toBeInTheDocument();
  });

  it.each([
    {
      row: "a selected link row",
      props: { href: "/a", selected: true },
      role: "link",
      attrs: { "aria-current": "page" },
    },
    {
      row: "a tint check toggle",
      props: {
        onClick: () => {},
        selected: true,
        selectionStyle: "tint" as const,
        accessory: "check" as const,
      },
      role: "button",
      attrs: { "aria-pressed": "true", "aria-current": null },
    },
    {
      row: "an unchecked check row",
      props: { onClick: () => {}, accessory: "check" as const },
      role: "button",
      attrs: { "aria-pressed": "false" },
    },
    {
      row: "a default-fill selected row",
      props: { onClick: () => {}, selected: true },
      role: "button",
      attrs: { "aria-current": null },
    },
  ])("$row is a $role with $attrs", ({ props, role, attrs }) => {
    render(
      <FacetListSection aria-label="Rows">
        <FacetRow title="Row" {...props} />
      </FacetListSection>
    );
    const el = screen.getByRole(role, { name: "Row" });
    for (const [name, value] of Object.entries(attrs)) {
      if (value === null) expect(el).not.toHaveAttribute(name);
      else expect(el).toHaveAttribute(name, value);
    }
  });

  it("disables a button row and renders a disabled href row as a non-link; static rows have no interactive role", () => {
    const onClick = jest.fn();
    render(
      <FacetListSection aria-label="Rows">
        <FacetRow title="Export" disabled onClick={onClick} />
        <FacetRow href="/locked" title="Locked" disabled />
        <FacetRow title="Version" trailing="3.0.0" accessory="none" />
      </FacetListSection>
    );
    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Locked").closest('[data-slot="facet-row"]')).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("ActionPill", () => {
  it("is a plain action without aria-pressed, and a toggle once pressed is given", () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <>
          <ActionPill icon={<svg />}>Share</ActionPill>
          <ActionPill pressed={on} onClick={() => setOn((v) => !v)}>
            Save
          </ActionPill>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Share" })).not.toHaveAttribute("aria-pressed");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(save);
    expect(save).toHaveAttribute("aria-pressed", "true");
  });
});

describe("StepIndicator", () => {
  const steps = [
    { id: "type", label: "Type" },
    { id: "scope", label: "Scope" },
    { id: "confirm", label: "Confirm" },
  ];

  it("marks the current step inside a named nav; only completed steps are buttons, unless all are navigable", () => {
    const onStepClick = jest.fn();
    const { rerender } = render(
      <StepIndicator aria-label="Wizard progress" steps={steps} current={1} />
    );
    const nav = screen.getByRole("navigation", { name: "Wizard progress" });
    expect(nav.querySelector('[aria-current="step"]')).toHaveTextContent("Scope");
    expect(screen.queryAllByRole("button")).toHaveLength(0);

    rerender(<StepIndicator steps={steps} current={1} onStepClick={onStepClick} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(onStepClick).toHaveBeenCalledWith(0);

    rerender(<StepIndicator steps={steps} current={0} onStepClick={onStepClick} navigable="all" />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
