/**
 * Realm time D2b: the national levers. The split's five lines always add up to 100% and presets apply as presets;
 * the manpower model saves a volunteer share; the alert explains its bite (and reads "Paused" on a stopped realm);
 * none of them has a working control in the free preview.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import { BudgetSplitCard } from "~/components/mycountry/domains/defense/levers/BudgetSplitCard";
import { ManpowerCard } from "~/components/mycountry/domains/defense/levers/ManpowerCard";
import { PostureCard } from "~/components/mycountry/domains/defense/levers/PostureCard";
import { ReservesCard } from "~/components/mycountry/domains/defense/levers/ReservesCard";
import { SHARE_KEYS, type BudgetShares } from "~/lib/military/model";
import { ownerDefense } from "~/tests/fixtures/defense-overview";
import { CLOCK_NOW, pausedReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

beforeAll(stubResizeObserver);

const total = (shares: BudgetShares) => SHARE_KEYS.reduce((sum, key) => sum + shares[key], 0);

function renderSplit(canEdit = true) {
  const onSave = jest.fn();
  const onApplyPreset = jest.fn();
  render(
    <BudgetSplitCard
      overview={ownerDefense()}
      canEdit={canEdit}
      pending={false}
      onSave={onSave}
      onApplyPreset={onApplyPreset}
    />
  );
  return { onSave, onApplyPreset };
}

describe("budget split", () => {
  it("keeps the five lines at 100% when one changes and saves shares that sum to 1", () => {
    const { onSave } = renderSplit();
    fireEvent.change(screen.getByLabelText("Procurement percent"), { target: { value: "50" } });
    expect(screen.getByTestId("split-total").textContent).toBe("100%");
    expect((screen.getByLabelText("Procurement percent") as HTMLInputElement).value).toBe("50");
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));
    const saved = onSave.mock.calls[0]![0] as BudgetShares;
    expect(saved.procurement).toBeCloseTo(0.5);
    expect(total(saved)).toBeCloseTo(1);
  });

  it("applies a preset as that preset", () => {
    const { onApplyPreset, onSave } = renderSplit();
    fireEvent.click(screen.getByRole("button", { name: "Rearm" }));
    expect((screen.getByLabelText("Procurement percent") as HTMLInputElement).value).toBe("50");
    expect(screen.getByTestId("split-total").textContent).toBe("100%");
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));
    expect(onApplyPreset).toHaveBeenCalledWith("rearm");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("previews what a draft buys against today", () => {
    renderSplit();
    fireEvent.click(screen.getByRole("button", { name: "Territorial conscript" }));
    const preview = screen.getByRole("region", { name: "What this split buys" });
    expect(within(preview).getByText("Personnel pay supports")).toBeTruthy();
    expect(within(preview).getAllByText(/^now /).length).toBeGreaterThan(0);
  });

  it("warns under 20% on procurement", () => {
    renderSplit();
    fireEvent.change(screen.getByLabelText("Procurement percent"), { target: { value: "10" } });
    expect(screen.getByText(/equipment wears out faster than it is replaced/)).toBeTruthy();
  });
});

describe("manpower", () => {
  it("saves the chosen model's volunteer share", () => {
    const onSave = jest.fn();
    render(<ManpowerCard overview={ownerDefense()} canEdit pending={false} onSave={onSave} />);
    fireEvent.click(screen.getByRole("radio", { name: /Conscription/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save manpower" }));
    expect(onSave).toHaveBeenCalledWith({ volunteerShare: 0, serviceMonths: 12, reserveYears: 20 });
  });
});

describe("alert", () => {
  const renderPosture = (reader = sixTimesReader()) => {
    const onAlert = jest.fn();
    render(
      <PostureCard
        overview={ownerDefense()}
        reader={reader}
        nowClockMs={CLOCK_NOW}
        canEdit
        pending={false}
        onDoctrine={jest.fn()}
        onAlert={onAlert}
        onOmPriority={jest.fn()}
        onSurge={jest.fn()}
      />
    );
    return onAlert;
  };

  it("explains that a raise bites later, then orders it", () => {
    const onAlert = renderPosture();
    fireEvent.click(screen.getByRole("radio", { name: /^War/ }));
    expect(screen.getByTestId("alert-change").textContent).toMatch(/takes 30 days to bite, from \d+ (Thaw|Frostfall) \d+ AE \(in /);
    fireEvent.click(screen.getByRole("button", { name: "Order war alert" }));
    expect(onAlert).toHaveBeenCalledWith("war");
  });

  it("reads Paused on a stopped realm", () => {
    renderPosture(pausedReader());
    fireEvent.click(screen.getByRole("radio", { name: /^High/ }));
    expect(screen.getByTestId("alert-change").textContent).toMatch(/\(Paused\)/);
  });
});

describe("the free preview", () => {
  it("shows every lever's value but no working control", () => {
    const overview = ownerDefense();
    render(
      <>
        <BudgetSplitCard overview={overview} canEdit={false} pending={false} onSave={jest.fn()} onApplyPreset={jest.fn()} />
        <ManpowerCard overview={overview} canEdit={false} pending={false} onSave={jest.fn()} />
        <PostureCard
          overview={overview}
          reader={sixTimesReader()}
          nowClockMs={CLOCK_NOW}
          canEdit={false}
          pending={false}
          onDoctrine={jest.fn()}
          onAlert={jest.fn()}
          onOmPriority={jest.fn()}
          onSurge={jest.fn()}
        />
        <ReservesCard overview={overview} canEdit={false} pending={false} onMobilise={jest.fn()} onDemobilise={jest.fn()} />
      </>
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByText("35%")).toBeTruthy();
    expect(screen.getByText("All-volunteer")).toBeTruthy();
  });
});
