/**
 * P0-05 / P1-09: the Defense budget card labels the 2% of GDP figure as an estimate, edits with a
 * formatted amount (not a raw float), and offers no Edit budget in the free (locked) preview.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value}</span>,
}));

import { MyCountryEditModeProvider } from "~/context/MyCountryEditModeContext";
import { BudgetManagementCard } from "~/components/mycountry/domains/defense/command/BudgetManagementCard";

const budgetData = {
  totalBudget: 5668857676.361599,
  gdpPercent: 2,
  personnelCosts: 2267543070.5,
  operationsMaintenance: 1700657302.9,
  procurement: 850328651.4,
  rdteCosts: 566885767.6,
  militaryConstruction: 283442883.8,
};

function renderCard(opts: { canEdit: boolean; editing: boolean; isEstimate: boolean }) {
  const onTotal = jest.fn();
  render(
    <MyCountryEditModeProvider canEdit={opts.canEdit}>
      <BudgetManagementCard
        budgetData={budgetData}
        isEstimate={opts.isEstimate}
        isSaving={false}
        editingBudget={opts.editing}
        setEditingBudget={jest.fn()}
        handleSaveBudget={jest.fn()}
        handleTotalBudgetChange={onTotal}
        handleCategoryChange={jest.fn()}
        allocationPercent={100}
      />
    </MyCountryEditModeProvider>
  );
  return { onTotal };
}

it("labels the figure an estimate until a budget is saved", () => {
  renderCard({ canEdit: true, editing: false, isEstimate: true });
  expect(screen.getByText("Estimated defense budget")).toBeTruthy();
  expect(screen.getByText(/Estimate: 2% of GDP/)).toBeTruthy();
});

it("offers no Edit budget in the locked preview", () => {
  renderCard({ canEdit: false, editing: false, isEstimate: false });
  expect(screen.queryByRole("button", { name: /Edit budget/ })).toBeNull();
});

it("edits the total as a formatted whole amount", () => {
  const { onTotal } = renderCard({ canEdit: true, editing: true, isEstimate: false });
  const input = screen.getByLabelText("Total defense budget") as HTMLInputElement;
  expect(input.value).toBe("5,668,857,676");
  fireEvent.change(input, { target: { value: "9,000,000,000" } });
  expect(onTotal).toHaveBeenCalledWith(9e9);
});
