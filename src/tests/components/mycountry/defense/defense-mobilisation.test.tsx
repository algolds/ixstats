/**
 * Realm time D2b: mobilising explains the gradual arrival (about a quarter in 3 days, nearly all in 60), that the
 * reservists' pay is an emergency supplement that raises defense spending as a share of GDP, caps the call-up at
 * the reserve, and demobilising asks first.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobiliseDialog } from "~/components/mycountry/domains/defense/branches/MobiliseDialog";
import { ReservesCard } from "~/components/mycountry/domains/defense/levers/ReservesCard";
import { ownerBranch, ownerDefense } from "~/tests/fixtures/defense-overview";

function renderDialog(onConfirm = jest.fn()) {
  render(
    <MobiliseDialog
      branch={{ id: "b-land", name: "Royal Army", reserves: 80_000, mobilisationOrder: 20_000 }}
      onOpenChange={jest.fn()}
      doctrine="balanced"
      volunteerShare={1}
      gdpPerCapita={20_000}
      gdp={1e11}
      annualBudget={2e9}
      supplement={0}
      pending={false}
      onConfirm={onConfirm}
    />
  );
  return onConfirm;
}

it("explains that reservists arrive gradually", () => {
  renderDialog();
  const text = screen.getByTestId("mobilisation-arrival").textContent ?? "";
  expect(text).toMatch(/about 26% within 3 days/);
  expect(text).toMatch(/within 60\s+days/);
  expect(screen.getByText(/60,000 reservists can be called up, on top of the 20,000 already ordered/)).toBeTruthy();
});

it("prices the call-up as an emergency supplement that raises the burden", () => {
  renderDialog();
  fireEvent.change(screen.getByLabelText("Reservists to call up"), { target: { value: "10000" } });
  const cost = screen.getByTestId("mobilisation-cost").textContent ?? "";
  // 10,000 volunteers at 2.2 × 20,000 = $440M a year on a $100B economy spending $2B: 2.0% → 2.4%.
  expect(cost).toMatch(/\$440(\.0)?M a year/);
  expect(cost).toMatch(/emergency\s+supplement outside the defense budget/);
  expect(cost).toMatch(/rises from 2\.0%\s+to 2\.4% of GDP/);
});

it("orders no more than the reserve holds", () => {
  const onConfirm = renderDialog();
  fireEvent.change(screen.getByLabelText("Reservists to call up"), { target: { value: "999999" } });
  fireEvent.click(screen.getByRole("button", { name: "Mobilise 60,000" }));
  expect(onConfirm).toHaveBeenCalledWith("b-land", 60_000);
});

it("asks before demobilising and shows what has reported", () => {
  const onDemobilise = jest.fn();
  const overview = ownerDefense({
    branches: [ownerBranch({ mobilisationOrder: 20_000, mobilised: 6_000 })],
    mobilisationSupplement: 250e6,
  });
  render(
    <ReservesCard overview={overview} canEdit pending={false} onMobilise={jest.fn()} onDemobilise={onDemobilise} />
  );
  expect(screen.getByText(/6,000 of 20,000 reported/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Demobilise" }));
  expect(screen.getByText(/Everyone called up goes home at once/)).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Demobilise" }).at(-1)!);
  expect(onDemobilise).toHaveBeenCalledWith("b-land");
});
