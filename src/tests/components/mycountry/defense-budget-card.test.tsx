/**
 * Realm time D1: the Defense budget card shows the National budget's Defense department line
 * (amount, share, national total), edits its share, offers the create-structure or
 * add-department action when there is no line, and is read-only in the free (locked) preview.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value}</span>,
}));
jest.mock("~/components/mycountry/domains/government/CreateGovernmentStructureButton", () => ({
  CreateGovernmentStructureButton: () => <button>Create government structure</button>,
}));

import { MyCountryEditModeProvider } from "~/context/MyCountryEditModeContext";
import { BudgetManagementCard } from "~/components/mycountry/domains/defense/command/BudgetManagementCard";
import type { DefenseLine } from "~/lib/military/defense-budget";

const defenseLine: DefenseLine = {
  kind: "line",
  departmentId: "d_def",
  departmentName: "Ministry of Defence",
  allocatedAmount: 8e9,
  allocatedPercent: 8,
  totalDefenseAmount: 8e9,
  totalBudget: 100e9,
  budgetYear: 2040,
};

function renderCard(opts: { line?: DefenseLine; canEdit?: boolean; editing?: boolean }) {
  const onSaveShare = jest.fn();
  const onAddDefenseDepartment = jest.fn();
  const setEditingBudget = jest.fn();
  render(
    <MyCountryEditModeProvider canEdit={opts.canEdit ?? true}>
      <BudgetManagementCard
        countryId="c1"
        line={opts.line ?? defenseLine}
        isLoading={false}
        isSaving={false}
        editingBudget={opts.editing ?? false}
        setEditingBudget={setEditingBudget}
        onSaveShare={onSaveShare}
        onAddDefenseDepartment={onAddDefenseDepartment}
      />
    </MyCountryEditModeProvider>
  );
  return { onSaveShare, onAddDefenseDepartment, setEditingBudget };
}

it("shows the Defense department line of the national budget", () => {
  renderCard({});
  expect(
    screen.getByText(/The Ministry of Defence line of the national budget for 2040/)
  ).toBeTruthy();
  expect(screen.getByText("8000000000")).toBeTruthy();
  expect(screen.getByText("100000000000")).toBeTruthy();
  expect(screen.getByText("Share of the national budget")).toBeTruthy();
  expect(screen.queryByText(/2% of GDP/)).toBeNull();
  expect(screen.queryByText("Procurement")).toBeNull();
});

it("shows every Defense line summed and names the one it edits", () => {
  renderCard({ line: { ...defenseLine, totalDefenseAmount: 11e9 } });
  expect(screen.getByText("11000000000")).toBeTruthy();
  expect(screen.getByText(/The Ministry of Defence line is \$8,000,000,000 of it/)).toBeTruthy();
});

it("opens the share editor for the owner", () => {
  const { setEditingBudget } = renderCard({ editing: false });
  fireEvent.click(screen.getByRole("button", { name: /Edit share/ }));
  expect(setEditingBudget).toHaveBeenCalledWith(true);
});

it("saves the typed share in percent", () => {
  const { onSaveShare } = renderCard({ editing: true });
  const input = screen.getByLabelText("Defense share of the national budget") as HTMLInputElement;
  expect(input.value).toBe("8");
  fireEvent.change(input, { target: { value: "12.5" } });
  expect(screen.getByText(/= \$12,500,000,000/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Save share/ }));
  expect(onSaveShare).toHaveBeenCalledWith(12.5);
});

it("refuses a share over 100%", () => {
  const { onSaveShare } = renderCard({ editing: true });
  fireEvent.change(screen.getByLabelText("Defense share of the national budget"), {
    target: { value: "140" },
  });
  const save = screen.getByRole("button", { name: /Save share/ }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(save);
  expect(onSaveShare).not.toHaveBeenCalled();
});

it("offers no editing in the locked preview", () => {
  renderCard({ canEdit: false, editing: true });
  expect(screen.queryByRole("button", { name: /Edit share/ })).toBeNull();
  expect(screen.queryByLabelText("Defense share of the national budget")).toBeNull();
});

it("offers to create the government structure when there are no departments", () => {
  renderCard({ line: { kind: "no-structure" } });
  expect(screen.getByRole("status").textContent).toMatch(/no departments yet/);
  expect(screen.getByRole("button", { name: "Create government structure" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Edit share/ })).toBeNull();
});

it("offers to add a Defense department when there is none", () => {
  const { onAddDefenseDepartment } = renderCard({ line: { kind: "no-department" } });
  expect(screen.getByRole("status").textContent).toMatch(/no Defense department/);
  fireEvent.click(screen.getByRole("button", { name: /Add a Defense department/ }));
  expect(onAddDefenseDepartment).toHaveBeenCalled();
});

it("shows the empty state without actions in the locked preview", () => {
  renderCard({ line: { kind: "no-department" }, canEdit: false });
  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Add a Defense department/ })).toBeNull();
});
