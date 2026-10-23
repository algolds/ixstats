/** The hub's filters popover: Type and Category offer only what has cards, and say when those choices are loading. */
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { CardFilterBar, type FilterDimension } from "~/components/vault/cards/CardFilterBar";
import type { CategoryFilterValue } from "~/lib/cards/category-enums";
import { EMPTY_CARD_FILTERS } from "~/lib/cards/face/filters";
import type { CardType } from "~/lib/cards/face/types";

const DIMENSIONS: readonly FilterDimension[] = ["rarity", "type", "category"];

function renderBar(props: Partial<React.ComponentProps<typeof CardFilterBar<"newest">>> = {}) {
  const onChange = jest.fn();
  render(
    <CardFilterBar
      filters={EMPTY_CARD_FILTERS}
      onChange={onChange}
      dimensions={DIMENSIONS}
      types={["LORE", "NS"] satisfies CardType[]}
      categories={["HISTORY", "UNCATEGORISED"] satisfies CategoryFilterValue[]}
      realms={[]}
      sort="newest"
      sortOptions={[{ value: "newest", label: "Newest" }]}
      onSortChange={jest.fn()}
      {...props}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  return onChange;
}

describe("CardFilterBar's type and category fields", () => {
  it("shows both when there are choices", () => {
    renderBar();
    expect(screen.getByRole("toolbar", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
  });

  it("hides Type when no type has cards", () => {
    renderBar({ types: [] });
    expect(screen.queryByRole("toolbar", { name: "Type" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
  });

  it("hides Category when no category has cards", () => {
    renderBar({ categories: [] });
    expect(screen.queryByRole("combobox", { name: "Category" })).toBeNull();
    expect(screen.getByRole("toolbar", { name: "Type" })).toBeInTheDocument();
  });

  it("picks Uncategorised", () => {
    const onChange = renderBar();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Category" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Uncategorised" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_CARD_FILTERS, category: "UNCATEGORISED" });
  });

  it("holds their place with a skeleton while the choices load", () => {
    renderBar({ types: [], categories: [], facets: "loading" });
    expect(
      screen.getByRole("status", { name: "Loading types and categories" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Types and categories did not load.")).toBeNull();
    expect(screen.getByRole("toolbar", { name: "Rarity" })).toBeInTheDocument();
  });

  it("says so when the choices did not load", () => {
    renderBar({ types: [], categories: [], facets: "failed" });
    expect(screen.getByText("Types and categories did not load.")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading types and categories" })).toBeNull();
    expect(screen.getByRole("toolbar", { name: "Rarity" })).toBeInTheDocument();
  });

  it("says nothing of either when the tab filters by neither", () => {
    renderBar({ dimensions: ["rarity"], facets: "failed" });
    expect(screen.queryByText("Types and categories did not load.")).toBeNull();
  });
});
