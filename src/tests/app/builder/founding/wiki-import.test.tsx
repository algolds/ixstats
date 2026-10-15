/**
 * The wiki import: search a wiki, read the page's infobox into a review card with a checkbox per
 * found field (the government shows its raw infobox value), keep only the ticked fields, and the
 * Start grid marks the suggested archetype.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockSearch = jest.fn();
const mockParse = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      searchWiki: { useMutation: () => ({ mutateAsync: mockSearch }) },
      parseInfobox: { useMutation: () => ({ mutateAsync: mockParse }) },
    },
  },
}));

import { ImportSheet } from "~/app/builder/_founding/components/ImportSheet";
import { StartStep } from "~/app/builder/_founding/components/StartStep";

const INFOBOX = {
  name: "Valoria",
  capital: "[[Port Val]]",
  population: 12_500_000,
  GDP_nominal_per_capita: "$61,000",
  government_type: "Unitary parliamentary constitutional monarchy",
  currency: "Valorian crown",
};

describe("ImportSheet", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearch.mockReset().mockResolvedValue([{ title: "Valoria", snippet: "" }]);
    mockParse.mockReset().mockResolvedValue(INFOBOX);
  });
  afterEach(() => jest.useRealTimers());

  it("reviews each found field with a checkbox and keeps only the ticked ones", async () => {
    const onApply = jest.fn();
    render(<ImportSheet open onOpenChange={jest.fn()} onApply={onApply} />);

    fireEvent.change(screen.getByLabelText("Nation page"), { target: { value: "Valo" } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockSearch).toHaveBeenCalledWith({
      query: "Valo",
      site: "iiwiki",
      categoryFilter: "Countries",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Valoria/ }));
    });
    expect(mockParse).toHaveBeenCalledWith({ pageName: "Valoria", site: "iiwiki" });

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((box) => box.getAttribute("id"))).toEqual([
      "founding-import-name",
      "founding-import-capitalCity",
      "founding-import-population",
      "founding-import-gdpPerCapita",
      "founding-import-government",
      "founding-import-currency",
    ]);
    boxes.forEach((box) => expect(box).toHaveAttribute("data-state", "checked"));
    expect(
      screen.getByText(
        'Constitutional monarchy, from "Unitary parliamentary constitutional monarchy"'
      )
    ).toBeInTheDocument();
    expect(screen.getByText("12.5 million people")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Capital city/ }));
    fireEvent.click(screen.getByRole("button", { name: "Use these details" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const [nation, keep] = onApply.mock.calls[0]! as [unknown, Set<string>];
    expect(nation).toMatchObject({
      name: "Valoria",
      capitalCity: "Port Val",
      gdpPerCapita: 61_000,
    });
    expect([...keep].sort()).toEqual(
      ["currency", "gdpPerCapita", "government", "name", "population"].sort()
    );
  });
});

describe("StartStep", () => {
  it("marks the suggested archetype and offers one Details sheet per card", () => {
    render(
      <StartStep
        selection="nordic"
        suggested="nordic"
        importedTitle="Valoria"
        onSelect={jest.fn()}
        onImport={jest.fn()}
        onBlank={jest.fn()}
      />
    );
    const nordic = screen.getByRole("radio", { name: /Wealthy welfare state/ });
    expect(nordic).toHaveAttribute("aria-checked", "true");
    expect(nordic).toHaveTextContent("Suggested");
    expect(nordic).toHaveTextContent("Inspired by the Nordic model");
    expect(screen.getAllByText("Suggested")).toHaveLength(1);
    expect(screen.getByText(/Imported from Valoria/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Details:/ })).toHaveLength(10);

    fireEvent.click(screen.getByRole("radio", { name: "Historical" }));
    expect(screen.getByRole("radio", { name: /Planned industrial state/ })).toBeInTheDocument();
  });
});
